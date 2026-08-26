// PocketBun-only: supervises native Bun HTTP workers without opening PocketBun databases in the primary.

import cluster, { type Worker } from "node:cluster";
import { mkdir, open, readFile, rename, rm, stat, unlink, utimes } from "node:fs/promises";
import { join, resolve } from "node:path";
import { LocalClusterGuardFileName } from "../../core/base_paths.ts";
import {
  ClusterEnvAddress,
  ClusterEnvReusePort,
  ClusterEnvRole,
  ClusterEnvSlot,
  ClusterEnvToken,
  validateWorkerCount,
} from "./context.ts";
import { ClusterCoordinator } from "./coordinator.ts";
import { waitForIpcSend } from "./ipc_send.ts";
import {
  ClusterProtocolVersion,
  parseClusterMessage,
  type ClusterWorkerRole,
  type CoordinatorDeliveryOperation,
  type CoordinatorDeliveryResultMessage,
  type CoordinatorRequestMessage,
  type CoordinatorResponseMessage,
  type PrimaryToWorkerMessage,
  type WorkerReadyMessage,
} from "./protocol.ts";

const workerReadyTimeoutMs = 60_000;
const gracefulShutdownTimeoutMs = 10_000;
const forcedShutdownTimeoutMs = 2_000;
const crashWindowMs = 30_000;
const crashBudget = 5;
const heartbeatIntervalMs = 1_000;
const staleHeartbeatMs = 3_000;
const coordinatorDeliveryTimeoutMs = 4_000;
const backupMutationDeliveryTimeoutMs = 300_000;

export type ClusterPrimaryOptions = {
  workers: number;
  dataDir: string;
  httpAddr: string;
  showStartBanner: boolean;
};

export type ClusterWorkerPlan = {
  role: ClusterWorkerRole;
  slot: number;
  address: string;
  hostname: string;
  port: number;
  reusePort: boolean;
};

type ManagedWorker = ClusterWorkerPlan & {
  worker: Worker;
  ready: boolean;
  intentional: boolean;
  readyPromise: Promise<WorkerReadyMessage>;
  resolveReady: (message: WorkerReadyMessage) => void;
  rejectReady: (error: Error) => void;
  exitPromise: Promise<void>;
  resolveExit: () => void;
};

type GuardOwner = {
  pid: number;
  token: string;
  startedAt: string;
};

type PendingDelivery = {
  workerId: number;
  resolve: (value: string) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
};

type LifecycleOperation = Extract<
  import("./protocol.ts").CoordinatorOperation,
  { kind: "lifecycle.restart" | "restore.begin" | "restore.complete" | "restore.abort" }
>;

type LifecycleRequestResult = {
  value: import("./protocol.ts").CoordinatorValue;
  afterResponse?: () => void;
};

type LifecycleState = "running" | "restarting" | "restoring";

export type PrimaryGuard = {
  path: string;
  release: () => Promise<void>;
};

