#!/usr/bin/env bun
// PocketBun-only maintainer helper: measure request throughput for a focused scenario without inspector overhead.

import { benchmarkSchema } from "./bench_upstream_pocketbun/schema.ts";
import { serve } from "../src/apis/serve.ts";
import { CollectionNameSuperusers } from "../src/core/collection_model.ts";
import { newTestApp } from "../src/tests/app.ts";
import { retryServerStart } from "../src/tests/helpers.ts";

type AuthMode = "none" | "user" | "superuser";
type Scenario = "list-records" | "create-organizations" | "create-organizations-rule" | "create-permissions" | "create-permissions-rule";

type Options = {
  auth: AuthMode | null;
  concurrency: number;
  durationMs: number;
  scenario: Scenario;
  url: string;
  warmupRequests: number | null;
};

type ManagedApp = Awaited<ReturnType<typeof newTestApp>>["app"];
type ScenarioRunner = {
  auth: AuthMode;
  label: string;
  prepare: (app: ManagedApp) => Promise<void>;
};

function usage(): void {
  console.log(`Usage:
  bun run scripts/measure_records_scenario.ts [options]

Options:
  --scenario <name>         one of:
                            list-records
                            create-organizations
                            create-organizations-rule
                            create-permissions
                            create-permissions-rule
                            default: list-records
  --url <path>              request path to measure
                            only used by list-records
                            default: /api/collections/demo2/records?page=1&perPage=30
  --auth <mode>             one of: none, user, superuser
                            default: scenario-specific
  --duration-ms <ms>        measurement window duration in milliseconds
                            default: 10000
  --concurrency <n>         concurrent in-flight requests
                            default: 10
  --warmup-requests <n>     sequential warmup requests before measuring
                            default: scenario-specific
  -h, --help                show help
`);
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    auth: null,
    concurrency: 10,
    durationMs: 10000,
    scenario: "list-records",
    url: "/api/collections/demo2/records?page=1&perPage=30",
    warmupRequests: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--scenario") {
      const value = requireValue(argv, ++i, arg);
      if (
        value !== "list-records" &&
        value !== "create-organizations" &&
        value !== "create-organizations-rule" &&
        value !== "create-permissions" &&
        value !== "create-permissions-rule"
      ) {
        throw new Error(`invalid --scenario value: ${value}`);
      }
      options.scenario = value;
      continue;
    }
    if (arg === "--url") {
      options.url = requireValue(argv, ++i, arg);
      continue;
    }
    if (arg === "--auth") {
      const value = requireValue(argv, ++i, arg);
      if (value !== "none" && value !== "user" && value !== "superuser") {
        throw new Error(`invalid --auth value: ${value}`);
      }
      options.auth = value;
      continue;
    }
    if (arg === "--duration-ms") {
      options.durationMs = parsePositiveInt(requireValue(argv, ++i, arg), arg);
      continue;
    }
    if (arg === "--concurrency") {
      options.concurrency = parsePositiveInt(requireValue(argv, ++i, arg), arg);
      continue;
    }
    if (arg === "--warmup-requests") {
      options.warmupRequests = parseNonNegativeInt(requireValue(argv, ++i, arg), arg);
      continue;
    }
    if (arg === "-h" || arg === "--help") {
      usage();
      process.exit(0);
    }
    throw new Error(`unknown argument: ${arg}`);
  }

  options.auth ??= defaultAuth(options.scenario);
  options.warmupRequests ??= defaultWarmupRequests(options.scenario);
  return options;
}

function defaultAuth(scenario: Scenario): AuthMode {
  return scenario === "list-records" ? "superuser" : "none";
}

function defaultWarmupRequests(scenario: Scenario): number {
  return scenario === "list-records" ? 50 : 0;
}

function requireValue(argv: string[], index: number, flag: string): string {
  const value = argv[index];
  if (!value) {
    throw new Error(`missing value for ${flag}`);
  }
  return value;
}

function parsePositiveInt(raw: string, flag: string): number {
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${flag} must be a positive integer`);
  }
  return value;
}

function parseNonNegativeInt(raw: string, flag: string): number {
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${flag} must be a non-negative integer`);
  }
  return value;
}

async function resolveAuthToken(app: ManagedApp, auth: AuthMode): Promise<string | null> {
  if (auth === "none") {
    return null;
  }

  if (auth === "superuser") {
    return app.FindAuthRecordByEmail(CollectionNameSuperusers, "test@example.com").NewAuthToken();
  }

  return app.FindAuthRecordByEmail("users", "test@example.com").NewAuthToken();
}

