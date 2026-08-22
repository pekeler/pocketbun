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

export type CoordinatorOperation =
  | { kind: "rate-limit.consume"; limiterId: string; clientKey: string; maxRequests: number; duration: number }
  | { kind: "rate-limit.check"; limiterId: string; clientKey: string }
  | { kind: "expiring.claim"; key: string; ttlMs: number }
  | { kind: "expiring.release"; key: string; claimToken: string }
  | { kind: "expiring.put"; key: string; value: string; ttlMs: number }
  | { kind: "expiring.take"; key: string }
  | { kind: "realtime.publish"; event: RealtimeBroadcastEvent }
  | { kind: "realtime.prepare"; eventId: string; collectionId: string; recordJson: string }
  | { kind: "realtime.subscribe"; clientId: string; requestJson: string }
  | { kind: "oauth2.deliver"; clientId: string; requestIP: string; data: string; mode: "probe" | "deliver" };

export type CoordinatorValue = boolean | string | null;

export type CoordinatorRequestMessage = {
  version: typeof ClusterProtocolVersion;
  kind: "coordinator.request";
  token: string;
  requestId: string;
  workerId: number;
  operation: CoordinatorOperation;
};

export type CoordinatorResponseMessage = {
  version: typeof ClusterProtocolVersion;
  kind: "coordinator.response";
  token: string;
  requestId: string;
  ok: boolean;
  value?: CoordinatorValue;
  error?: { message: string };
};

export type RealtimeBroadcastEvent =
  | { kind: "record"; eventId: string; action: "create" | "update"; collectionId: string; recordJson: string }
  | { kind: "delete.commit" | "delete.abort"; eventId: string }
  | { kind: "auth.record-update"; collectionId: string; recordJson: string }
  | { kind: "auth.record-delete"; collectionName: string; recordId: string }
  | { kind: "auth.collection"; collectionName: string };

export type CoordinatorDeliveryOperation =
  | Extract<CoordinatorOperation, { kind: "realtime.publish" }>
  | Extract<CoordinatorOperation, { kind: "realtime.prepare" }>
  | Extract<CoordinatorOperation, { kind: "realtime.subscribe" }>
  | Extract<CoordinatorOperation, { kind: "oauth2.deliver" }>;

export type CoordinatorDeliveryMessage = {
  version: typeof ClusterProtocolVersion;
  kind: "coordinator.delivery";
  token: string;
  requestId: string;
  operation: CoordinatorDeliveryOperation;
};

export type CoordinatorDeliveryResultMessage = {
  version: typeof ClusterProtocolVersion;
  kind: "coordinator.delivery-result";
  token: string;
  requestId: string;
  workerId: number;
  ok: boolean;
  value?: string;
  error?: { message: string };
};

export type WorkerToPrimaryMessage =
  | WorkerReadyMessage
  | WorkerStoppedMessage
  | CoordinatorRequestMessage
  | CoordinatorDeliveryResultMessage;
export type PrimaryToWorkerMessage = ControlShutdownMessage | CoordinatorResponseMessage | CoordinatorDeliveryMessage;
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

  if (value.kind === "coordinator.request") {
    if (
      !hasToken(value) ||
      !isNonEmptyString(value.requestId) ||
      !isPositiveInteger(value.workerId) ||
      !isCoordinatorOperation(value.operation)
    ) {
      return null;
    }
    return value as CoordinatorRequestMessage;
  }

  if (value.kind === "coordinator.response") {
    if (!hasToken(value) || !isNonEmptyString(value.requestId) || typeof value.ok !== "boolean") {
      return null;
    }
    if (value.ok) {
      if (value.value !== undefined && !isCoordinatorValue(value.value)) {
        return null;
      }
    } else if (!isPlainRecord(value.error) || !isNonEmptyString(value.error.message)) {
      return null;
    }
    return value as CoordinatorResponseMessage;
  }

  if (value.kind === "coordinator.delivery") {
    if (!hasToken(value) || !isNonEmptyString(value.requestId) || !isCoordinatorDeliveryOperation(value.operation)) {
      return null;
    }
    return value as CoordinatorDeliveryMessage;
  }

  if (value.kind === "coordinator.delivery-result") {
    if (
      !hasToken(value) ||
      !isNonEmptyString(value.requestId) ||
      !isPositiveInteger(value.workerId) ||
      typeof value.ok !== "boolean"
    ) {
      return null;
    }
    if (value.ok) {
      if (value.value !== undefined && typeof value.value !== "string") {
        return null;
      }
    } else if (!isPlainRecord(value.error) || !isNonEmptyString(value.error.message)) {
      return null;
    }
    return value as CoordinatorDeliveryResultMessage;
  }

  return null;
}