export async function runClusterPrimary(options: ClusterPrimaryOptions): Promise<void> {
  if (!cluster.isPrimary) {
    throw new Error("PocketBun cluster primary started inside a worker");
  }

  const plans = planClusterWorkers(options.workers, options.httpAddr);
  const guard = await acquirePrimaryGuard(options.dataDir);
  const token = crypto.randomUUID();
  let coordinator = new ClusterCoordinator();
  const records = new Map<number, ManagedWorker>();
  const pendingDeliveries = new Map<string, PendingDelivery>();
  const replacements = new Map<number, Promise<void>>();
  const crashes = new Map<number, number[]>();
  let lifecycleState: LifecycleState = "running";
  let restoreOwnerId: number | null = null;
  let restoreLeaseToken = "";
  let shuttingDown = false;
  let shutdownPromise: Promise<void> | null = null;
  let shutdownSignals = 0;
  let fatalError: Error | null = null;
  let resolveShutdownDone!: () => void;
  const shutdownDone = new Promise<void>((resolveDone) => {
    resolveShutdownDone = resolveDone;
  });

  const log = (message: string) => {
    // eslint-disable-next-line no-console
    console.log(message);
  };

  const broadcastBackupState = async (name: string | null): Promise<void> => {
    await Promise.all(
      readyWorkers(records).map((worker) =>
        sendCoordinatorDelivery(worker, token, pendingDeliveries, { kind: "backup.state", name }),
      ),
    );
  };

  const broadcastRealtimePresence = async (workerIds: number[]): Promise<void> => {
    await Promise.all(
      readyWorkers(records).map((worker) =>
        sendCoordinatorDelivery(worker, token, pendingDeliveries, { kind: "realtime.presence", workerIds }),
      ),
    );
  };

  const forceWorkers = () => {
    for (const record of records.values()) {
      record.intentional = true;
      try {
        record.worker.kill("SIGKILL");
      } catch {
        // The worker may already have exited.
      }
    }
  };

  const beginShutdown = (force: boolean): Promise<void> => {
    if (shutdownPromise) {
      if (force) {
        forceWorkers();
      }
      return shutdownPromise;
    }

    shuttingDown = true;
    shutdownPromise = (async () => {
      const active = [...records.values()];
      for (const record of active) {
        record.intentional = true;
        if (force) {
          continue;
        }
        await sendToWorker(record.worker, {
          version: ClusterProtocolVersion,
          kind: "control.shutdown",
          token,
          force: false,
        }).catch(() => {});
      }

      if (!force) {
        await Promise.race([Promise.all(active.map((record) => record.exitPromise)), Bun.sleep(gracefulShutdownTimeoutMs)]);
      }

      forceWorkers();
      const remaining = [...records.values()];
      await Promise.race([Promise.all(remaining.map((record) => record.exitPromise)), Bun.sleep(forcedShutdownTimeoutMs)]);
      resolveShutdownDone();
    })();
    return shutdownPromise;
  };

  const fail = (error: Error) => {
    if (fatalError) {
      return;
    }
    fatalError = error;
    log(`[cluster] fatal: ${error.message}`);
    void beginShutdown(true);
  };

  const crashDelay = (slot: number): number | null => {
    const now = Date.now();
    const recent = (crashes.get(slot) ?? []).filter((timestamp) => now - timestamp < crashWindowMs);
    recent.push(now);
    crashes.set(slot, recent);
    if (recent.length >= crashBudget) {
      return null;
    }
    return Math.min(100 * 2 ** (recent.length - 1), 2_000) + Math.floor(Math.random() * 100);
  };

  const scheduleReplacement = async (record: ManagedWorker) => {
    const delay = crashDelay(record.slot);
    if (delay === null) {
      fail(
        new Error(`${record.role} slot=${record.slot} crashed ${crashBudget} times within ${crashWindowMs / 1_000} seconds`),
      );
      return;
    }
    log(`[cluster] restarting ${record.role} slot=${record.slot} after ${delay}ms`);
    await Bun.sleep(delay);
    if (!shuttingDown && lifecycleState === "running") {
      await ensureSlot(record.slot).catch(fail);
    }
  };

  const spawnWorker = (plan: ClusterWorkerPlan): ManagedWorker => {
    let resolveReady!: (message: WorkerReadyMessage) => void;
    let rejectReady!: (error: Error) => void;
    const readyPromise = new Promise<WorkerReadyMessage>((resolveMessage, rejectMessage) => {
      resolveReady = resolveMessage;
      rejectReady = rejectMessage;
    });
    let resolveExit!: () => void;
    const exitPromise = new Promise<void>((resolveWorkerExit) => {
      resolveExit = resolveWorkerExit;
    });

    const worker = cluster.fork({
      [ClusterEnvRole]: plan.role,
      [ClusterEnvSlot]: String(plan.slot),
      [ClusterEnvAddress]: plan.address,
      [ClusterEnvReusePort]: plan.reusePort ? "1" : "0",
      [ClusterEnvToken]: token,
    });
    const record: ManagedWorker = {
      ...plan,
      worker,
      ready: false,
      intentional: false,
      readyPromise,
      resolveReady,
      rejectReady,
      exitPromise,
      resolveExit,
    };
    records.set(plan.slot, record);

    worker.on("message", (value: unknown) => {
      const message = parseClusterMessage(value);
      if (!message || message.token !== token) {
        record.rejectReady(new Error(`worker ${worker.id} sent a malformed cluster message`));
        worker.kill();
        return;
      }

      if (message.kind === "worker.stopped") {
        if (message.workerId !== worker.id) {
          worker.kill();
        }
        return;
      }

      if (message.kind === "coordinator.delivery-result") {
        resolveCoordinatorDelivery(worker, pendingDeliveries, message);
        return;
      }

      if (message.kind === "coordinator.request") {
        if (message.workerId !== worker.id) {
          worker.kill();
          return;
        }
        void respondToCoordinatorRequest(
          worker,
          token,
          coordinator,
          records,
          pendingDeliveries,
          message,
          handleLifecycleRequest,
          (operation) =>
            lifecycleState === "running" || operation.kind === "backup.release"
              ? null
              : new Error(`cluster is ${lifecycleState}`),
        );
        return;
      }

      if (message.kind !== "worker.ready" || record.ready) {
        record.rejectReady(new Error(`worker ${worker.id} sent an unexpected ${message.kind} message`));
        worker.kill();
        return;
      }

      const readyError = validateReady(record, message);
      if (readyError) {
        record.rejectReady(readyError);
        worker.kill();
        return;
      }
      void (async () => {
        const activeBackup = coordinator.activeBackupName();
        if (activeBackup !== null) {
          await sendCoordinatorDelivery(worker, token, pendingDeliveries, { kind: "backup.state", name: activeBackup });
        }
        await coordinator.syncRealtimeWorkers(async (workerIds) => {
          await sendCoordinatorDelivery(worker, token, pendingDeliveries, {
            kind: "realtime.presence",
            workerIds,
          });
          // Join the ready set before the next serialized presence broadcast.
          record.ready = true;
        });
        record.resolveReady(message);
        log(`[cluster] ready ${record.role} slot=${record.slot} worker=${worker.id} pid=${message.pid}`);
      })().catch((error) => {
        record.rejectReady(error instanceof Error ? error : new Error(String(error)));
        worker.kill();
      });
    });

    worker.once("error", (error) => {
      record.rejectReady(error);
    });

    worker.once("exit", (code, signal) => {
      rejectWorkerDeliveries(pendingDeliveries, worker.id);
      record.resolveExit();
      record.rejectReady(new Error(`worker ${worker.id} exited before ready`));
      if (records.get(record.slot) === record) {
        records.delete(record.slot);
      }
      void coordinator
        .updateRealtimeWorker(worker.id, false, broadcastRealtimePresence)
        .catch((error) => log(`[cluster] failed to update realtime presence after worker exit: ${errorMessage(error)}`));
      if (coordinator.releaseBackupForWorker(worker.id)) {
        void broadcastBackupState(null).catch((error) =>
          log(`[cluster] failed to clear backup state after worker exit: ${errorMessage(error)}`),
        );
      }
      log(
        `[cluster] exit ${record.role} slot=${record.slot} worker=${worker.id} pid=${worker.process.pid ?? 0} code=${code ?? "null"} signal=${signal ?? "null"}`,
      );
      if (!record.intentional && lifecycleState === "restoring" && restoreOwnerId === worker.id) {
        fail(new Error("restore worker exited before completing the cluster restore"));
      } else if (!record.intentional && !shuttingDown && lifecycleState === "running" && record.ready) {
        void scheduleReplacement(record);
      }
    });

    return record;
  };

  const ensureSlot = (slot: number): Promise<void> => {
    const current = records.get(slot);
    if (current?.ready) {
      return Promise.resolve();
    }
    const replacing = replacements.get(slot);
    if (replacing) {
      return replacing;
    }

    const replacement = (async () => {
      const plan = plans[slot];
      if (!plan) {
        throw new Error(`missing cluster worker plan for slot ${slot}`);
      }
      while (!shuttingDown) {
        const record = spawnWorker(plan);
        try {
          await withTimeout(record.readyPromise, `worker ${record.worker.id} readiness`, workerReadyTimeoutMs);
          return;
        } catch (error) {
          record.intentional = true;
          if (!record.worker.isDead()) {
            record.worker.kill();
          }
          await Promise.race([record.exitPromise, Bun.sleep(forcedShutdownTimeoutMs)]);
          if (shuttingDown) {
            return;
          }
          const delay = crashDelay(plan.slot);
          if (delay === null) {
            throw new Error(
              `${plan.role} slot=${plan.slot} crashed ${crashBudget} times within ${crashWindowMs / 1_000} seconds`,
            );
          }
          log(
            `[cluster] ${plan.role} slot=${plan.slot} failed before ready: ${errorMessage(error)}; retrying after ${delay}ms`,
          );
          await Bun.sleep(delay);
        }
      }
    })().finally(() => {
      replacements.delete(slot);
    });
    replacements.set(slot, replacement);
    return replacement;
  };

  const stopWorkers = async (targets: ManagedWorker[], reason: "restart" | "restore"): Promise<void> => {
    for (const record of targets) {
      record.intentional = true;
      await sendToWorker(record.worker, {
        version: ClusterProtocolVersion,
        kind: "control.recycle",
        token,
        reason,
      }).catch(() => {});
    }

    await Promise.race([Promise.all(targets.map((record) => record.exitPromise)), Bun.sleep(gracefulShutdownTimeoutMs)]);
    for (const record of targets) {
      if (records.get(record.slot) !== record) {
        continue;
      }
      try {
        record.worker.kill("SIGKILL");
      } catch {
        // The worker may already have exited.
      }
    }
    await Promise.race([Promise.all(targets.map((record) => record.exitPromise)), Bun.sleep(forcedShutdownTimeoutMs)]);
    const remaining = targets.filter((record) => records.get(record.slot) === record);
    if (remaining.length > 0) {
      throw new Error(`workers failed to exit after ${reason}: ${remaining.map((record) => record.worker.id).join(", ")}`);
    }
  };

  const startMissingWorkers = async (): Promise<void> => {
    await ensureSlot(0);
    await Promise.all(plans.slice(1).map((plan) => ensureSlot(plan.slot)));
  };

  const recycleWorkers = async (reason: "restart" | "restore"): Promise<void> => {
    try {
      await stopWorkers([...records.values()], reason);
      await startMissingWorkers();
      lifecycleState = "running";
      log(`[cluster] ${reason} complete with ${plans.length} workers`);
    } catch (error) {
      fail(error instanceof Error ? error : new Error(String(error)));
    }
  };

  const handleLifecycleRequest = async (source: Worker, operation: LifecycleOperation): Promise<LifecycleRequestResult> => {
    if (operation.kind === "lifecycle.restart") {
      if (lifecycleState !== "running") {
        throw new Error(`cluster is ${lifecycleState}`);
      }
      if (coordinator.activeBackupName() !== null) {
        throw new Error("cannot restart while a backup/restore operation is active");
      }
      coordinator = new ClusterCoordinator();
      lifecycleState = "restarting";
      return { value: true, afterResponse: () => void recycleWorkers("restart") };
    }

    if (operation.kind === "restore.begin") {
      if (lifecycleState !== "running") {
        throw new Error(`cluster is ${lifecycleState}`);
      }
      if (!coordinator.ownsBackup(source.id, operation.leaseToken)) {
        throw new Error("restore worker does not own the active backup lease");
      }
      lifecycleState = "restoring";
      restoreOwnerId = source.id;
      restoreLeaseToken = operation.leaseToken;
      await stopWorkers(
        [...records.values()].filter((record) => record.worker.id !== source.id),
        "restore",
      );
      return { value: true };
    }

    if (
      lifecycleState !== "restoring" ||
      restoreOwnerId !== source.id ||
      restoreLeaseToken !== operation.leaseToken ||
      !coordinator.ownsBackup(source.id, operation.leaseToken)
    ) {
      throw new Error("restore worker does not own the active restore transition");
    }

    coordinator.releaseBackup(source.id, operation.leaseToken);
    await broadcastBackupState(null);
    coordinator = new ClusterCoordinator();
    restoreOwnerId = null;
    restoreLeaseToken = "";

    if (operation.kind === "restore.complete") {
      lifecycleState = "restarting";
      return { value: true, afterResponse: () => void recycleWorkers("restore") };
    }

    if (operation.fatal) {
      return {
        value: true,
        afterResponse: () => fail(new Error(`restore rollback failed: ${operation.error || "unknown error"}`)),
      };
    }

    lifecycleState = "restarting";
    return { value: true, afterResponse: () => void recycleWorkers("restore") };
  };

  const onSignal = () => {
    shutdownSignals += 1;
    void beginShutdown(shutdownSignals > 1);
  };
  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);

  try {
    await ensureSlot(0);
    await Promise.all(plans.slice(1).map((plan) => ensureSlot(plan.slot)));
    if (!shuttingDown) {
      printClusterBanner(plans, options.showStartBanner);
    }
    await shutdownDone;
    if (fatalError) {
      throw fatalError;
    }
  } catch (error) {
    if (!shuttingDown) {
      fail(error instanceof Error ? error : new Error(String(error)));
    }
    await beginShutdown(fatalError !== null);
    if (fatalError) {
      throw fatalError;
    }
  } finally {
    process.off("SIGINT", onSignal);
    process.off("SIGTERM", onSignal);
    await guard.release();
  }
}

