// PocketBun-only: validates the private plain-value IPC protocol between the cluster primary and workers.

export const ClusterProtocolVersion = 1;

export type ClusterWorkerRole = "leader" | "follower";

export type WorkerReadyMessage = {
  version: typeof ClusterProtocolVersion;
  kind: "worker.ready";
  token: string;
  role: ClusterWorkerRole;
  slot: number;
  workerId: number;
  pid: number;
  hostname: string;
  port: number;
};

export type WorkerStoppedMessage = {
  version: typeof ClusterProtocolVersion;
  kind: "worker.stopped";
  token: string;
  workerId: number;
};

export type ControlShutdownMessage = {
  version: typeof ClusterProtocolVersion;
  kind: "control.shutdown";
  token: string;
  force: boolean;
};

export type WorkerToPrimaryMessage = WorkerReadyMessage | WorkerStoppedMessage;
export type PrimaryToWorkerMessage = ControlShutdownMessage;
export type ClusterMessage = WorkerToPrimaryMessage | PrimaryToWorkerMessage;

export function parseClusterMessage(value: unknown): ClusterMessage | null {
  if (!isPlainRecord(value) || value.version !== ClusterProtocolVersion || typeof value.kind !== "string") {
    return null;
  }

  if (value.kind === "worker.ready") {
    if (
      !hasToken(value) ||
      !isWorkerRole(value.role) ||
      !isNonNegativeInteger(value.slot) ||
      !isPositiveInteger(value.workerId) ||
      !isPositiveInteger(value.pid) ||
      typeof value.hostname !== "string" ||
      !isPort(value.port)
    ) {
      return null;
    }
    return value as WorkerReadyMessage;
  }

  if (value.kind === "worker.stopped") {
    if (!hasToken(value) || !isPositiveInteger(value.workerId)) {
      return null;
    }
    return value as WorkerStoppedMessage;
  }

  if (value.kind === "control.shutdown") {
    if (!hasToken(value) || typeof value.force !== "boolean") {
      return null;
    }
    return value as ControlShutdownMessage;
  }

  return null;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasToken(value: Record<string, unknown>): value is Record<string, unknown> & { token: string } {
  return typeof value.token === "string" && value.token.length > 0;
}

function isWorkerRole(value: unknown): value is ClusterWorkerRole {
  return value === "leader" || value === "follower";
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function isPort(value: unknown): value is number {
  return isPositiveInteger(value) && value <= 65_535;
}
