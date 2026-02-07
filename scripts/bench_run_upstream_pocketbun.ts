// PocketBun-only: runs a PocketBun-native port of the upstream pocketbase/benchmarks app.

import type { AddressInfo } from "node:net";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { MustRegisterJSVM, NewWithConfig, serve } from "../index.ts";
import { CollectionNameSuperusers } from "../src/core/collection_model.ts";
import { NewRecord } from "../src/core/record_model.ts";
import { configureProfile, profileEnabled, profileSummary, resetProfile } from "../src/tools/perf/profile.ts";
import { registerBenchmarkModule } from "./bench_upstream_pocketbun/module.ts";
import { benchmarkSchema } from "./bench_upstream_pocketbun/schema.ts";

const benchmarkRunOverrideFile = process.env.POCKETBUN_BENCHMARK_RUN_FILE ?? "/tmp/pocketbun-bench-upstream-run.txt";
const benchmarkRun = await resolveBenchmarkRun(benchmarkRunOverrideFile);
const benchmarkProfileOverrideFile = process.env.POCKETBUN_BENCHMARK_PROFILE_FILE ?? "/tmp/pocketbun-bench-upstream-profile.txt";
const benchmarkProfileEnabled = await resolveBooleanOverride(benchmarkProfileOverrideFile, false);
const benchmarkWarmupRequestsFile =
  process.env.POCKETBUN_BENCHMARK_WARMUP_REQUESTS_FILE ?? "/tmp/pocketbun-bench-upstream-warmup-requests.txt";
const benchmarkWarmupRequests = await resolveIntOverride(benchmarkWarmupRequestsFile, 0);
if (benchmarkProfileEnabled) {
  configureProfile({ enabled: true });
}
const machineTag = sanitizeTag(process.env.POCKETBUN_BENCH_MACHINE_TAG ?? "m2-max");
const timestampTag = createTimestampTag(new Date());
const resultsDir = process.env.POCKETBUN_BENCH_RESULTS_DIR ?? "benchmarks/results";
const repoResultFile =
  process.env.POCKETBUN_BENCHMARK_RESULT_FILE ??
  join(resultsDir, `${timestampTag}-pocketbun-upstream-${machineTag}.md`);
const latestResultFile = process.env.POCKETBUN_BENCHMARK_RESULT_LATEST_FILE ?? "/tmp/pocketbun-benchmarks-latest.txt";

const serverReadyTimeoutMs = 60_000;
const benchmarkTimeoutMs = 120 * 60_000;
const pollIntervalMs = 5_000;
const probePassword = "1234567890";
const probeUserEmail = "users0@example.com";
const probeUserUsername = "users0";

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

  if (benchmarkRun === "probe:create-latency" || benchmarkRun === "probe:create-organizations") {
    if (profileEnabled()) {
      resetProfile();
    }
    const token = await authSuperuser();
    await importProbeSchema(token);
    const probeReport = await runCreateLatencyProbe(
      token,
      benchmarkRun === "probe:create-organizations" ? "organizations-only" : "full",
    );
    if (profileEnabled()) {
      const summary = profileSummary(80);
      if (summary) {
        console.log("\nPROFILE SUMMARY");
        console.log(summary);
      }
    }

    const metadataHeader = [
      "# PocketBun Upstream-Port Benchmark Probe",
      "",
      `- machine: ${machineTag}`,
      `- timestamp: ${new Date().toISOString()}`,
      `- mode: ${benchmarkRun}`,
      "",
    ].join("\n");

    await mkdir(dirname(repoResultFile), { recursive: true });
    await writeFile(repoResultFile, `${metadataHeader}${probeReport}\n`);

    await mkdir(dirname(latestResultFile), { recursive: true });
    await writeFile(latestResultFile, `${probeReport}\n`);

    console.log(`\nSaved probe report to: ${repoResultFile}`);
    console.log(`Saved latest probe report to: ${latestResultFile}`);
  } else {
    const runNames = benchmarkRun
      .split(",")
      .map((name) => name.trim())
      .filter((name) => name !== "");
    if (runNames.includes("auth") && !runNames.includes("create")) {
      const token = await authSuperuser();
      await importProbeSchema(token);
      await ensureProbeAuthIdentity(token);
    }

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

    const metadataHeader = [
      "# PocketBun Upstream-Port Benchmark Result",
      "",
      `- machine: ${machineTag}`,
      `- timestamp: ${new Date().toISOString()}`,
      `- tests: ${benchmarkRun}`,
      "",
    ].join("\n");

    await mkdir(dirname(repoResultFile), { recursive: true });
    await writeFile(repoResultFile, `${metadataHeader}${resultBody}\n`);

    await mkdir(dirname(latestResultFile), { recursive: true });
    await writeFile(latestResultFile, `${resultBody}\n`);

    console.log(`\nSaved full result to: ${repoResultFile}`);
    console.log(`Saved latest raw result to: ${latestResultFile}`);
  }
} finally {
  await server.stop();
  app.resetBootstrapState();
  await rm(dataDir, { recursive: true, force: true });
}