export function planClusterWorkers(workers: number, rawAddress: string): ClusterWorkerPlan[] {
  const workersError = validateWorkerCount(workers);
  if (workersError) {
    throw workersError;
  }
  const { hostname, port } = parseClusterAddress(rawAddress || "127.0.0.1:8090");
  if (port === 0) {
    throw new Error("--http port 0 cannot be used with multiple workers");
  }

  const sharedPort = process.platform === "linux";
  if (!sharedPort && !isLoopbackHost(hostname)) {
    throw new Error("multiple workers on Windows and macOS require a loopback --http hostname");
  }
  if (!sharedPort && port + workers - 1 > 65_535) {
    throw new Error(`--http port range ${port}-${port + workers - 1} exceeds 65535`);
  }

  return Array.from({ length: workers }, (_, slot) => {
    const workerPort = sharedPort ? port : port + slot;
    return {
      role: slot === 0 ? "leader" : "follower",
      slot,
      hostname,
      port: workerPort,
      address: formatAddress(hostname, workerPort),
      reusePort: sharedPort,
    };
  });
}

export function parseClusterAddress(rawAddress: string): { hostname: string; port: number } {
  const value = rawAddress.trim();
  if (!value) {
    return { hostname: "127.0.0.1", port: 8090 };
  }

  if (value.startsWith("[")) {
    const closing = value.indexOf("]");
    if (closing < 0) {
      throw new Error(`invalid --http address ${JSON.stringify(rawAddress)}`);
    }
    const hostname = value.slice(1, closing);
    const suffix = value.slice(closing + 1);
    if (!suffix.startsWith(":")) {
      return { hostname, port: 8090 };
    }
    return { hostname, port: parsePort(suffix.slice(1), rawAddress) };
  }

  const separator = value.lastIndexOf(":");
  if (separator < 0) {
    return { hostname: value, port: 8090 };
  }
  const hostname = value.slice(0, separator) || "127.0.0.1";
  if (hostname.includes(":")) {
    throw new Error(`invalid --http address ${JSON.stringify(rawAddress)}; IPv6 addresses must use brackets`);
  }
  return { hostname, port: parsePort(value.slice(separator + 1), rawAddress) };
}

