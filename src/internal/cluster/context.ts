// PocketBun-only: process-local cluster state keeps Bun cluster details out of ported application code.

export type ClusterRole = "disabled" | "leader" | "follower";

export const ClusterEnvRole = "POCKETBUN_CLUSTER_ROLE";
export const ClusterEnvSlot = "POCKETBUN_CLUSTER_SLOT";
export const ClusterEnvAddress = "POCKETBUN_CLUSTER_ADDRESS";
export const ClusterEnvReusePort = "POCKETBUN_CLUSTER_REUSE_PORT";
export const ClusterEnvToken = "POCKETBUN_CLUSTER_TOKEN";
export const ClusterEnvWorkerId = "POCKETBUN_CLUSTER_WORKER_ID";
export const MaxClusterWorkers = 256;

type WorkerContext = {
  role: Exclude<ClusterRole, "disabled">;
  slot: number;
  address: string;
  reusePort: boolean;
  token: string;
  workerId: number;
};

let workerContext: WorkerContext | null = null;

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

export function validateWorkerCount(workers: number): Error | null {
  if (!Number.isSafeInteger(workers) || workers < 1 || workers > MaxClusterWorkers) {
    return new Error(`--workers must be an integer between 1 and ${MaxClusterWorkers}`);
  }
  return null;
}

export function clusterToken(): string {
  return workerContext?.token ?? "";
}

export function resetClusterContextForTest(): void {
  workerContext = null;
}
