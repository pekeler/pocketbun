// PocketBun-only: attaches the Bun cluster worker handshake to the existing PocketBase lifecycle.

import cluster from "node:cluster";
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
  getClusterRealtimeEventHandler,
  getClusterRealtimePrepareHandler,
  getClusterRealtimeSubscribeHandler,
} from "./context.ts";
import {
  ClusterProtocolVersion,
  parseClusterMessage,
  type CoordinatorOperation,
  type CoordinatorValue,
  type ClusterWorkerRole,
  type RealtimeBroadcastEvent,
  type WorkerToPrimaryMessage,
} from "./protocol.ts";

let attached = false;
let shutdownRequested = false;
const coordinatorTimeoutMs = 5_000;
const pendingCoordinatorRequests = new Map<
  string,
  { resolve: (value: CoordinatorValue) => void; reject: (error: Error) => void; timeout: ReturnType<typeof setTimeout> }
>();

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
  return (await requestCoordinator({ kind: "rate-limit.consume", limiterId, clientKey, maxRequests, duration })) === true;
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
  const delivered = await requestCoordinator({ kind: "realtime.publish", event });
  if (delivered !== true) {
    throw new Error("PocketBun cluster realtime publication failed");
  }
}

export async function prepareClusterRealtimeDelete(eventId: string, collectionId: string, recordJson: string): Promise<void> {
  const prepared = await requestCoordinator({ kind: "realtime.prepare", eventId, collectionId, recordJson });
  if (prepared !== true) {
    throw new Error("PocketBun cluster realtime delete preparation failed");
  }
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

async function handleCoordinatorDelivery(requestId: string, operation: import("./protocol.ts").CoordinatorDeliveryOperation) {
  const workerId = clusterWorkerId();
  if (workerId === null) {
    return;
  }
  try {
    let value: string;
    if (operation.kind === "realtime.publish") {
      const handler = getClusterRealtimeEventHandler();
      if (!handler) {
        throw new Error("PocketBun cluster realtime delivery handler is not registered");
      }
      await handler(operation.event);
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

function requestCoordinator(operation: CoordinatorOperation): Promise<CoordinatorValue> {
  const workerId = clusterWorkerId();
  if (workerId === null) {
    return Promise.reject(new Error("PocketBun cluster worker is not configured"));
  }
  const requestId = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingCoordinatorRequests.delete(requestId);
      reject(new Error(`PocketBun cluster coordinator request timed out after ${coordinatorTimeoutMs}ms`));
    }, coordinatorTimeoutMs);
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
}

function send(message: WorkerToPrimaryMessage): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!process.send) {
      reject(new Error("PocketBun cluster worker has no primary IPC channel"));
      return;
    }
    const sent = process.send(message, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
    if (!sent) {
      reject(new Error("PocketBun cluster worker IPC channel is closed"));
    }
  });
}

function isWorkerRole(value: unknown): value is ClusterWorkerRole {
  return value === "leader" || value === "follower";
}