function createTimestampTag(date: Date): string {
  return date.toISOString().replace(/:/g, "-").replace(/\.\d{3}Z$/, "Z");
}

function sanitizeTag(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9._-]+/g, "-");
}

async function resolveBenchmarkRun(overrideFile: string): Promise<string> {
  const envRun = process.env.POCKETBUN_BENCHMARK_RUN?.trim();
  if (envRun) {
    return envRun;
  }

  try {
    const raw = await readFile(overrideFile, "utf8");
    const firstNonCommentLine = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line !== "" && !line.startsWith("#"));

    if (firstNonCommentLine) {
      console.log(`Using benchmark run override from ${overrideFile}: ${firstNonCommentLine}`);
      return firstNonCommentLine;
    }
  } catch (error) {
    const errno = error as NodeJS.ErrnoException;
    if (errno.code !== "ENOENT") {
      throw error;
    }
  }

  return "create,auth,search,custom,delete";
}

async function resolveBooleanOverride(overrideFile: string, defaultValue: boolean): Promise<boolean> {
  try {
    const raw = await readFile(overrideFile, "utf8");
    const firstNonCommentLine = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line !== "" && !line.startsWith("#"));

    const parsed = parseBoolean(firstNonCommentLine);
    if (parsed !== null) {
      console.log(`Using boolean override from ${overrideFile}: ${parsed}`);
      return parsed;
    }
  } catch (error) {
    const errno = error as NodeJS.ErrnoException;
    if (errno.code !== "ENOENT") {
      throw error;
    }
  }

  return defaultValue;
}

async function resolveIntOverride(overrideFile: string, defaultValue: number): Promise<number> {
  try {
    const raw = await readFile(overrideFile, "utf8");
    const firstNonCommentLine = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line !== "" && !line.startsWith("#"));

    const parsed = parseNonNegativeInt(firstNonCommentLine);
    if (parsed !== null) {
      console.log(`Using integer override from ${overrideFile}: ${parsed}`);
      return parsed;
    }
  } catch (error) {
    const errno = error as NodeJS.ErrnoException;
    if (errno.code !== "ENOENT") {
      throw error;
    }
  }

  return defaultValue;
}

function parseBoolean(value: string | null | undefined): boolean | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  if (normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on") {
    return true;
  }
  if (normalized === "0" || normalized === "false" || normalized === "no" || normalized === "off") {
    return false;
  }
  return null;
}

function parseNonNegativeInt(value: string | null | undefined): number | null {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }
  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
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

type ProbeAuthIdentity = {
  id: string;
  email: string;
  password: string;
};

type CreateLatencyScenario = {
  collection: "organizations" | "permissions";
  rule: string;
  iterations: number;
  concurrency: number;
  payload: (index: number) => Record<string, unknown>;
};

type CreateLatencyResult = {
  scenario: CreateLatencyScenario;
  completedMs: number;
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
  errors: number;
};

type CreateLatencyProbeMode = "full" | "organizations-only";