export async function acquirePrimaryGuard(dataDir: string): Promise<PrimaryGuard> {
  const resolvedDataDir = resolve(dataDir);
  await mkdir(resolvedDataDir, { recursive: true });
  const path = join(resolvedDataDir, LocalClusterGuardFileName);

  for (;;) {
    const token = crypto.randomUUID();
    const owner: GuardOwner = { pid: process.pid, token, startedAt: new Date().toISOString() };
    try {
      const file = await open(path, "wx", 0o600);
      try {
        await file.writeFile(JSON.stringify(owner));
        await file.sync();
      } finally {
        await file.close();
      }

      const heartbeat = setInterval(() => {
        const now = new Date();
        void utimes(path, now, now).catch(() => {});
      }, heartbeatIntervalMs);
      heartbeat.unref?.();

      let released = false;
      return {
        path,
        release: async () => {
          if (released) {
            return;
          }
          released = true;
          clearInterval(heartbeat);
          const current = await readGuardOwner(path);
          if (current?.token === token) {
            await unlink(path).catch((error) => {
              if (!isCode(error, "ENOENT")) {
                throw error;
              }
            });
          }
        },
      };
    } catch (error) {
      if (!isCode(error, "EEXIST")) {
        throw error;
      }
    }

    const existing = await readGuardOwner(path);
    if (!existing) {
      throw new Error(`PocketBun cluster ownership guard is invalid; inspect ${path}`);
    }
    if (isPidAlive(existing.pid)) {
      throw new Error(`PocketBun cluster primary PID ${existing.pid} already owns ${resolvedDataDir} (guard: ${path})`);
    }

    const info = await stat(path);
    const heartbeatAge = Date.now() - info.mtimeMs;
    if (heartbeatAge < staleHeartbeatMs) {
      await Bun.sleep(staleHeartbeatMs - heartbeatAge);
      const unchanged = await readGuardOwner(path);
      if (!unchanged || unchanged.token !== existing.token || isPidAlive(existing.pid)) {
        continue;
      }
    }

    const stalePath = `${path}.stale-${crypto.randomUUID()}`;
    try {
      await rename(path, stalePath);
    } catch (error) {
      if (isCode(error, "ENOENT")) {
        continue;
      }
      throw error;
    }
    await rm(stalePath, { force: true });
  }
}

