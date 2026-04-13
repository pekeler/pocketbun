#!/usr/bin/env bun
// PocketBun-only maintainer helper: run a benchmark-shaped request scenario for Bun heap profiling.

import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { serve } from "../src/apis/serve.ts";
import { retryServerStart } from "../src/tests/helpers.ts";
import {
  finalizeBaseOptions,
  initBaseOptions,
  parseBaseArg,
  requireValue,
  resolveAuthToken,
  runExternalLoad,
  type InspectorScenarioOptions,
} from "./profile_inspector_common.ts";
import { newScenarioApp, prepareScenario } from "./profile_scenarios.ts";

type Options = InspectorScenarioOptions & {
  summaryOut: string | null;
};

function usage(): void {
  console.log(`Usage:
  bun run scripts/profile_heap_scenario.ts [options]

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
  --summary-out <path>      optional summary JSON path
                            default: $POCKETBUN_PROFILE_DIR/<scenario>.summary.json
                                     or .tmp/profile-heap-scenario/<scenario>.summary.json
  -h, --help                show help
`);
}

function defaultSummaryPath(scenario: Options["scenario"]): string {
  const baseDir = process.env.POCKETBUN_PROFILE_DIR || ".tmp/profile-heap-scenario";
  return resolve(baseDir, `${scenario}.summary.json`);
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    ...initBaseOptions("list-records"),
    summaryOut: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const nextIndex = parseBaseArg(options, argv, i);
    if (nextIndex != null) {
      if (arg === "-h" || arg === "--help") {
        usage();
        process.exit(0);
      }
      i = nextIndex;
      continue;
    }
    if (arg === "--summary-out") {
      options.summaryOut = resolve(requireValue(argv, ++i, arg));
      continue;
    }
    throw new Error(`unknown argument: ${arg}`);
  }

  finalizeBaseOptions(options);
  options.summaryOut ??= defaultSummaryPath(options.scenario);

  return options;
}

const options = parseArgs(Bun.argv.slice(2));
const summaryOut = options.summaryOut ?? defaultSummaryPath(options.scenario);
mkdirSync(dirname(summaryOut), { recursive: true });

await using managed = await newScenarioApp(options.scenario);
const app = managed.app;
const runnerAuth = options.auth ?? "none";
const prepared = await prepareScenario(app, options.scenario, options.url, options.iterations);
const server = await retryServerStart(() => serve(app, { httpAddr: "127.0.0.1:0", showStartBanner: false }));

try {
  const baseUrl = `http://127.0.0.1:${server.port}`;
  const token = await resolveAuthToken(app, runnerAuth);
  const completedRequests = await runExternalLoad(baseUrl, token, options, prepared.extraArgs ?? []);
  const summary = {
    auth: runnerAuth,
    completedRequests,
    concurrency: options.concurrency,
    durationMs: options.durationMs,
    iterations: options.iterations,
    label: prepared.label,
    scenario: options.scenario,
    summaryOut,
    warmupRequests: options.warmupRequests,
  };

  await Bun.write(summaryOut, `${JSON.stringify(summary, null, 2)}\n`);

  console.log(`Heap-profile summary written to ${summaryOut}`);
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
  await server.stop();
  await prepared.afterRun?.();
}
