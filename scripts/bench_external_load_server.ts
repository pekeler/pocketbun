#!/usr/bin/env bun
// PocketBun-only: executes complete upstream benchmark request batches on a separate load-generator host.

import { appendFile } from "node:fs/promises";
import { bench } from "./bench_upstream_pocketbun/bench.ts";
import { BenchRequest, benchmarkWorkerSlotHeader, type ExternalBenchRequest } from "./bench_upstream_pocketbun/request.ts";

const port = Number.parseInt(process.env.POCKETBUN_BENCH_LOAD_PORT ?? "19100", 10);
const token = process.env.POCKETBUN_BENCH_EXTERNAL_LOAD_TOKEN ?? "";
const logFile = process.env.POCKETBUN_BENCH_LOAD_LOG?.trim() ?? "";
if (!Number.isSafeInteger(port) || port < 1 || port > 65_535 || token === "") {
  throw new Error("POCKETBUN_BENCH_LOAD_PORT and POCKETBUN_BENCH_EXTERNAL_LOAD_TOKEN are required");
}

// The load generator must always execute locally, even if the service was
// launched from an environment copied from an application-host benchmark.
delete process.env.POCKETBUN_BENCH_EXTERNAL_LOAD_URL;

let logTail = Promise.resolve();
const server = Bun.serve({
  hostname: "0.0.0.0",
  port,
  maxRequestBodySize: 256 * 1024 * 1024,
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return Response.json({ ok: true, pid: process.pid });
    }
    if (url.pathname !== "/run" || request.method !== "POST") {
      return new Response("Not found", { status: 404 });
    }
    if (request.headers.get("X-PocketBun-Benchmark-Token") !== token) {
      return new Response("Unauthorized", { status: 401 });
    }

    let input: { requests?: unknown; concurrency?: unknown; phase?: unknown };
    try {
      input = (await request.json()) as typeof input;
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }
    if (!Array.isArray(input.requests) || input.requests.length < 1 || input.requests.length > 100_000) {
      return new Response("Invalid requests", { status: 400 });
    }
    const concurrency = Number(input.concurrency);
    if (!Number.isSafeInteger(concurrency) || concurrency === 0 || concurrency < -1 || concurrency > 100_000) {
      return new Response("Invalid concurrency", { status: 400 });
    }
    const requests = input.requests as unknown[];
    if (!requests.every(isExternalBenchRequest)) {
      return new Response("Invalid request descriptor", { status: 400 });
    }
    if (input.phase !== "warmup" && input.phase !== "measurement") {
      return new Response("Invalid phase", { status: 400 });
    }

    const startedAt = performance.now();
    const startedCpu = process.cpuUsage();
    const workerCounts: Record<string, number> = {};
    let peakRssBytes = process.memoryUsage().rss;
    const rssTimer = setInterval(() => {
      peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss);
    }, 25);
    try {
      const result = await bench(
        async (index) => {
          const item = requests[index] as ExternalBenchRequest;
          const response = await new BenchRequest({
            Url: item.url,
            Method: item.method,
            Headers: item.headers,
            Body: item.body,
          }).Send(null);
          const rawSlot = response?.headers[benchmarkWorkerSlotHeader];
          const slot = Array.isArray(rawSlot) ? rawSlot[0] : rawSlot;
          if (slot && /^\d+$/.test(slot)) {
            workerCounts[slot] = (workerCounts[slot] ?? 0) + 1;
          }
        },
        requests.length,
        concurrency,
      );
      const elapsedMs = performance.now() - startedAt;
      const cpu = process.cpuUsage(startedCpu);
      const payload = {
        bestMs: result.BestMs,
        worstMs: result.WorstMs,
        completedMs: result.CompletedMs,
        errorCount: result.Errors.length,
        sampleError: result.Errors[0]?.message ?? "",
        workerCounts,
        requestCount: requests.length,
        concurrency,
        phase: input.phase,
        elapsedMs,
        requestsPerSecond: requests.length / (elapsedMs / 1_000),
        clientCpuPercent: (cpu.user + cpu.system) / 1_000 / elapsedMs / 0.01,
        clientPeakRssMiB: peakRssBytes / 1024 / 1024,
        target: new URL((requests[0] as ExternalBenchRequest).url).host,
        timestamp: new Date().toISOString(),
      };
      if (logFile) {
        logTail = logTail.then(() => appendFile(logFile, `${JSON.stringify(payload)}\n`));
        await logTail;
      }
      return Response.json(payload);
    } finally {
      clearInterval(rssTimer);
    }
  },
});

console.log(`external benchmark load service listening on ${server.url.href}`);
await new Promise<void>(() => {});

function isExternalBenchRequest(value: unknown): value is ExternalBenchRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const item = value as Record<string, unknown>;
  if (typeof item.url !== "string" || typeof item.method !== "string") {
    return false;
  }
  try {
    const url = new URL(item.url);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return false;
    }
  } catch {
    return false;
  }
  if (item.body !== null && typeof item.body !== "string") {
    return false;
  }
  if (!item.headers || typeof item.headers !== "object" || Array.isArray(item.headers)) {
    return false;
  }
  return Object.values(item.headers as Record<string, unknown>).every((header) => typeof header === "string");
}
