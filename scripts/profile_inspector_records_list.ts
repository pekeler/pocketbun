#!/usr/bin/env bun
// PocketBun-only maintainer helper: capture a targeted CPU profile for an in-process request load.

import { mkdirSync } from "node:fs";
import inspector from "node:inspector/promises";
import { dirname, resolve } from "node:path";
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
  intervalUs: number | null;
  out: string | null;
  scenario: Scenario;
  url: string;
  warmupRequests: number | null;
};

type ManagedApp = Awaited<ReturnType<typeof newTestApp>>["app"];
type ScenarioRequest = {
  init?: RequestInit;
  url: string;
};
type ScenarioRunner = {
  auth: AuthMode;
  label: string;
  prepare: (app: ManagedApp) => Promise<void>;
  request: (baseUrl: string, headers: Headers, index: number) => ScenarioRequest;
};

function usage(): void {
  console.log(`Usage:
  bun run scripts/profile_inspector_records_list.ts [options]

Options:
  --scenario <name>         one of:
                            list-records
                            create-organizations
                            create-organizations-rule
                            create-permissions
                            create-permissions-rule
                            default: list-records
  --url <path>              Request path to profile
                            only used by list-records
                            default: /api/collections/demo2/records?page=1&perPage=30
  --auth <mode>             one of: none, user, superuser
                            default: scenario-specific
  --duration-ms <ms>        profile window duration in milliseconds
                            default: 3000
  --concurrency <n>         concurrent in-flight requests
                            default: 16
  --warmup-requests <n>     sequential warmup requests before profiling
                            default: scenario-specific
  --interval-us <n>         optional inspector sampling interval in microseconds
  --out <path>              output .cpuprofile path
                            default: .tmp/profile-inspector/<scenario>.cpuprofile
  -h, --help                show help
`);
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    auth: null,
    concurrency: 16,
    durationMs: 3000,
    intervalUs: null,
    out: null,
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
    if (arg === "--interval-us") {
      options.intervalUs = parsePositiveInt(requireValue(argv, ++i, arg), arg);
      continue;
    }
    if (arg === "--out") {
      options.out = resolve(requireValue(argv, ++i, arg));
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
  options.out ??= resolve(`.tmp/profile-inspector/${options.scenario}.cpuprofile`);

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

async function resolveAuthToken(app: Awaited<ReturnType<typeof newTestApp>>["app"], auth: AuthMode): Promise<string | null> {
  if (auth === "none") {
    return null;
  }

  if (auth === "superuser") {
    return app.FindAuthRecordByEmail(CollectionNameSuperusers, "test@example.com").NewAuthToken();
  }

  return app.FindAuthRecordByEmail("users", "test@example.com").NewAuthToken();
}

async function warmup(
  baseUrl: string,
  headers: Headers,
  warmupRequests: number,
  runner: ScenarioRunner,
): Promise<void> {
  for (let i = 0; i < warmupRequests; i += 1) {
    const request = runner.request(baseUrl, headers, i);
    const response = await fetch(request.url, request.init);
    if (!response.ok) {
      throw new Error(`warmup request failed with status ${response.status}`);
    }
    await response.arrayBuffer();
  }
}

async function runLoad(
  baseUrl: string,
  headers: Headers,
  durationMs: number,
  concurrency: number,
  runner: ScenarioRunner,
): Promise<number> {
  const deadline = Date.now() + durationMs;
  let completed = 0;
  let nextIndex = 0;

  const worker = async () => {
    while (Date.now() < deadline) {
      const index = nextIndex;
      nextIndex += 1;
      const request = runner.request(baseUrl, headers, index);
      const response = await fetch(request.url, request.init);
      if (!response.ok) {
        throw new Error(`profile request failed with status ${response.status}`);
      }
      await response.arrayBuffer();
      completed += 1;
    }
  };

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return completed;
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
  collection.createRule = rule;
  await app.Save(collection);
  app.db().exec(`DELETE FROM {{${collection.name}}}`);
}

function createScenarioRunner(options: Options): ScenarioRunner {
  const runTag = Date.now().toString(36);

  if (options.scenario === "create-organizations" || options.scenario === "create-organizations-rule") {
    const rule = options.scenario === "create-organizations-rule" ? "@request.body.name != ''" : "";
    return {
      auth: options.auth ?? defaultAuth(options.scenario),
      label: `POST /api/collections/organizations/records (createRule=${JSON.stringify(rule)})`,
      prepare: async (app) => {
        await prepareBenchmarkCreateScenario(app, "organizations", rule);
      },
      request: (baseUrl, headers, index) => ({
        url: `${baseUrl}/api/collections/organizations/records`,
        init: {
          method: "POST",
          headers: new Headers({ ...Object.fromEntries(headers.entries()), "Content-Type": "application/json" }),
          body: JSON.stringify({ name: `profile-org-${runTag}-${index}` }),
        },
      }),
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
      request: (baseUrl, headers, index) => ({
        url: `${baseUrl}/api/collections/permissions/records`,
        init: {
          method: "POST",
          headers: new Headers({ ...Object.fromEntries(headers.entries()), "Content-Type": "application/json" }),
          body: JSON.stringify({
            active: index % 2 === 0,
            name: `profile-perm-${runTag}-${index}`,
          }),
        },
      }),
    };
  }

  return {
    auth: options.auth ?? defaultAuth(options.scenario),
    label: `GET ${options.url}`,
    prepare: async () => {},
    request: (baseUrl, headers) => ({
      url: `${baseUrl}${options.url}`,
      init: { headers },
    }),
  };
}

const options = parseArgs(Bun.argv.slice(2));
const runner = createScenarioRunner(options);
mkdirSync(dirname(options.out), { recursive: true });

const session = new inspector.Session();
session.connect();

await using managed = await newTestApp(undefined, { bindEventCounters: false });
const app = managed.app;
const server = await retryServerStart(() => serve(app, { httpAddr: "127.0.0.1:0", showStartBanner: false }));

try {
  const baseUrl = `http://127.0.0.1:${server.port}`;
  await runner.prepare(app);
  const token = await resolveAuthToken(app, runner.auth);
  const headers = new Headers();
  if (token) {
    headers.set("Authorization", token);
  }

  await warmup(baseUrl, headers, options.warmupRequests, runner);

  await session.post("Profiler.enable");
  if (options.intervalUs != null) {
    await session.post("Profiler.setSamplingInterval", { interval: options.intervalUs });
  }
  await session.post("Profiler.start");

  const completedRequests = await runLoad(baseUrl, headers, options.durationMs, options.concurrency, runner);

  const { profile } = await session.post("Profiler.stop");
  await session.post("Profiler.disable");
  await Bun.write(options.out, `${JSON.stringify(profile, null, 2)}\n`);

  console.log(`Inspector profile written to ${options.out}`);
  console.log(`Completed requests: ${completedRequests}`);
  console.log(`Scenario: ${options.scenario}`);
  console.log(`Profiled request: ${runner.label}`);
  console.log(`Auth mode: ${runner.auth}`);
  console.log(`Concurrency: ${options.concurrency}`);
  console.log(`Duration: ${options.durationMs}ms`);
} finally {
  session.disconnect();
  await server.stop();
}
