// PocketBun-only: attaches the Bun cluster worker handshake to the existing PocketBase lifecycle.

import cluster from "node:cluster";
import type { App } from "../../core/app.ts";
import { TerminateEvent } from "../../core/events.ts";
import { StoreKeyActiveBackup } from "../../core/store.ts";
import {
  ClusterEnvAddress,
  ClusterEnvReusePort,
  ClusterEnvRole,
  ClusterEnvSlot,
  ClusterEnvToken,
  ClusterEnvWorkerId,
  clusterRole,
  clusterToken,
  clusterWorkerId,
  clusterWorkerSlot,
  configureClusterWorker,
  getClusterOAuth2DeliveryHandler,
  getClusterBackupFilesystemHandler,
  getClusterRealtimeEventHandler,
  getClusterRealtimePrepareHandler,
  getClusterRealtimeSubscribeHandler,
  updateClusterRealtimeWorkers,
} from "./context.ts";
import { waitForIpcSend } from "./ipc_send.ts";
import {
  ClusterProtocolVersion,
  parseClusterMessage,
  type CoordinatorOperation,
  type CoordinatorValue,
  type ClusterWorkerRole,
  type RealtimeBroadcastEvent,
  type RealtimeDeletePrepare,
  type RateLimitConsumeRequest,
  type WorkerToPrimaryMessage,
} from "./protocol.ts";

let attached = false;
let shutdownRequested = false;
let workerApp: App | null = null;
let stopWorkerServer: (() => Promise<void>) | null = null;
const coordinatorTimeoutMs = 5_000;
const backupMutationTimeoutMs = 300_000;
const pendingCoordinatorRequests = new Map<
  string,
  { resolve: (value: CoordinatorValue) => void; reject: (error: Error) => void; timeout: ReturnType<typeof setTimeout> }
>();
const pendingRateLimits: Array<{
  request: RateLimitConsumeRequest;
  resolve: (allowed: boolean) => void;
  reject: (error: Error) => void;
}> = [];
let rateLimitBatchInFlight = false;
let realtimePresenceTail = Promise.resolve();

export function attachClusterWorker(): void {
  if (attached) {
    return;
  }
  if (!cluster.isWorker || !cluster.worker) {
    throw new Error("PocketBun cluster worker environment was provided outside a Bun cluster worker");
  }

  const role = process.env[ClusterEnvRole];
  const slot = Number(process.env[ClusterEnvSlot]);
  const address = process.env[ClusterEnvAddress] ?? "";
  const token = process.env[ClusterEnvToken] ?? "";
  const reusePort = process.env[ClusterEnvReusePort] === "1";
  if (!isWorkerRole(role) || !Number.isSafeInteger(slot) || slot < 0 || !address || !token) {
    throw new Error("Invalid PocketBun cluster worker environment");
  }

  const workerId = cluster.worker.id;
  configureClusterWorker({ role, slot, address, token, reusePort, workerId });
  process.env[ClusterEnvRole] = role;
  process.env[ClusterEnvWorkerId] = String(workerId);
  delete process.env[ClusterEnvToken];
  attached = true;

  process.on("message", (value: unknown) => {
    const message = parseClusterMessage(value);
    if (!message || message.token !== token) {
      return;
    }
    if (message.kind === "coordinator.response") {
      const pending = pendingCoordinatorRequests.get(message.requestId);
      if (!pending) {
        return;
      }
      clearTimeout(pending.timeout);
      pendingCoordinatorRequests.delete(message.requestId);
      if (message.ok) {
        pending.resolve(message.value ?? null);
      } else {
        pending.reject(new Error(message.error?.message ?? "Cluster coordinator request failed"));
      }
      return;
    }
    if (message.kind === "coordinator.delivery") {
      void handleCoordinatorDelivery(message.requestId, message.operation);
      return;
    }
    if (message.kind === "control.recycle") {
      void recycleClusterWorker(message.reason);
      return;
    }
    if (message.kind !== "control.shutdown") {
      return;
    }
    if (message.force) {
      process.exit(1);
    }
    if (!shutdownRequested) {
      shutdownRequested = true;
      process.emit("SIGTERM", "SIGTERM");
    }
  });

  process.once("disconnect", () => {
    rejectPendingCoordinatorRequests(new Error("PocketBun cluster primary disconnected"));
    process.exit(1);
  });
}