function validateReady(record: ManagedWorker, message: WorkerReadyMessage): Error | null {
  if (
    message.role !== record.role ||
    message.slot !== record.slot ||
    message.workerId !== record.worker.id ||
    message.pid !== record.worker.process.pid ||
    message.hostname !== record.hostname ||
    message.port !== record.port
  ) {
    return new Error(`worker ${record.worker.id} readiness does not match its assigned role, slot, PID, and port`);
  }
  return null;
}

function printClusterBanner(plans: ClusterWorkerPlan[], show: boolean): void {
  if (!show || plans.length === 0) {
    return;
  }
  const first = plans[0]!;
  if (first.reusePort) {
    // eslint-disable-next-line no-console
    console.log(`[cluster] ${plans.length} workers serving at http://${first.address}`);
    return;
  }
  const last = plans.at(-1)!;
  // eslint-disable-next-line no-console
  console.log(
    `[cluster] ${plans.length} workers ready at http://${first.address} through http://${last.address}; configure an external reverse proxy`,
  );
}

async function respondToCoordinatorRequest(
  worker: Worker,
  token: string,
  coordinator: ClusterCoordinator,
  records: Map<number, ManagedWorker>,
  pendingDeliveries: Map<string, PendingDelivery>,
  message: CoordinatorRequestMessage,
  handleLifecycle: (worker: Worker, operation: LifecycleOperation) => Promise<LifecycleRequestResult>,
  operationGuard: (operation: import("./protocol.ts").CoordinatorOperation) => Error | null,
): Promise<void> {
  let response: CoordinatorResponseMessage;
  let afterResponse: (() => void) | undefined;
  try {
    const lifecycle = isLifecycleOperation(message.operation) ? await handleLifecycle(worker, message.operation) : null;
    if (!lifecycle) {
      const guardError = operationGuard(message.operation);
      if (guardError) {
        throw guardError;
      }
    }
    response = {
      version: ClusterProtocolVersion,
      kind: "coordinator.response",
      token,
      requestId: message.requestId,
      ok: true,
      value:
        lifecycle?.value ??
        (await handleCoordinatorOperation(worker, token, coordinator, records, pendingDeliveries, message.operation)),
    };
    afterResponse = lifecycle?.afterResponse;
  } catch (error) {
    response = {
      version: ClusterProtocolVersion,
      kind: "coordinator.response",
      token,
      requestId: message.requestId,
      ok: false,
      error: { message: errorMessage(error) },
    };
  }
  await sendToWorker(worker, response).catch(() => {});
  if (response.ok) {
    afterResponse?.();
  }
}