async function runCreateLatencyProbe(superuserToken: string, mode: CreateLatencyProbeMode): Promise<string> {
  const runTag = Date.now();
  const scenarios: CreateLatencyScenario[] =
    mode === "organizations-only"
      ? [
          {
            collection: "organizations",
            rule: "",
            iterations: 50,
            concurrency: 10,
            payload: (index) => ({ name: `probe-org-${runTag}-${index}` }),
          },
          {
            collection: "organizations",
            rule: "@request.body.name != ''",
            iterations: 50,
            concurrency: 10,
            payload: (index) => ({ name: `probe-org-rule-${runTag}-${index}` }),
          },
        ]
      : [
          {
            collection: "organizations",
            rule: "",
            iterations: 500,
            concurrency: 10,
            payload: (index) => ({ name: `probe-org-${runTag}-${index}` }),
          },
          {
            collection: "organizations",
            rule: "@request.body.name != ''",
            iterations: 500,
            concurrency: 10,
            payload: (index) => ({ name: `probe-org-rule-${runTag}-${index}` }),
          },
          {
            collection: "permissions",
            rule: "",
            iterations: 250,
            concurrency: 5,
            payload: (index) => ({ name: `probe-perm-${runTag}-${index}`, active: index % 2 === 0 }),
          },
          {
            collection: "permissions",
            rule: "@request.body.name != ''",
            iterations: 250,
            concurrency: 5,
            payload: (index) => ({ name: `probe-perm-rule-${runTag}-${index}`, active: index % 2 === 0 }),
          },
        ];

  const results: CreateLatencyResult[] = [];
  for (const scenario of scenarios) {
    await setCollectionCreateRule(superuserToken, scenario.collection, scenario.rule);
    console.log(
      `\nRunning PocketBun create latency probe (${scenario.collection}, reqs=${scenario.iterations}, conc=${scenario.concurrency}, rule=${JSON.stringify(scenario.rule)})...`,
    );
    const result = await runCreateLatencyScenario(scenario);
    results.push(result);
  }

  const reportLines = ["## Create latency probe", ""];
  for (const result of results) {
    reportLines.push(`### ${result.scenario.collection} createRule=${JSON.stringify(result.scenario.rule)}`);
    reportLines.push(`- reqs: ${result.scenario.iterations}`);
    reportLines.push(`- concurrency: ${result.scenario.concurrency}`);
    reportLines.push(`- completed_ms: ${result.completedMs.toFixed(3)}`);
    reportLines.push(`- avg_ms: ${result.avgMs.toFixed(3)}`);
    reportLines.push(`- p50_ms: ${result.p50Ms.toFixed(3)}`);
    reportLines.push(`- p95_ms: ${result.p95Ms.toFixed(3)}`);
    reportLines.push(`- errors: ${result.errors}`);
    reportLines.push("");
  }

  const report = reportLines.join("\n");
  console.log("\n" + report);
  return report;
}

async function runCreateLatencyScenario(scenario: CreateLatencyScenario): Promise<CreateLatencyResult> {
  if (benchmarkWarmupRequests > 0) {
    await runCreateLatencyWarmup(scenario, benchmarkWarmupRequests);
  }

  let nextIndex = 0;
  let errors = 0;
  const durationsMs: number[] = [];
  const workerCount = Math.min(scenario.concurrency, scenario.iterations);

  const started = performance.now();
  const workers = Array.from({ length: workerCount }, async () => {
    while (true) {
      const current = nextIndex;
      nextIndex += 1;
      if (current >= scenario.iterations) {
        return;
      }

      const requestStarted = performance.now();
      try {
        const response = await fetch(`${baseUrl}/api/collections/${scenario.collection}/records`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(scenario.payload(current)),
        });

        if (response.status >= 400) {
          errors += 1;
          if (errors <= 4) {
            const sample = compactErrorSample(await response.text());
            console.log(
              `  sample error (${scenario.collection} rule=${JSON.stringify(scenario.rule)}): HTTP ${response.status} ${sample}`,
            );
          } else {
            response.body?.cancel();
          }
        } else {
          response.body?.cancel();
        }
      } catch (error) {
        errors += 1;
        if (errors <= 4) {
          console.log(
            `  sample transport error (${scenario.collection} rule=${JSON.stringify(scenario.rule)}): ${compactErrorSample(String(error))}`,
          );
        }
      } finally {
        durationsMs.push(performance.now() - requestStarted);
      }
    }
  });
  await Promise.all(workers);

  const completedMs = performance.now() - started;
  const avgMs = durationsMs.length > 0 ? durationsMs.reduce((sum, value) => sum + value, 0) / durationsMs.length : 0;

  return {
    scenario,
    completedMs,
    avgMs,
    p50Ms: percentile(durationsMs, 50),
    p95Ms: percentile(durationsMs, 95),
    errors,
  };
}

async function runCreateLatencyWarmup(scenario: CreateLatencyScenario, warmupRequests: number): Promise<void> {
  const total = Math.max(0, Math.floor(warmupRequests));
  if (total === 0) {
    return;
  }

  let nextIndex = 0;
  let errors = 0;
  const indexOffset = 1_000_000;
  const workerCount = Math.min(scenario.concurrency, total);
  const workers = Array.from({ length: workerCount }, async () => {
    while (true) {
      const current = nextIndex;
      nextIndex += 1;
      if (current >= total) {
        return;
      }

      try {
        const response = await fetch(`${baseUrl}/api/collections/${scenario.collection}/records`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(scenario.payload(indexOffset + current)),
        });
        if (response.status >= 400) {
          errors += 1;
        }
        response.body?.cancel();
      } catch {
        errors += 1;
      }
    }
  });
  await Promise.all(workers);

  if (errors > 0) {
    console.log(`  warmup errors (${scenario.collection}): ${errors}/${total}`);
  }
}