export function registerClusterWorkerApp(app: App): void {
  workerApp = app;
}

export function registerClusterWorkerServerStop(stop: () => Promise<void>): void {
  stopWorkerServer = stop;
}

export function clusterWorkerShutdownRequested(): boolean {
  return shutdownRequested;
}

export async function notifyClusterWorkerReady(server: ReturnType<typeof Bun.serve>): Promise<void> {
  const role = clusterRole();
  const slot = clusterWorkerSlot();
  const workerId = clusterWorkerId();
  if (!isWorkerRole(role) || slot === null || workerId === null) {
    throw new Error("PocketBun cluster worker is not configured");
  }
  if (!server.hostname || !server.port) {
    throw new Error("PocketBun cluster worker server has no bound hostname or port");
  }

  await send({
    version: ClusterProtocolVersion,
    kind: "worker.ready",
    token: clusterToken(),
    role,
    slot,
    workerId,
    pid: process.pid,
    hostname: server.hostname,
    port: server.port,
  });
}

export async function notifyClusterWorkerStopped(): Promise<void> {
  const workerId = clusterWorkerId();
  if (workerId === null || !process.connected) {
    return;
  }
  try {
    await send({
      version: ClusterProtocolVersion,
      kind: "worker.stopped",
      token: clusterToken(),
      workerId,
    });
  } catch {
    // The primary may already be gone; Bun terminates the worker on disconnect.
  }
}

export async function consumeClusterRateLimit(
  limiterId: string,
  clientKey: string,
  maxRequests: number,
  duration: number,
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    pendingRateLimits.push({ request: { limiterId, clientKey, maxRequests, duration }, resolve, reject });
    void flushRateLimitBatch();
  });
}

export async function isClusterRateLimited(limiterId: string, clientKey: string): Promise<boolean> {
  return (await requestCoordinator({ kind: "rate-limit.check", limiterId, clientKey })) === true;
}

export async function claimClusterExpiringValue(key: string, ttlMs: number): Promise<string | null> {
  const value = await requestCoordinator({ kind: "expiring.claim", key, ttlMs });
  return typeof value === "string" ? value : null;
}

export async function releaseClusterExpiringValue(key: string, claimToken: string): Promise<void> {
  await requestCoordinator({ kind: "expiring.release", key, claimToken });
}

export async function putClusterExpiringValue(key: string, value: string, ttlMs: number): Promise<void> {
  await requestCoordinator({ kind: "expiring.put", key, value, ttlMs });
}

export async function takeClusterExpiringValue(key: string): Promise<string | null> {
  const value = await requestCoordinator({ kind: "expiring.take", key });
  return typeof value === "string" ? value : null;
}

export async function broadcastClusterRealtimeEvent(event: RealtimeBroadcastEvent): Promise<void> {
  return broadcastClusterRealtimeEvents([event]);
}

export async function broadcastClusterRealtimeEvents(events: RealtimeBroadcastEvent[]): Promise<void> {
  const delivered = await requestCoordinator({ kind: "realtime.publish", events });
  if (delivered !== true) {
    throw new Error("PocketBun cluster realtime publication failed");
  }
}

export async function prepareClusterRealtimeDelete(eventId: string, collectionId: string, recordJson: string): Promise<void> {
  return prepareClusterRealtimeDeletes([{ eventId, collectionId, recordJson }]);
}

export async function prepareClusterRealtimeDeletes(events: RealtimeDeletePrepare[]): Promise<void> {
  const prepared = await requestCoordinator({ kind: "realtime.prepare", events });
  if (prepared !== true) {
    throw new Error("PocketBun cluster realtime delete preparation failed");
  }
}

export function updateClusterRealtimePresence(active: boolean): Promise<void> {
  const update = realtimePresenceTail.then(async () => {
    const updated = await requestCoordinator({ kind: "realtime.presence", active });
    if (updated !== true) {
      throw new Error("PocketBun cluster realtime presence update failed");
    }
  });
  realtimePresenceTail = update.catch(() => {});
  return update;
}

export async function routeClusterRealtimeSubscription(clientId: string, requestJson: string): Promise<string> {
  const result = await requestCoordinator({ kind: "realtime.subscribe", clientId, requestJson });
  return typeof result === "string" ? result : "absent";
}

