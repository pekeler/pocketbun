// PocketBun-only benchmark helper: isolate organization create latency by layer.

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NewWithConfig, buildServeHandler } from "../index.ts";
import { recordCreate } from "../src/apis/record_crud.ts";
import { RequestEvent } from "../src/core/event_request.ts";
import { NewRecord } from "../src/core/record_model.ts";
import { NowDateTime } from "../src/tools/types/index.ts";
import { configureProfile, profileSummary, resetProfile } from "../src/tools/perf/profile.ts";
import { benchmarkSchema } from "./bench_upstream_pocketbun/schema.ts";

type ScenarioResult = {
  label: string;
  iterations: number;
  concurrency: number;
  completedMs: number;
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
};

const iterations = parsePositiveInt(process.env.POCKETBUN_BENCH_LAYERS_ITERS, 300);
const concurrency = parsePositiveInt(process.env.POCKETBUN_BENCH_LAYERS_CONC, 10);
const warmup = parsePositiveInt(process.env.POCKETBUN_BENCH_LAYERS_WARMUP, 50);
const profile = parseBoolean(process.env.POCKETBUN_BENCH_LAYERS_PROFILE);
const runTag = Date.now();

const dataDir = await mkdtemp(join(tmpdir(), "pocketbun-bench-create-layers-"));
let app: ReturnType<typeof NewWithConfig> | null = null;

try {
  app = NewWithConfig({
    HideStartBanner: true,
    DefaultDataDir: dataDir,
    DefaultQueryTimeout: 120,
  });

  if (!app.isBootstrapped()) {
    app.bootstrap();
  }
  app.runAllMigrations();
  if (profile) {
    configureProfile({ enabled: true });
  }

  const importErr = await app.RunInTransaction(async (txApp) => {
    return await txApp.ImportCollectionsByMarshaledJSON(benchmarkSchema, true);
  });
  if (importErr) {
    throw importErr;
  }

  const organizations = app.FindCollectionByNameOrId("organizations");
  const appWithoutHooks = app.UnsafeWithoutHooks();
  const handler = buildServeHandler(app);

  const runDirectSave = async (index: number): Promise<void> => {
    const record = NewRecord(organizations);
    record.Set("name", `layer-save-${runTag}-${index}`);
    const saveErr = await app.Save(record);
    if (saveErr) {
      throw saveErr;
    }
  };

  const runDirectSaveWithExplicitId = async (index: number): Promise<void> => {
    const record = NewRecord(organizations);
    record.Set("id", `id${(runTag + index).toString(36).padStart(13, "0").slice(-13)}`);
    record.Set("name", `layer-save-explicit-id-${runTag}-${index}`);
    const saveErr = await app.Save(record);
    if (saveErr) {
      throw saveErr;
    }
  };

  const runDirectSaveNoValidate = async (index: number): Promise<void> => {
    const record = NewRecord(organizations);
    record.Set("name", `layer-save-noval-${runTag}-${index}`);
    const saveErr = await app.SaveNoValidate(record);
    if (saveErr) {
      throw saveErr;
    }
  };

  const runDirectSaveNoHooksNoValidate = async (index: number): Promise<void> => {
    const now = NowDateTime();
    const record = NewRecord(organizations);
    record.Set("id", `lb${runTag.toString(36)}${index.toString(36)}`);
    record.Set("name", `layer-save-lb-${runTag}-${index}`);
    record.SetRaw("created", now);
    record.SetRaw("updated", now);
    const saveErr = await appWithoutHooks.SaveNoValidate(record);
    if (saveErr) {
      throw saveErr;
    }
  };

  const runRecordCreateDirect = async (index: number): Promise<void> => {
    const request = new Request("http://localhost/api/collections/organizations/records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: `layer-api-${runTag}-${index}` }),
    });
    const event = new RequestEvent({
      app,
      request,
      params: { collection: "organizations" },
      remoteAddress: "127.0.0.1:12345",
      pattern: "POST /api/collections/{collection}/records",
    });
    const response = await recordCreate(app, event);
    if (!response.ok) {
      throw new Error(`recordCreate failed: HTTP ${response.status} ${await response.text()}`);
    }
    response.body?.cancel();
  };

  const runRouterHandler = async (index: number): Promise<void> => {
    const response = await handler(
      new Request("http://localhost/api/collections/organizations/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: `layer-router-${runTag}-${index}` }),
      }),
    );
    if (!response.ok) {
      throw new Error(`router handler failed: HTTP ${response.status} ${await response.text()}`);
    }
    response.body?.cancel();
  };

  const scenarios: Array<{ label: string; runner: (index: number) => Promise<void> }> = [
    { label: "app.Save (direct)", runner: runDirectSave },
    { label: "app.Save (direct, explicit id)", runner: runDirectSaveWithExplicitId },
    { label: "app.SaveNoValidate (direct)", runner: runDirectSaveNoValidate },
    { label: "app.SaveNoValidate (no hooks, lower bound)", runner: runDirectSaveNoHooksNoValidate },
    { label: "recordCreate (direct)", runner: runRecordCreateDirect },
    { label: "router handler (direct)", runner: runRouterHandler },
  ];

  const results: ScenarioResult[] = [];
  for (const scenario of scenarios) {
    if (warmup > 0) {
      await runConcurrent(warmup, concurrency, scenario.runner, 1_000_000);
    }
    if (profile) {
      resetProfile();
    }
    results.push(await runScenario(scenario.label, iterations, concurrency, scenario.runner));
    if (profile) {
      console.log(`\n### PROFILE (${scenario.label})`);
      console.log(profileSummary(40));
    }
  }

  printResults(results);
} finally {
  app?.resetBootstrapState();
  await rm(dataDir, { recursive: true, force: true });
}

