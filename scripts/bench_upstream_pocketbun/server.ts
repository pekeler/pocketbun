// PocketBun-only benchmark helper: runs the benchmark app in a dedicated process so
// the benchmark requester and server do not contend on the same Bun event loop.

import { fileURLToPath } from "node:url";
import { mustRegisterServerJS, newPocketBaseWithConfig, serve } from "../../index.ts";
import { CollectionNameSuperusers } from "../../src/core/collection_model.ts";
import { NewRecord } from "../../src/core/record_model.ts";
import {
  ClusterEnvRole,
  MaxClusterWorkers,
  clusterEnabled,
  clusterWorkerAddress,
  runsClusterSingletons,
} from "../../src/internal/cluster/context.ts";
import { registerBenchmarkModule } from "./module.ts";

const port = parsePort(process.env.POCKETBUN_BENCH_SERVER_PORT);
const workers = parseWorkers(process.env.POCKETBUN_BENCH_SERVER_WORKERS);
const dataDir = process.env.POCKETBUN_BENCH_SERVER_DATA_DIR?.trim();
if (!dataDir) {
  throw new Error("POCKETBUN_BENCH_SERVER_DATA_DIR is required");
}

const baseUrl = process.env.POCKETBUN_BENCH_SERVER_BASE_URL?.trim() || `http://127.0.0.1:${port}`;
const hooksDir =
  process.env.POCKETBUN_BENCH_SERVER_HOOKS_DIR?.trim() ||
  fileURLToPath(new URL("../../vendor/pocketbase-benchmarks/pb_hooks", import.meta.url));

if (workers > 1 && !process.env[ClusterEnvRole]) {
  const { runClusterPrimary } = await import("../../src/internal/cluster/primary.ts");
  await runClusterPrimary({ workers, dataDir, httpAddr: `127.0.0.1:${port}`, showStartBanner: false });
  process.exit(0);
}
if (process.env[ClusterEnvRole]) {
  const { attachClusterWorker } = await import("../../src/internal/cluster/worker.ts");
  attachClusterWorker();
}

const app = newPocketBaseWithConfig({
  hideStartBanner: true,
  defaultDataDir: dataDir,
  defaultQueryTimeout: 120,
});

mustRegisterServerJS(app, {
  hooksPoolSize: 50,
  hooksDir,
});
registerBenchmarkModule(app, baseUrl);

app.OnServe().BindFunc((event) => {
  return event.Next();
});

if (!app.isBootstrapped()) {
  app.bootstrap();
}
if (runsClusterSingletons()) {
  app.runAllMigrations();
  await ensureDefaultSuperuser(app);
}

if (clusterEnabled()) {
  const { registerClusterWorkerApp } = await import("../../src/internal/cluster/worker.ts");
  registerClusterWorkerApp(app);
}

const server = serve(app, { httpAddr: clusterWorkerAddress() || `127.0.0.1:${port}` });
if (clusterEnabled()) {
  const { notifyClusterWorkerReady, registerClusterWorkerServerStop } = await import("../../src/internal/cluster/worker.ts");
  registerClusterWorkerServerStop(() => Promise.resolve(server.stop(true)));
  await notifyClusterWorkerReady(server);
}

let stopping = false;
const stop = async (): Promise<void> => {
  if (stopping) {
    return;
  }
  stopping = true;
  await server.stop();
  app.resetBootstrapState();
  if (clusterEnabled()) {
    const { notifyClusterWorkerStopped } = await import("../../src/internal/cluster/worker.ts");
    await notifyClusterWorkerStopped();
  }
  process.exit(0);
};

process.on("SIGINT", () => {
  void stop();
});
process.on("SIGTERM", () => {
  void stop();
});

await new Promise<void>(() => {});

function parsePort(raw: string | undefined): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 65535) {
    throw new Error("POCKETBUN_BENCH_SERVER_PORT must be a valid TCP port");
  }
  return parsed;
}

function parseWorkers(raw: string | undefined): number {
  const value = raw ?? "1";
  if (!/^\d+$/.test(value)) {
    throw new Error(`POCKETBUN_BENCH_SERVER_WORKERS must be an integer between 1 and ${MaxClusterWorkers}`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > MaxClusterWorkers) {
    throw new Error(`POCKETBUN_BENCH_SERVER_WORKERS must be an integer between 1 and ${MaxClusterWorkers}`);
  }
  return parsed;
}

async function ensureDefaultSuperuser(app: ReturnType<typeof newPocketBaseWithConfig>): Promise<void> {
  if (app.countRecords(CollectionNameSuperusers) > 0) {
    return;
  }

  const superusersCollection = app.findCollectionByNameOrId(CollectionNameSuperusers);
  const superuser = NewRecord(superusersCollection);
  superuser.Set("email", "test@example.com");
  superuser.Set("password", "1234567890");

  const saveErr = await app.save(superuser);
  if (saveErr) {
    throw new Error(`failed to create benchmark superuser: ${saveErr.message}`);
  }
}