export async function deliverClusterOAuth2Redirect(
  clientId: string,
  requestIP: string,
  data: string,
): Promise<"delivered" | "absent" | "duplicate" | "invalid"> {
  const result = await requestCoordinator({ kind: "oauth2.deliver", clientId, requestIP, data, mode: "deliver" });
  if (result === "delivered" || result === "duplicate" || result === "invalid") {
    return result;
  }
  return "absent";
}

export async function acquireClusterBackupLease(name: string): Promise<string | null> {
  const value = await requestCoordinator({ kind: "backup.acquire", name });
  return typeof value === "string" ? value : null;
}

export async function releaseClusterBackupLease(leaseToken: string): Promise<void> {
  await requestCoordinator({ kind: "backup.release", leaseToken });
}

export async function setClusterBackupPhase(leaseToken: string, phase: "idle" | "delete" | "write"): Promise<void> {
  const value = await requestCoordinator({ kind: "backup.phase", leaseToken, phase });
  if (value !== true) {
    throw new Error("PocketBun cluster backup phase update failed");
  }
}

export async function notifyClusterBackupFileMutation(
  kind: "backup.file-delete" | "backup.file-write",
  fileKey: string,
): Promise<void> {
  await requestCoordinator({ kind, fileKey });
}

export async function restartClusterWorkers(): Promise<void> {
  const accepted = await requestCoordinator({ kind: "lifecycle.restart" });
  if (accepted !== true) {
    throw new Error("PocketBun cluster restart was not accepted");
  }
}

export async function beginClusterRestore(leaseToken: string): Promise<void> {
  try {
    const accepted = await requestCoordinator({ kind: "restore.begin", leaseToken });
    if (accepted !== true) {
      throw new Error("PocketBun cluster restore quiesce was not accepted");
    }
    if (!stopWorkerServer) {
      throw new Error("PocketBun cluster worker server is not registered");
    }
    await stopWorkerServer();
  } catch (error) {
    await requestCoordinator({
      kind: "restore.abort",
      leaseToken,
      fatal: false,
      error: error instanceof Error ? error.message : String(error),
    }).catch(() => {});
    throw error;
  }
}

export async function completeClusterRestore(leaseToken: string): Promise<void> {
  const accepted = await requestCoordinator({ kind: "restore.complete", leaseToken });
  if (accepted !== true) {
    throw new Error("PocketBun cluster restore completion was not accepted");
  }
}

export async function abortClusterRestore(leaseToken: string, fatal: boolean, error: string): Promise<void> {
  const accepted = await requestCoordinator({ kind: "restore.abort", leaseToken, fatal, error });
  if (accepted !== true) {
    throw new Error("PocketBun cluster restore recovery was not accepted");
  }
}

async function handleCoordinatorDelivery(requestId: string, operation: import("./protocol.ts").CoordinatorDeliveryOperation) {
  const workerId = clusterWorkerId();
  if (workerId === null) {
    return;
  }
  try {
    let value: string;
    if (operation.kind === "backup.state") {
      if (!workerApp) {
        throw new Error("PocketBun cluster worker app is not registered");
      }
      if (operation.name === null) {
        workerApp.store().remove(StoreKeyActiveBackup);
      } else {
        workerApp.store().set(StoreKeyActiveBackup, operation.name);
      }
      value = "updated";
    } else if (operation.kind === "realtime.presence") {
      updateClusterRealtimeWorkers(operation.workerIds);
      value = "updated";
    } else if (operation.kind === "backup.file-delete" || operation.kind === "backup.file-write") {
      const handler = getClusterBackupFilesystemHandler();
      if (!handler) {
        throw new Error("PocketBun cluster backup filesystem handler is not registered");
      }
      value = await handler(operation);
    } else if (operation.kind === "realtime.publish") {
      const handler = getClusterRealtimeEventHandler();
      if (!handler) {
        throw new Error("PocketBun cluster realtime delivery handler is not registered");
      }
      await handler(operation.events);
      value = "delivered";
    } else if (operation.kind === "realtime.prepare") {
      const handler = getClusterRealtimePrepareHandler();
      if (!handler) {
        throw new Error("PocketBun cluster realtime delivery handler is not registered");
      }
      value = await handler(operation);
    } else if (operation.kind === "realtime.subscribe") {
      const handler = getClusterRealtimeSubscribeHandler();
      if (!handler) {
        throw new Error("PocketBun cluster realtime subscription handler is not registered");
      }
      value = await handler(operation);
    } else {
      const handler = getClusterOAuth2DeliveryHandler();
      if (!handler) {
        throw new Error("PocketBun cluster OAuth2 delivery handler is not registered");
      }
      value = await handler(operation);
    }
    await send({
      version: ClusterProtocolVersion,
      kind: "coordinator.delivery-result",
      token: clusterToken(),
      requestId,
      workerId,
      ok: true,
      value,
    });
  } catch (error) {
    await send({
      version: ClusterProtocolVersion,
      kind: "coordinator.delivery-result",
      token: clusterToken(),
      requestId,
      workerId,
      ok: false,
      error: { message: error instanceof Error ? error.message : String(error) },
    }).catch(() => {});
  }
}

