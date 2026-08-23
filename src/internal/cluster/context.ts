// PocketBun-only: process-local cluster state keeps Bun cluster details out of ported application code.

export type ClusterRole = "disabled" | "leader" | "follower";

export const ClusterEnvRole = "POCKETBUN_CLUSTER_ROLE";
export const ClusterEnvSlot = "POCKETBUN_CLUSTER_SLOT";
export const ClusterEnvAddress = "POCKETBUN_CLUSTER_ADDRESS";
export const ClusterEnvReusePort = "POCKETBUN_CLUSTER_REUSE_PORT";
export const ClusterEnvToken = "POCKETBUN_CLUSTER_TOKEN";
export const ClusterEnvWorkerId = "POCKETBUN_CLUSTER_WORKER_ID";
export const MaxClusterWorkers = 256;

export type ClusterRealtimeEvent = import("./protocol.ts").RealtimeBroadcastEvent;
type ClusterRealtimeEventHandler = (event: ClusterRealtimeEvent) => void | Promise<void>;
type ClusterRealtimePrepareHandler = (
  operation: Extract<import("./protocol.ts").CoordinatorDeliveryOperation, { kind: "realtime.prepare" }>,
) => string | Promise<string>;
type ClusterRealtimeSubscribeHandler = (
  operation: Extract<import("./protocol.ts").CoordinatorDeliveryOperation, { kind: "realtime.subscribe" }>,
) => string | Promise<string>;
type ClusterOAuth2DeliveryHandler = (
  operation: Extract<import("./protocol.ts").CoordinatorDeliveryOperation, { kind: "oauth2.deliver" }>,
) => string | Promise<string>;
type ClusterBackupFilesystemHandler = (
  operation: Extract<
    import("./protocol.ts").CoordinatorDeliveryOperation,
    { kind: "backup.file-delete" | "backup.file-write" }
  >,
) => string | Promise<string>;

type WorkerContext = {
  role: Exclude<ClusterRole, "disabled">;
  slot: number;
  address: string;
  reusePort: boolean;
  token: string;
  workerId: number;
};

let workerContext: WorkerContext | null = null;
let realtimeEventHandler: ClusterRealtimeEventHandler | null = null;
let realtimePrepareHandler: ClusterRealtimePrepareHandler | null = null;
let realtimeSubscribeHandler: ClusterRealtimeSubscribeHandler | null = null;
let oauth2DeliveryHandler: ClusterOAuth2DeliveryHandler | null = null;
let backupFilesystemHandler: ClusterBackupFilesystemHandler | null = null;

export function configureClusterWorker(context: WorkerContext): void {
  if (workerContext) {
    throw new Error("PocketBun cluster worker context is already configured");
  }
  workerContext = context;
}

export function clusterRole(): ClusterRole {
  return workerContext?.role ?? "disabled";
}

export function clusterWorkerId(): number | null {
  return workerContext?.workerId ?? null;
}

export function clusterWorkerSlot(): number | null {
  return workerContext?.slot ?? null;
}

export function clusterWorkerAddress(): string {
  return workerContext?.address ?? "";
}

export function clusterReusePort(): boolean {
  return workerContext?.reusePort ?? false;
}

export function clusterEnabled(): boolean {
  return workerContext !== null;
}

// Singleton startup and scheduled work run normally outside cluster mode and
// only in the durable leader role inside it.
export function runsClusterSingletons(): boolean {
  return workerContext?.role !== "follower";
}

export function validateWorkerCount(workers: number): Error | null {
  if (!Number.isSafeInteger(workers) || workers < 1 || workers > MaxClusterWorkers) {
    return new Error(`--workers must be an integer between 1 and ${MaxClusterWorkers}`);
  }
  return null;
}

export function clusterToken(): string {
  return workerContext?.token ?? "";
}

export function registerClusterRealtimeEventHandler(handler: ClusterRealtimeEventHandler): void {
  realtimeEventHandler = handler;
}

export function registerClusterRealtimePrepareHandler(handler: ClusterRealtimePrepareHandler): void {
  realtimePrepareHandler = handler;
}

export function registerClusterRealtimeSubscribeHandler(handler: ClusterRealtimeSubscribeHandler): void {
  realtimeSubscribeHandler = handler;
}

export function registerClusterOAuth2DeliveryHandler(handler: ClusterOAuth2DeliveryHandler): void {
  oauth2DeliveryHandler = handler;
}

export function registerClusterBackupFilesystemHandler(handler: ClusterBackupFilesystemHandler | null): void {
  backupFilesystemHandler = handler;
}

export function getClusterRealtimeEventHandler(): ClusterRealtimeEventHandler | null {
  return realtimeEventHandler;
}

export function getClusterRealtimePrepareHandler(): ClusterRealtimePrepareHandler | null {
  return realtimePrepareHandler;
}

export function getClusterRealtimeSubscribeHandler(): ClusterRealtimeSubscribeHandler | null {
  return realtimeSubscribeHandler;
}

export function getClusterOAuth2DeliveryHandler(): ClusterOAuth2DeliveryHandler | null {
  return oauth2DeliveryHandler;
}

export function getClusterBackupFilesystemHandler(): ClusterBackupFilesystemHandler | null {
  return backupFilesystemHandler;
}

export function resetClusterContextForTest(): void {
  workerContext = null;
  realtimeEventHandler = null;
  realtimePrepareHandler = null;
  realtimeSubscribeHandler = null;
  oauth2DeliveryHandler = null;
  backupFilesystemHandler = null;
}
