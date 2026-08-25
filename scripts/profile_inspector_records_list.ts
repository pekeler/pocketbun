#!/usr/bin/env bun
// PocketBun-only maintainer helper: capture a targeted CPU profile for an in-process request load.

import { mkdirSync } from "node:fs";
import inspector from "node:inspector/promises";
import { dirname, resolve } from "node:path";
import { serve } from "../src/apis/serve.ts";
import { retryServerStart } from "../src/tests/helpers.ts";
import {
  finalizeBaseOptions,
  initBaseOptions,
  parseBaseArg,
  parsePositiveInt,
  requireValue,
  resolveAuthToken,
  runExternalLoad,
  type InspectorScenarioOptions,
} from "./profile_inspector_common.ts";
import { newScenarioApp, prepareScenario } from "./profile_scenarios.ts";

type Options = InspectorScenarioOptions & {
  intervalUs: number | null;
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
  --settle-ms <ms>          wait after scenario setup before profiling
                            default: 0
  --interval-us <n>         optional inspector sampling interval in microseconds
  --out <path>              output .cpuprofile path
                            default: .tmp/profile-inspector/<scenario>.cpuprofile
  -h, --help                show help
`);
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    ...initBaseOptions("list-records"),
    intervalUs: null,
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
    if (arg === "--interval-us") {
      options.intervalUs = parsePositiveInt(requireValue(argv, ++i, arg), arg);
      continue;
    }
    if (arg === "--out") {
      options.out = resolve(requireValue(argv, ++i, arg));
      continue;
    }
    throw new Error(`unknown argument: ${arg}`);
  }

  finalizeBaseOptions(options);
  options.out ??= resolve(`.tmp/profile-inspector/${options.scenario}.cpuprofile`);

  return options;
}

const options = parseArgs(Bun.argv.slice(2));
const outPath = options.out ?? resolve(`.tmp/profile-inspector/${options.scenario}.cpuprofile`);
mkdirSync(dirname(outPath), { recursive: true });

const session = new inspector.Session();
session.connect();

await using managed = await newScenarioApp(options.scenario);
const app = managed.app;
const runnerAuth = options.auth ?? "none";
const prepared = await prepareScenario(
  app,
  options.scenario,
  options.url,
  options.iterations == null ? null : options.iterations + (options.warmupRequests ?? 0),
);
const server = await retryServerStart(() => serve(app, { httpAddr: "127.0.0.1:0", showStartBanner: false }));

try {
  const baseUrl = `http://127.0.0.1:${server.port}`;
  const token = await resolveAuthToken(app, runnerAuth);
  await Bun.sleep(options.settleMs);

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
  console.log(`Settling period: ${options.settleMs}ms`);
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
