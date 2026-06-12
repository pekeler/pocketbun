// PocketBun-only benchmark helper: runs the benchmark app in a dedicated process so
// the benchmark requester and server do not contend on the same Bun event loop.

import { fileURLToPath } from "node:url";
import { mustRegisterServerJS, newPocketBaseWithConfig, serve } from "../../index.ts";
import { CollectionNameSuperusers } from "../../src/core/collection_model.ts";
import { NewRecord } from "../../src/core/record_model.ts";
import { registerBenchmarkModule } from "./module.ts";

const port = parsePort(process.env.POCKETBUN_BENCH_SERVER_PORT);
const dataDir = process.env.POCKETBUN_BENCH_SERVER_DATA_DIR?.trim();
if (!dataDir) {
  throw new Error("POCKETBUN_BENCH_SERVER_DATA_DIR is required");
}

const baseUrl = process.env.POCKETBUN_BENCH_SERVER_BASE_URL?.trim() || `http://127.0.0.1:${port}`;
const hooksDir =
  process.env.POCKETBUN_BENCH_SERVER_HOOKS_DIR?.trim() ||
  fileURLToPath(new URL("../../vendor/pocketbase-benchmarks/pb_hooks", import.meta.url));

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
app.runAllMigrations();
await ensureDefaultSuperuser(app);

const server = serve(app, { httpAddr: `127.0.0.1:${port}` });

let stopping = false;
const stop = async (): Promise<void> => {
  if (stopping) {
    return;
  }
  stopping = true;
  await server.stop();
  app.resetBootstrapState();
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