function isCoordinatorOperation(value: unknown): value is CoordinatorOperation {
  if (!isPlainRecord(value) || typeof value.kind !== "string") {
    return false;
  }
  if (value.kind === "rate-limit.consume") {
    return (
      isNonEmptyString(value.limiterId) &&
      isNonEmptyString(value.clientKey) &&
      isPositiveInteger(value.maxRequests) &&
      isPositiveNumber(value.duration)
    );
  }
  if (value.kind === "rate-limit.check") {
    return isNonEmptyString(value.limiterId) && isNonEmptyString(value.clientKey);
  }
  if (value.kind === "expiring.claim" || value.kind === "expiring.put") {
    return (
      isNonEmptyString(value.key) &&
      isPositiveInteger(value.ttlMs) &&
      (value.kind !== "expiring.put" || typeof value.value === "string")
    );
  }
  if (value.kind === "expiring.release") {
    return isNonEmptyString(value.key) && isNonEmptyString(value.claimToken);
  }
  if (value.kind === "expiring.take") {
    return isNonEmptyString(value.key);
  }
  if (value.kind === "realtime.publish") {
    return isRealtimeBroadcastEvent(value.event);
  }
  if (value.kind === "realtime.prepare") {
    return isNonEmptyString(value.eventId) && isNonEmptyString(value.collectionId) && isNonEmptyString(value.recordJson);
  }
  if (value.kind === "realtime.subscribe") {
    return isNonEmptyString(value.clientId) && isNonEmptyString(value.requestJson);
  }
  if (value.kind === "oauth2.deliver") {
    return (
      isNonEmptyString(value.clientId) &&
      typeof value.requestIP === "string" &&
      isNonEmptyString(value.data) &&
      (value.mode === "probe" || value.mode === "deliver")
    );
  }
  return false;
}

function isCoordinatorDeliveryOperation(value: unknown): value is CoordinatorDeliveryOperation {
  return (
    isCoordinatorOperation(value) &&
    (value.kind === "realtime.publish" ||
      value.kind === "realtime.prepare" ||
      value.kind === "realtime.subscribe" ||
      value.kind === "oauth2.deliver")
  );
}

function isRealtimeBroadcastEvent(value: unknown): value is RealtimeBroadcastEvent {
  if (!isPlainRecord(value) || typeof value.kind !== "string") {
    return false;
  }
  if (value.kind === "record") {
    return (
      isNonEmptyString(value.eventId) &&
      (value.action === "create" || value.action === "update") &&
      isNonEmptyString(value.collectionId) &&
      isNonEmptyString(value.recordJson)
    );
  }
  if (value.kind === "delete.commit" || value.kind === "delete.abort") {
    return isNonEmptyString(value.eventId);
  }
  if (value.kind === "auth.record-update") {
    return isNonEmptyString(value.collectionId) && isNonEmptyString(value.recordJson);
  }
  if (value.kind === "auth.record-delete") {
    return isNonEmptyString(value.collectionName) && isNonEmptyString(value.recordId);
  }
  if (value.kind === "auth.collection") {
    return isNonEmptyString(value.collectionName);
  }
  return false;
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

function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isCoordinatorValue(value: unknown): value is CoordinatorValue {
  return value === null || typeof value === "boolean" || typeof value === "string";
}

function isPort(value: unknown): value is number {
  return isPositiveInteger(value) && value <= 65_535;
}
