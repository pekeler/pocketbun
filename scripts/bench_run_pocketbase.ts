// PocketBun-only: local benchmark runner for upstream PocketBase.

import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import type { AddressInfo } from "node:net";

type BenchTarget = {
  name: string;
  path: string;
};

type BenchResult = {
  requests: number;
  errors: number;
  durationMs: number;
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
  rps: number;
};

const concurrency = Number.parseInt(process.env.POCKETBUN_BENCH_CONCURRENCY ?? "32", 10);
const durationMs = Number.parseInt(process.env.POCKETBUN_BENCH_DURATION_MS ?? "15000", 10);
const recordCount = Number.parseInt(process.env.POCKETBUN_BENCH_RECORDS ?? "1000", 10);

const port = await pickPort();
const baseUrl = process.env.POCKETBUN_BENCH_BASE_URL ?? `http://127.0.0.1:${port}`;

const serverProc = Bun.spawn({
  cmd: ["go", "run", "."],
  cwd: "scripts/bench_pocketbase",
  env: {
    ...process.env,
    POCKETBUN_BENCH_PORT: String(port),
    POCKETBUN_BENCH_RECORDS: String(recordCount),
  },
  stdio: ["inherit", "inherit", "inherit"],
});

const ensureServerReady = async () => {
  const timeoutMs = 20_000;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${baseUrl}/api/health`);
      if (res.ok) {
        return;
      }
    } catch {
      // retry
    }
    await delay(200);
  }
  throw new Error("bench server did not become ready in time");
};

const targets: BenchTarget[] = [
  { name: "health", path: "/api/health" },
  { name: "admin_ui", path: "/_/" },
  { name: "records_list", path: "/api/collections/bench_items/records?page=1&perPage=30" },
];

try {
  await ensureServerReady();

  console.log(`\nPocketBase local benchmark (concurrency=${concurrency}, duration=${durationMs}ms)`);
  console.log(`baseUrl=${baseUrl}`);

  for (const target of targets) {
    const result = await runBench(`${baseUrl}${target.path}`, concurrency, durationMs);
    logResult(target.name, result);
  }
} finally {
  serverProc.kill();
  await serverProc.exited;
}

function logResult(name: string, result: BenchResult): void {
  console.log(`\n${name}`);
  console.log(`  requests: ${result.requests}`);
  console.log(`  errors:   ${result.errors}`);
  console.log(`  rps:      ${result.rps.toFixed(1)}`);
  console.log(`  avg:      ${result.avgMs.toFixed(2)} ms`);
  console.log(`  p50:      ${result.p50Ms.toFixed(2)} ms`);
  console.log(`  p95:      ${result.p95Ms.toFixed(2)} ms`);
}

async function runBench(url: string, workers: number, duration: number): Promise<BenchResult> {
  const durations: number[] = [];
  let requests = 0;
  let errors = 0;
  const start = performance.now();
  const end = start + duration;

  const tasks = Array.from({ length: workers }, async () => {
    while (performance.now() < end) {
      const t0 = performance.now();
      try {
        const res = await fetch(url);
        await res.arrayBuffer();
        if (!res.ok) {
          errors += 1;
        } else {
          requests += 1;
        }
      } catch {
        errors += 1;
      } finally {
        durations.push(performance.now() - t0);
      }
    }
  });

  await Promise.all(tasks);

  const elapsedMs = performance.now() - start;
  const avgMs = durations.length > 0 ? durations.reduce((sum, v) => sum + v, 0) / durations.length : 0;
  const p50Ms = percentile(durations, 50);
  const p95Ms = percentile(durations, 95);
  const rps = elapsedMs > 0 ? requests / (elapsedMs / 1000) : 0;

  return {
    requests,
    errors,
    durationMs: elapsedMs,
    avgMs,
    p50Ms,
    p95Ms,
    rps,
  };
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(((p / 100) * (sorted.length - 1)))));
  return sorted[idx] ?? 0;
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