async function recycleClusterWorker(reason: "restart" | "restore"): Promise<void> {
  if (shutdownRequested) {
    return;
  }
  shutdownRequested = true;
  if (!workerApp) {
    process.exit(1);
  }

  const event = new TerminateEvent(workerApp, true);
  try {
    const result = workerApp.OnTerminate().Trigger(event, (e) => {
      e.App.resetBootstrapState();
      return null;
    });
    const resolved = result instanceof Promise ? await result : result;
    if (resolved instanceof Error) {
      throw resolved;
    }
    await notifyClusterWorkerStopped();
    process.exit(0);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`[cluster] failed to stop worker for ${reason}: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

function requestCoordinator(operation: CoordinatorOperation): Promise<CoordinatorValue> {
  const workerId = clusterWorkerId();
  if (workerId === null) {
    return Promise.reject(new Error("PocketBun cluster worker is not configured"));
  }
  const requestId = crypto.randomUUID();
  const timeoutMs =
    operation.kind === "restore.begin"
      ? 30_000
      : operation.kind === "backup.file-delete" || operation.kind === "backup.file-write"
        ? backupMutationTimeoutMs
        : coordinatorTimeoutMs;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingCoordinatorRequests.delete(requestId);
      reject(new Error(`PocketBun cluster coordinator request timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    pendingCoordinatorRequests.set(requestId, { resolve, reject, timeout });
    void send({
      version: ClusterProtocolVersion,
      kind: "coordinator.request",
      token: clusterToken(),
      requestId,
      workerId,
      operation,
    }).catch((error) => {
      clearTimeout(timeout);
      pendingCoordinatorRequests.delete(requestId);
      reject(error instanceof Error ? error : new Error(String(error)));
    });
  });
}

function rejectPendingCoordinatorRequests(error: Error): void {
  for (const pending of pendingCoordinatorRequests.values()) {
    clearTimeout(pending.timeout);
    pending.reject(error);
  }
  pendingCoordinatorRequests.clear();
  for (const pending of pendingRateLimits.splice(0)) {
    pending.reject(error);
  }
}

async function flushRateLimitBatch(): Promise<void> {
  if (rateLimitBatchInFlight) {
    return;
  }
  rateLimitBatchInFlight = true;
  try {
    while (pendingRateLimits.length > 0) {
      const batch = pendingRateLimits.splice(0);
      try {
        const value = await requestCoordinator({
          kind: "rate-limit.consume-batch",
          requests: batch.map((item) => item.request),
        });
        if (!Array.isArray(value) || value.length !== batch.length || value.some((item) => typeof item !== "boolean")) {
          throw new Error("PocketBun cluster coordinator returned an invalid rate-limit batch");
        }
        for (let i = 0; i < batch.length; i += 1) {
          batch[i]!.resolve(value[i]!);
        }
      } catch (error) {
        const reason = error instanceof Error ? error : new Error(String(error));
        for (const item of batch) {
          item.reject(reason);
        }
      }
    }
  } finally {
    rateLimitBatchInFlight = false;
    if (pendingRateLimits.length > 0) {
      void flushRateLimitBatch();
    }
  }
}

function send(message: WorkerToPrimaryMessage): Promise<void> {
  if (!process.send) {
    return Promise.reject(new Error("PocketBun cluster worker has no primary IPC channel"));
  }
  return waitForIpcSend((callback) => process.send!(message, callback));
}

function isWorkerRole(value: unknown): value is ClusterWorkerRole {
  return value === "leader" || value === "follower";
}