async function setCollectionCreateRule(superuserToken: string, collection: string, createRule: string): Promise<void> {
  const updateCollectionResponse = await fetch(`${baseUrl}/api/collections/${collection}`, {
    method: "PATCH",
    headers: {
      Authorization: superuserToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ createRule }),
  });
  if (!updateCollectionResponse.ok) {
    const body = compactErrorSample(await updateCollectionResponse.text());
    throw new Error(`failed to set ${collection}.createRule for probe: HTTP ${updateCollectionResponse.status} ${body}`);
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

async function ensureProbeAuthIdentity(superuserToken: string): Promise<ProbeAuthIdentity> {
  const usersResponse = await fetch(`${baseUrl}/api/collections/users/records?perPage=200&fields=id,email`, {
    headers: { Authorization: superuserToken },
  });
  if (!usersResponse.ok) {
    throw new Error(`failed to fetch users for probe: HTTP ${usersResponse.status}`);
  }
  const usersPayload = (await usersResponse.json()) as { items?: Array<{ id?: string; email?: string }> };
  const existingUser = usersPayload.items?.find((item) => item.email === probeUserEmail);
  if (existingUser?.id && existingUser.email) {
    return {
      id: existingUser.id,
      email: existingUser.email,
      password: probePassword,
    };
  }

  const probeOrganizationName = `probe-org-${Date.now()}`;
  const createOrganizationResponse = await fetch(`${baseUrl}/api/collections/organizations/records`, {
    method: "POST",
    headers: {
      Authorization: superuserToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: probeOrganizationName,
    }),
  });
  if (!createOrganizationResponse.ok) {
    const body = compactErrorSample(await createOrganizationResponse.text());
    throw new Error(`failed to create probe organization: HTTP ${createOrganizationResponse.status} ${body}`);
  }
  const createdOrganization = (await createOrganizationResponse.json()) as { id?: string };
  if (!createdOrganization.id) {
    throw new Error("failed to read created probe organization id");
  }

  const probePermissionName = `probe-perm-${Date.now()}`;
  const createPermissionResponse = await fetch(`${baseUrl}/api/collections/permissions/records`, {
    method: "POST",
    headers: {
      Authorization: superuserToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: probePermissionName,
      active: true,
    }),
  });
  if (!createPermissionResponse.ok) {
    const body = compactErrorSample(await createPermissionResponse.text());
    throw new Error(`failed to create probe permission: HTTP ${createPermissionResponse.status} ${body}`);
  }
  const createdPermission = (await createPermissionResponse.json()) as { id?: string };
  if (!createdPermission.id) {
    throw new Error("failed to read created probe permission id");
  }

  const createUserResponse = await fetch(`${baseUrl}/api/collections/users/records`, {
    method: "POST",
    headers: {
      Authorization: superuserToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: probeUserEmail,
      username: probeUserUsername,
      organization: createdOrganization.id,
      permissions: [createdPermission.id],
      password: probePassword,
      passwordConfirm: probePassword,
    }),
  });
  if (!createUserResponse.ok) {
    const body = compactErrorSample(await createUserResponse.text());
    throw new Error(`failed to create probe user: HTTP ${createUserResponse.status} ${body}`);
  }
  const createdUser = (await createUserResponse.json()) as { id?: string; email?: string };
  if (!createdUser.id || !createdUser.email) {
    throw new Error("failed to read created probe user");
  }

  return {
    id: createdUser.id,
    email: createdUser.email,
    password: probePassword,
  };
}

async function importProbeSchema(token: string): Promise<void> {
  const importResponse = await fetch(`${baseUrl}/api/collections/import`, {
    method: "PUT",
    headers: {
      Authorization: token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      deleteMissing: true,
      collections: JSON.parse(benchmarkSchema) as unknown[],
    }),
  });

  if (!importResponse.ok) {
    const body = compactErrorSample(await importResponse.text());
    throw new Error(`failed to import probe schema: HTTP ${importResponse.status} ${body}`);
  }
}

function compactErrorSample(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, 240);
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
