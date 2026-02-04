// PocketBun-only: local benchmark server bootstrap with seeded data.

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BaseApp, serve } from "../index.ts";
import { NewBaseCollection } from "../src/core/collection_model.ts";
import { TextField } from "../src/core/field_text.ts";
import { NewRecord } from "../src/core/record_model.ts";

const port = Number.parseInt(process.env.POCKETBUN_BENCH_PORT ?? "8092", 10);
const recordCount = Number.parseInt(process.env.POCKETBUN_BENCH_RECORDS ?? "1000", 10);

const dataDir = await mkdtemp(join(tmpdir(), "pocketbun-bench-"));
const app = new BaseApp({ dataDir });
app.bootstrap();
app.runAllMigrations();

const collection = NewBaseCollection("bench_items");
collection.ListRule = "1=1";
collection.ViewRule = "1=1";
collection.Fields.Add(Object.assign(new TextField(), { Name: "title" }));

const collectionErr = await app.Save(collection);
if (collectionErr) {
  throw new Error(`failed to create bench collection: ${collectionErr.message}`);
}

for (let i = 0; i < recordCount; i += 1) {
  const record = NewRecord(collection);
  record.Set("title", `Item ${i}`);
  const err = await app.Save(record);
  if (err) {
    throw new Error(`failed to seed bench record: ${err.message}`);
  }
}

const server = serve(app, { httpAddr: `127.0.0.1:${port}` });

const shutdown = async () => {
  await server.stop();
  app.resetBootstrapState();
  await rm(dataDir, { recursive: true, force: true });
  process.exit(0);
};

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

console.log(`READY ${port} ${recordCount}`);
process.stdin.resume();
