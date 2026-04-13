#!/usr/bin/env bun
// PocketBun-only maintainer helper: capture a targeted CPU profile for an in-process request load.

import { mkdirSync } from "node:fs";
import inspector from "node:inspector/promises";
import { dirname, resolve } from "node:path";
import type { Record as RecordModel } from "../src/core/record_model.ts";
import { serve } from "../src/apis/serve.ts";
import { CollectionNameSuperusers } from "../src/core/collection_model.ts";
import { retryServerStart } from "../src/tests/helpers.ts";
import {
  defaultAuth,
  defaultUrl,
  defaultWarmupRequests,
  isScenario,
  newScenarioApp,
  prepareScenario,
  type AuthMode,
  type Scenario,
} from "./profile_scenarios.ts";

type Options = {
  auth: AuthMode | null;
  concurrency: number;
  durationMs: number | null;
  intervalUs: number | null;
  iterations: number | null;
  out: string | null;
  scenario: Scenario;
  url: string;
  warmupRequests: number | null;
};

function usage(): void {
  console.log(`Usage:
  bun run scripts/profile_inspector_records_list.ts [options]

Options:
  --scenario <name>         one of:
                            list-records
                            list-posts25k-author-check
                            create-organizations
                            create-organizations-rule
                            create-permissions
                            create-permissions-rule
                            create-posts10k
                            create-posts10k-rule
                            delete-posts25k
                            delete-posts25k-rule
                            default: list-records
  --url <path>              request path to profile
                            only used by list-records scenarios
                            default: scenario-specific
  --auth <mode>             one of: none, user, superuser
                            default: scenario-specific
  --duration-ms <ms>        profile window duration in milliseconds
                            default: 3000
  --iterations <n>          fixed number of requests instead of a timed window
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
    iterations: null,
    out: null,
    scenario: "list-records",
    url: defaultUrl("list-records"),
    warmupRequests: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--scenario") {
      const value = requireValue(argv, ++i, arg);
      if (!isScenario(value)) {
        throw new Error(`invalid --scenario value: ${value}`);
      }
      options.scenario = value;
      options.url = defaultUrl(value);
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
      options.iterations = null;
      continue;
    }
    if (arg === "--iterations") {
      options.iterations = parsePositiveInt(requireValue(argv, ++i, arg), arg);
      options.durationMs = null;
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

async function resolveAuthToken(
  app: Awaited<ReturnType<typeof newScenarioApp>>["app"],
  auth: AuthMode,
): Promise<string | null> {
  if (auth === "none") {
    return null;
  }

  if (auth === "superuser") {
    return app.FindAuthRecordByEmail(CollectionNameSuperusers, "test@example.com").NewAuthToken();
  }

  return (app.RecordQuery("users").OrderBy("id").Limit(1).One() as RecordModel).NewAuthToken();
}

async function runExternalLoad(
  baseUrl: string,
  token: string | null,
  options: Options,
  extraArgs: string[] = [],
): Promise<number> {
  const cmd = [
    "bun",
    "run",
    "scripts/profile_http_load.ts",
    "--base-url",
    baseUrl,
    "--scenario",
    options.scenario,
    "--concurrency",
    String(options.concurrency),
    "--warmup-requests",
    String(options.warmupRequests ?? 0),
  ];

  if (options.durationMs != null) {
    cmd.push("--duration-ms", String(options.durationMs));
  }
  if (options.iterations != null) {
    cmd.push("--iterations", String(options.iterations));
  }
  if (options.scenario === "list-records" || options.scenario === "list-posts25k-author-check") {
    cmd.push("--url", options.url);
  }
  if (token) {
    cmd.push("--authorization", token);
  }
  cmd.push(...extraArgs);

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

const options = parseArgs(Bun.argv.slice(2));
const outPath = options.out ?? resolve(`.tmp/profile-inspector/${options.scenario}.cpuprofile`);
mkdirSync(dirname(outPath), { recursive: true });

const session = new inspector.Session();
session.connect();

await using managed = await newScenarioApp(options.scenario);
const app = managed.app;
const runnerAuth = options.auth ?? defaultAuth(options.scenario);
const prepared = await prepareScenario(app, options.scenario, options.url, options.iterations);
const server = await retryServerStart(() => serve(app, { httpAddr: "127.0.0.1:0", showStartBanner: false }));

try {
  const baseUrl = `http://127.0.0.1:${server.port}`;
  const token = await resolveAuthToken(app, runnerAuth);

  await session.post("Profiler.enable");
  if (options.intervalUs != null) {
    await session.post("Profiler.setSamplingInterval", { interval: options.intervalUs });
  }
  await session.post("Profiler.start");

  const completedRequests = await runExternalLoad(baseUrl, token, options, prepared.extraArgs ?? []);

  const { profile } = await session.post("Profiler.stop");
  await session.post("Profiler.disable");
  await Bun.write(outPath, `${JSON.stringify(profile, null, 2)}\n`);

  console.log(`Inspector profile written to ${outPath}`);
  console.log(`Completed requests: ${completedRequests}`);
  console.log(`Scenario: ${options.scenario}`);
  console.log(`Profiled request: ${prepared.label}`);
  console.log(`Auth mode: ${runnerAuth}`);
  console.log(`Concurrency: ${options.concurrency}`);
  if (options.durationMs != null) {
    console.log(`Duration: ${options.durationMs}ms`);
  }
  if (options.iterations != null) {
    console.log(`Iterations: ${options.iterations}`);
  }
} finally {
  session.disconnect();
  await server.stop();
  await prepared.afterRun?.();
}
