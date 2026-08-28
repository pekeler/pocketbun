// PocketBun-only: shares cluster role selection between CLI and programmatic entrypoints.

import type { ClusterPrimaryOptions } from "./primary.ts";
import { ClusterEnvRole } from "./context.ts";

// Returns only in a worker; the primary supervises until shutdown and then exits.
export async function runClusterEntrypoint(options: ClusterPrimaryOptions): Promise<void> {
  if (process.env[ClusterEnvRole]) {
    const { attachClusterWorker } = await import("./worker.ts");
    attachClusterWorker();
    return;
  }

  const { runClusterPrimary } = await import("./primary.ts");
  await runClusterPrimary(options);
  process.exit(0);
}
