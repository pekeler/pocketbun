// PocketBun-only: runs the vendored upstream PocketBase benchmark suite locally.

import type { AddressInfo } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const benchmarkRun = "create,auth,search,custom,delete";
const resultFile = "/tmp/pocketbase-benchmarks-latest.txt";
const serverReadyTimeoutMs = 60_000;
const benchmarkTimeoutMs = 90 * 60_000;
const pollIntervalMs = 5_000;

const goBinary = process.env.POCKETBUN_GO_BIN ?? "/opt/homebrew/bin/go";
const port = await pickPort();
const baseUrl = `http://127.0.0.1:${port}`;
const dataDir = await mkdtemp(join(tmpdir(), "pocketbase-benchmarks-"));

const serverProc = Bun.spawn({
  cmd: [goBinary, "run", ".", "serve", `--http=127.0.0.1:${port}`, `--dir=${dataDir}`],
  cwd: "vendor/pocketbase-benchmarks",
  env: { ...process.env },
  stdio: ["ignore", "inherit", "inherit"],
});

try {
  await ensureServerReady();

  const trigger = await fetch(`${baseUrl}/benchmarks?run=${encodeURIComponent(benchmarkRun)}`);
  if (!trigger.ok) {
    throw new Error(`failed to start upstream benchmarks: HTTP ${trigger.status}`);
  }

  const triggerText = (await trigger.text()).trim();
  console.log(`\nUpstream benchmark trigger response: ${triggerText}`);
  console.log(`Waiting for completion (run=${benchmarkRun})...`);

  const token = await authSuperuser();
  const result = await waitForBenchmarkResult(token);

  console.log("\nUpstream benchmark result");
  console.log(`  tests: ${String(result.tests ?? "")}`);
  if (typeof result.error === "string" && result.error !== "") {
    console.log(`  error: ${result.error}`);
    throw new Error(`upstream benchmark reported error: ${result.error}`);
  }
  console.log("  status: completed");
  console.log("\nResult body:");
  const resultBody = String(result.result ?? "").trim();
  console.log(resultBody || "(empty)");
  await writeFile(resultFile, `${resultBody}\n`);
  console.log(`\nSaved full result to: ${resultFile}`);
} finally {
  serverProc.kill();
  await serverProc.exited;
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

  throw new Error("upstream benchmark server did not become ready in time");
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

  throw new Error("timed out waiting for upstream benchmark completion");
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