async function runExternalLoad(baseUrl: string, token: string | null, options: Options): Promise<number> {
  const cmd = [
    "bun",
    "run",
    "scripts/profile_http_load.ts",
    "--base-url",
    baseUrl,
    "--scenario",
    options.scenario,
    "--duration-ms",
    String(options.durationMs),
    "--concurrency",
    String(options.concurrency),
    "--warmup-requests",
    String(options.warmupRequests ?? 0),
  ];

  if (options.scenario === "list-records") {
    cmd.push("--url", options.url);
  }
  if (token) {
    cmd.push("--authorization", token);
  }

  const child = Bun.spawn({
    cmd,
    cwd: process.cwd(),
    stdin: "ignore",
    stdout: "pipe",
    stderr: "inherit",
  });

  const stdout = await new Response(child.stdout).text();
  const exitCode = await child.exited;
  if (exitCode !== 0) {
    throw new Error(`load client exited with status ${exitCode}`);
  }

  const payload = JSON.parse(stdout) as { completedRequests?: unknown };
  const completedRequests = Number(payload.completedRequests);
  if (!Number.isFinite(completedRequests) || completedRequests < 0) {
    throw new Error("load client returned invalid completedRequests value");
  }

  return completedRequests;
}

async function prepareBenchmarkCreateScenario(app: ManagedApp, collectionName: string, rule: string): Promise<void> {
  const benchmarkCollections = JSON.parse(benchmarkSchema) as Array<Record<string, unknown>>;
  const targetCollections = benchmarkCollections.filter((entry) => String(entry.name ?? "") === collectionName);
  if (targetCollections.length === 0) {
    throw new Error(`missing benchmark collection ${collectionName}`);
  }

  const importErr = await app.ImportCollectionsByMarshaledJSON(JSON.stringify(targetCollections), false);
  if (importErr) {
    throw importErr;
  }

  const collection = app.FindCollectionByNameOrId(collectionName);
  if (!collection) {
    throw new Error(`missing imported collection ${collectionName}`);
  }

  collection.createRule = rule;
  const saveErr = await app.Save(collection);
  if (saveErr) {
    throw saveErr;
  }

  app.db().exec(`DELETE FROM {{${collection.name}}}`);
}

function createScenarioRunner(options: Options): ScenarioRunner {
  if (options.scenario === "create-organizations" || options.scenario === "create-organizations-rule") {
    const rule = options.scenario === "create-organizations-rule" ? "@request.body.name != ''" : "";
    return {
      auth: options.auth ?? defaultAuth(options.scenario),
      label: `POST /api/collections/organizations/records (createRule=${JSON.stringify(rule)})`,
      prepare: async (app) => {
        await prepareBenchmarkCreateScenario(app, "organizations", rule);
      },
    };
  }

  if (options.scenario === "create-permissions" || options.scenario === "create-permissions-rule") {
    const rule = options.scenario === "create-permissions-rule" ? "@request.body.name != ''" : "";
    return {
      auth: options.auth ?? defaultAuth(options.scenario),
      label: `POST /api/collections/permissions/records (createRule=${JSON.stringify(rule)})`,
      prepare: async (app) => {
        await prepareBenchmarkCreateScenario(app, "permissions", rule);
      },
    };
  }

  return {
    auth: options.auth ?? defaultAuth(options.scenario),
    label: `GET ${options.url}`,
    prepare: async () => {},
  };
}

const options = parseArgs(Bun.argv.slice(2));
const runner = createScenarioRunner(options);
const { app, cleanup } = await newTestApp(undefined, { bindEventCounters: false });

let server: ReturnType<typeof Bun.serve> | null = null;

try {
  await runner.prepare(app);
  server = await retryServerStart(() => serve(app, { http: "127.0.0.1:0" }));
  const baseUrl = `http://127.0.0.1:${server.port}`;
  const token = await resolveAuthToken(app, runner.auth);
  const completedRequests = await runExternalLoad(baseUrl, token, options);

  console.log(`Completed requests: ${completedRequests}`);
  console.log(`Requests/sec: ${(completedRequests / (options.durationMs / 1000)).toFixed(2)}`);
  console.log(`Scenario: ${options.scenario}`);
  console.log(`Measured request: ${runner.label}`);
  console.log(`Auth mode: ${runner.auth}`);
  console.log(`Concurrency: ${options.concurrency}`);
  console.log(`Duration: ${options.durationMs}ms`);
} finally {
  server?.stop(true);
  await cleanup();
}