async function runScenario(
  label: string,
  iterationCount: number,
  workerCount: number,
  runner: (index: number) => Promise<void>,
): Promise<ScenarioResult> {
  const durations = await runConcurrent(iterationCount, workerCount, runner, 0);
  const completedMs = sum(durations);
  const avgMs = durations.length > 0 ? completedMs / durations.length : 0;
  return {
    label,
    iterations: iterationCount,
    concurrency: workerCount,
    completedMs,
    avgMs,
    p50Ms: percentile(durations, 50),
    p95Ms: percentile(durations, 95),
  };
}

async function runConcurrent(
  iterationCount: number,
  workerCount: number,
  runner: (index: number) => Promise<void>,
  indexOffset: number,
): Promise<number[]> {
  const durations: number[] = [];
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(workerCount, iterationCount) }, async () => {
    while (true) {
      const current = nextIndex;
      nextIndex += 1;
      if (current >= iterationCount) {
        return;
      }
      const started = performance.now();
      await runner(indexOffset + current);
      durations.push(performance.now() - started);
    }
  });
  await Promise.all(workers);
  return durations;
}

function printResults(results: ScenarioResult[]): void {
  console.log("\n# Create Layer Benchmark\n");
  for (const result of results) {
    console.log(`## ${result.label}`);
    console.log(`- iterations: ${result.iterations}`);
    console.log(`- concurrency: ${result.concurrency}`);
    console.log(`- completed_ms: ${result.completedMs.toFixed(3)}`);
    console.log(`- avg_ms: ${result.avgMs.toFixed(3)}`);
    console.log(`- p50_ms: ${result.p50Ms.toFixed(3)}`);
    console.log(`- p95_ms: ${result.p95Ms.toFixed(3)}`);
    console.log("");
  }
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.min(sorted.length - 1, Math.floor((p / 100) * (sorted.length - 1))));
  return sorted[index] ?? 0;
}

function sum(values: number[]): number {
  let total = 0;
  for (const value of values) {
    total += value;
  }
  return total;
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function parseBoolean(raw: string | undefined): boolean {
  const normalized = raw?.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}
