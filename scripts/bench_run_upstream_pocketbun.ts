// PocketBun-only: runs a PocketBun-native port of the upstream pocketbase/benchmarks app.

import type { AddressInfo } from "node:net";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { MustRegisterJSVM, NewWithConfig, serve } from "../index.ts";
import { CollectionNameSuperusers } from "../src/core/collection_model.ts";
import { NewRecord } from "../src/core/record_model.ts";
import { registerBenchmarkModule } from "./bench_upstream_pocketbun/module.ts";

const benchmarkRun = process.env.POCKETBUN_BENCHMARK_RUN ?? "create,auth,search,custom,delete";
const resultFile = process.env.POCKETBUN_BENCHMARK_RESULT_FILE ?? "/tmp/pocketbun-benchmarks-latest.txt";
const serverReadyTimeoutMs = 60_000;
const benchmarkTimeoutMs = 120 * 60_000;
const pollIntervalMs = 5_000;

const hooksDir = fileURLToPath(new URL("../vendor/pocketbase-benchmarks/pb_hooks", import.meta.url));
const port = await pickPort();
const baseUrl = `http://127.0.0.1:${port}`;
const dataDir = await mkdtemp(join(tmpdir(), "pocketbun-benchmarks-"));

const app = NewWithConfig({
  HideStartBanner: true,
  DefaultDataDir: dataDir,
  DefaultQueryTimeout: 120,
});

MustRegisterJSVM(app, {
  HooksPoolSize: 50,
  HooksDir: hooksDir,
});
registerBenchmarkModule(app, baseUrl);
if (!app.isBootstrapped()) {
  app.bootstrap();
}
app.runAllMigrations();
await ensureDefaultSuperuser();

const server = serve(app, { httpAddr: `127.0.0.1:${port}` });

try {
  await ensureServerReady();

  const trigger = await fetch(`${baseUrl}/benchmarks?run=${encodeURIComponent(benchmarkRun)}`);
  if (!trigger.ok) {
    throw new Error(`failed to start PocketBun upstream benchmarks: HTTP ${trigger.status}`);
  }

  const triggerText = (await trigger.text()).trim();
  console.log(`\nPocketBun benchmark trigger response: ${triggerText}`);
  console.log(`Waiting for completion (run=${benchmarkRun})...`);

  const token = await authSuperuser();
  const result = await waitForBenchmarkResult(token);

  console.log("\nPocketBun upstream benchmark result");
  console.log(`  tests: ${String(result.tests ?? "")}`);
  if (typeof result.error === "string" && result.error !== "") {
    console.log(`  error: ${result.error}`);
    throw new Error(`PocketBun benchmark reported error: ${result.error}`);
  }
  console.log("  status: completed");
  console.log("\nResult body:");
  const resultBody = String(result.result ?? "").trim();
  console.log(resultBody || "(empty)");
  await writeFile(resultFile, `${resultBody}\n`);
  console.log(`\nSaved full result to: ${resultFile}`);
} finally {
  await server.stop();
  app.resetBootstrapState();
  await rm(dataDir, { recursive: true, force: true });
}

async function ensureServerReady(): Promise<void> {
  const deadline = Date.now() + serverReadyTimeoutMs;

  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${baseUrl}/api/health`);
      if (res.ok) {
        return;
      }
    } catch {
      // retry
    }

    await delay(250);
  }

  throw new Error("PocketBun benchmark server did not become ready in time");
}

async function authSuperuser(): Promise<string> {
  const response = await fetch(`${baseUrl}/api/collections/_superusers/auth-with-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      identity: "test@example.com",
      password: "1234567890",
    }),
  });

  if (!response.ok) {
    throw new Error(`superuser auth failed: HTTP ${response.status}`);
  }

  const payload = (await response.json()) as { token?: string };
  const token = payload.token ?? "";
  if (!token) {
    throw new Error("superuser auth response missing token");
  }

  return token;
}

async function ensureDefaultSuperuser(): Promise<void> {
  if (app.CountRecords(CollectionNameSuperusers) > 0) {
    return;
  }

  const superusersCollection = app.FindCollectionByNameOrId(CollectionNameSuperusers);
  const superuser = NewRecord(superusersCollection);
  superuser.Set("email", "test@example.com");
  superuser.Set("password", "1234567890");

  const saveErr = await app.Save(superuser);
  if (saveErr) {
    throw new Error(`failed to create benchmark superuser: ${saveErr.message}`);
  }
}

async function waitForBenchmarkResult(token: string): Promise<{ tests?: unknown; result?: unknown; error?: unknown }> {
  const deadline = Date.now() + benchmarkTimeoutMs;

  while (Date.now() < deadline) {
    const response = await fetch(`${baseUrl}/api/collections/benchmarks/records?sort=-created&perPage=1`, {
      headers: {
        Authorization: token,
      },
    });

    if (response.ok) {
      const payload = (await response.json()) as {
        items?: Array<{ tests?: unknown; result?: unknown; error?: unknown }>;
      };

      const latest = payload.items?.[0];
      if (latest && latest.tests === benchmarkRun) {
        return latest;
      }
    }

    await delay(pollIntervalMs);
  }

  throw new Error("timed out waiting for PocketBun benchmark completion");
}

async function pickPort(): Promise<number> {
  return await new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address() as AddressInfo;
      const selected = address.port;
      server.close((err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(selected);
      });
    });
  });
}
