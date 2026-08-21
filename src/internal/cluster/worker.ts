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
} from "./context.ts";
import { ClusterProtocolVersion, parseClusterMessage, type ClusterWorkerRole } from "./protocol.ts";

let attached = false;
let shutdownRequested = false;

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
    if (!message || message.kind !== "control.shutdown" || message.token !== token) {
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

function send(message: Parameters<NonNullable<typeof process.send>>[0]): Promise<void> {
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
