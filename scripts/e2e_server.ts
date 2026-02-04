// PocketBun-only: Playwright webServer entrypoint for end-to-end tests.

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BaseApp, serve, superuserUpsert } from "../index.ts";

const email = process.env.POCKETBUN_E2E_EMAIL ?? "admin@example.com";
const password = process.env.POCKETBUN_E2E_PASSWORD ?? "change-me";
const port = Number.parseInt(process.env.POCKETBUN_E2E_PORT ?? "8091", 10);

const dataDir = await mkdtemp(join(tmpdir(), "pocketbun-e2e-"));
const app = new BaseApp({ dataDir });
app.bootstrap();

await superuserUpsert(app, email, password);

const server = serve(app, { httpAddr: `127.0.0.1:${port}` });

const shutdown = async () => {
  await server.stop();
  app.resetBootstrapState();
  await rm(dataDir, { recursive: true, force: true });
  process.exit(0);
};

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

process.stdin.resume();