async function handleCoordinatorOperation(
  source: Worker,
  token: string,
  coordinator: ClusterCoordinator,
  records: Map<number, ManagedWorker>,
  pendingDeliveries: Map<string, PendingDelivery>,
  operation: import("./protocol.ts").CoordinatorOperation,
): Promise<import("./protocol.ts").CoordinatorValue> {
  if (operation.kind === "backup.acquire") {
    const leaseToken = coordinator.acquireBackup(source.id, operation.name);
    if (!leaseToken) {
      return null;
    }
    try {
      await Promise.all(
        readyWorkers(records).map((worker) =>
          sendCoordinatorDelivery(worker, token, pendingDeliveries, { kind: "backup.state", name: operation.name }),
        ),
      );
      return leaseToken;
    } catch (error) {
      coordinator.releaseBackup(source.id, leaseToken);
      await Promise.allSettled(
        readyWorkers(records).map((worker) =>
          sendCoordinatorDelivery(worker, token, pendingDeliveries, { kind: "backup.state", name: null }),
        ),
      );
      throw error;
    }
  }
  if (operation.kind === "backup.release") {
    if (coordinator.releaseBackup(source.id, operation.leaseToken)) {
      await Promise.all(
        readyWorkers(records).map((worker) =>
          sendCoordinatorDelivery(worker, token, pendingDeliveries, { kind: "backup.state", name: null }),
        ),
      );
    }
    return true;
  }
  if (operation.kind === "backup.phase") {
    if (!coordinator.setBackupPhase(source.id, operation.leaseToken, operation.phase)) {
      throw new Error("backup worker does not own the active backup lease");
    }
    return true;
  }
  if (operation.kind === "backup.file-delete" || operation.kind === "backup.file-write") {
    const mutation = operation.kind === "backup.file-delete" ? "delete" : "write";
    const ownerId = coordinator.backupMutationOwner(mutation);
    if (ownerId === null) {
      return false;
    }
    const owner = readyWorkers(records).find((worker) => worker.id === ownerId);
    if (!owner) {
      throw new Error("backup owner worker is not ready");
    }
    await sendCoordinatorDelivery(owner, token, pendingDeliveries, operation);
    return true;
  }
  if (operation.kind === "realtime.publish") {
    const targets = readyWorkers(records).filter(
      (worker) => worker.id !== source.id && coordinator.hasRealtimeWorker(worker.id),
    );
    await Promise.all(targets.map((worker) => sendCoordinatorDelivery(worker, token, pendingDeliveries, operation)));
    return true;
  }
  if (operation.kind === "realtime.prepare") {
    const targets = readyWorkers(records).filter(
      (worker) => worker.id !== source.id && coordinator.hasRealtimeWorker(worker.id),
    );
    await Promise.all(targets.map((worker) => sendCoordinatorDelivery(worker, token, pendingDeliveries, operation)));
    return true;
  }
  if (operation.kind === "realtime.presence") {
    await coordinator.updateRealtimeWorker(source.id, operation.active, async (workerIds) => {
      await Promise.all(
        readyWorkers(records).map((worker) =>
          sendCoordinatorDelivery(worker, token, pendingDeliveries, { kind: "realtime.presence", workerIds }),
        ),
      );
    });
    return true;
  }
  if (operation.kind === "realtime.subscribe") {
    const results = await Promise.all(
      readyWorkers(records).map(async (worker) => ({
        worker,
        result: await sendCoordinatorDelivery(worker, token, pendingDeliveries, operation),
      })),
    );
    const owners = results.filter(({ result }) => result !== "absent");
    if (owners.length > 1) {
      throw new Error(`realtime client ${operation.clientId} is owned by multiple workers`);
    }
    const owner = owners[0];
    if (!owner) {
      return "absent";
    }
    return owner.result;
  }
  if (operation.kind === "oauth2.deliver") {
    if (operation.mode !== "deliver") {
      throw new Error("workers may only request OAuth2 delivery");
    }
    const workers = readyWorkers(records);
    const probe = { ...operation, mode: "probe" as const };
    const results = await Promise.all(
      workers.map(async (worker) => ({
        worker,
        result: await sendCoordinatorDelivery(worker, token, pendingDeliveries, probe),
      })),
    );
    const owners = results.filter(({ result }) => result !== "absent");
    if (owners.length > 1) {
      return "duplicate";
    }
    if (owners[0]?.result === "invalid") {
      return "invalid";
    }
    if (!owners[0]) {
      return "absent";
    }
    return sendCoordinatorDelivery(owners[0].worker, token, pendingDeliveries, operation);
  }
  return coordinator.handle(operation);
}

function isLifecycleOperation(operation: import("./protocol.ts").CoordinatorOperation): operation is LifecycleOperation {
  return (
    operation.kind === "lifecycle.restart" ||
    operation.kind === "restore.begin" ||
    operation.kind === "restore.complete" ||
    operation.kind === "restore.abort"
  );
}

function readyWorkers(records: Map<number, ManagedWorker>): Worker[] {
  return [...records.values()].filter((record) => record.ready).map((record) => record.worker);
}

function sendCoordinatorDelivery(
  worker: Worker,
  token: string,
  pendingDeliveries: Map<string, PendingDelivery>,
  operation: CoordinatorDeliveryOperation,
): Promise<string> {
  const requestId = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const timeoutMs =
      operation.kind === "backup.file-delete" || operation.kind === "backup.file-write"
        ? backupMutationDeliveryTimeoutMs
        : coordinatorDeliveryTimeoutMs;
    const timeout = setTimeout(() => {
      pendingDeliveries.delete(requestId);
      reject(new Error(`worker ${worker.id} coordinator delivery timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    pendingDeliveries.set(requestId, { workerId: worker.id, resolve, reject, timeout });
    void sendToWorker(worker, {
      version: ClusterProtocolVersion,
      kind: "coordinator.delivery",
      token,
      requestId,
      operation,
    }).catch((error) => {
      clearTimeout(timeout);
      pendingDeliveries.delete(requestId);
      reject(error instanceof Error ? error : new Error(String(error)));
    });
  });
}

function resolveCoordinatorDelivery(
  worker: Worker,
  pendingDeliveries: Map<string, PendingDelivery>,
  message: CoordinatorDeliveryResultMessage,
): void {
  const pending = pendingDeliveries.get(message.requestId);
  if (!pending) {
    return;
  }
  if (pending.workerId !== worker.id || message.workerId !== worker.id) {
    worker.kill();
    return;
  }
  clearTimeout(pending.timeout);
  pendingDeliveries.delete(message.requestId);
  if (message.ok) {
    pending.resolve(message.value ?? "");
  } else {
    pending.reject(new Error(message.error?.message ?? `worker ${worker.id} coordinator delivery failed`));
  }
}

function rejectWorkerDeliveries(pendingDeliveries: Map<string, PendingDelivery>, workerId: number): void {
  for (const [requestId, pending] of pendingDeliveries) {
    if (pending.workerId !== workerId) {
      continue;
    }
    clearTimeout(pending.timeout);
    pendingDeliveries.delete(requestId);
    pending.reject(new Error(`worker ${workerId} exited during coordinator delivery`));
  }
}

function sendToWorker(worker: Worker, message: PrimaryToWorkerMessage): Promise<void> {
  if (!worker.isConnected()) {
    return Promise.reject(new Error(`worker ${worker.id} IPC channel is closed`));
  }
  return waitForIpcSend((callback) => worker.send(message, callback));
}

function parsePort(value: string, rawAddress: string): number {
  if (!/^\d+$/.test(value)) {
    throw new Error(`invalid --http address ${JSON.stringify(rawAddress)}`);
  }
  const port = Number(value);
  if (!Number.isSafeInteger(port) || port < 0 || port > 65_535) {
    throw new Error(`invalid --http port in ${JSON.stringify(rawAddress)}`);
  }
  return port;
}

function formatAddress(hostname: string, port: number): string {
  return hostname.includes(":") ? `[${hostname}]:${port}` : `${hostname}:${port}`;
}

function isLoopbackHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  if (normalized === "localhost" || normalized === "::1") {
    return true;
  }
  const parts = normalized.split(".");
  return (
    parts.length === 4 &&
    parts[0] === "127" &&
    parts.every((part) => /^\d+$/.test(part) && Number(part) >= 0 && Number(part) <= 255)
  );
}

async function readGuardOwner(path: string): Promise<GuardOwner | null> {
  try {
    const value = JSON.parse(await readFile(path, "utf8")) as Partial<GuardOwner>;
    if (!Number.isSafeInteger(value.pid) || (value.pid ?? 0) <= 0 || typeof value.token !== "string" || !value.token) {
      return null;
    }
    if (typeof value.startedAt !== "string" || Number.isNaN(Date.parse(value.startedAt))) {
      return null;
    }
    return value as GuardOwner;
  } catch {
    return null;
  }
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return !isCode(error, "ESRCH");
  }
}

function isCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === code;
}

function withTimeout<T>(promise: Promise<T>, label: string, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    Bun.sleep(timeoutMs).then(() => {
      throw new Error(`${label} timed out after ${timeoutMs}ms`);
    }),
  ]);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
