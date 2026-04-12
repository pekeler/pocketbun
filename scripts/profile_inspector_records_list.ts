#!/usr/bin/env bun
// PocketBun-only maintainer helper: capture a targeted CPU profile for an in-process records-list load.

import { mkdirSync } from "node:fs";
import inspector from "node:inspector/promises";
import { dirname, resolve } from "node:path";
import { serve } from "../src/apis/serve.ts";
import { CollectionNameSuperusers } from "../src/core/collection_model.ts";
import { newTestApp } from "../src/tests/app.ts";
import { retryServerStart } from "../src/tests/helpers.ts";

type AuthMode = "none" | "user" | "superuser";

type Options = {
  auth: AuthMode;
  concurrency: number;
  durationMs: number;
  intervalUs: number | null;
  out: string;
  url: string;
  warmupRequests: number;
};

function usage(): void {
  console.log(`Usage:
  bun run scripts/profile_inspector_records_list.ts [options]

Options:
  --url <path>              Request path to profile
                            default: /api/collections/demo2/records?page=1&perPage=30
  --auth <mode>             one of: none, user, superuser
                            default: superuser
  --duration-ms <ms>        profile window duration in milliseconds
                            default: 3000
  --concurrency <n>         concurrent in-flight requests
                            default: 16
  --warmup-requests <n>     sequential warmup requests before profiling
                            default: 50
  --interval-us <n>         optional inspector sampling interval in microseconds
  --out <path>              output .cpuprofile path
                            default: .tmp/profile-inspector/records-list.cpuprofile
  -h, --help                show help
`);
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    auth: "superuser",
    concurrency: 16,
    durationMs: 3000,
    intervalUs: null,
    out: resolve(".tmp/profile-inspector/records-list.cpuprofile"),
    url: "/api/collections/demo2/records?page=1&perPage=30",
    warmupRequests: 50,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
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

async function resolveAuthToken(app: Awaited<ReturnType<typeof newTestApp>>["app"], auth: AuthMode): Promise<string | null> {
  if (auth === "none") {
    return null;
  }

  if (auth === "superuser") {
    return app.FindAuthRecordByEmail(CollectionNameSuperusers, "test@example.com").NewAuthToken();
  }

  return app.FindAuthRecordByEmail("users", "test@example.com").NewAuthToken();
}

async function warmup(baseUrl: string, url: string, headers: Headers, warmupRequests: number): Promise<void> {
  for (let i = 0; i < warmupRequests; i += 1) {
    const response = await fetch(`${baseUrl}${url}`, { headers });
    if (!response.ok) {
      throw new Error(`warmup request failed with status ${response.status}`);
    }
    await response.arrayBuffer();
  }
}

async function runLoad(
  baseUrl: string,
  url: string,
  headers: Headers,
  durationMs: number,
  concurrency: number,
): Promise<number> {
  const deadline = Date.now() + durationMs;
  let completed = 0;

  const worker = async () => {
    while (Date.now() < deadline) {
      const response = await fetch(`${baseUrl}${url}`, { headers });
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

const options = parseArgs(Bun.argv.slice(2));
mkdirSync(dirname(options.out), { recursive: true });

const session = new inspector.Session();
session.connect();

await using managed = await newTestApp();
const app = managed.app;
const server = await retryServerStart(() => serve(app, { httpAddr: "127.0.0.1:0", showStartBanner: false }));

try {
  const baseUrl = `http://127.0.0.1:${server.port}`;
  const token = await resolveAuthToken(app, options.auth);
  const headers = new Headers();
  if (token) {
    headers.set("Authorization", token);
  }

  await warmup(baseUrl, options.url, headers, options.warmupRequests);

  await session.post("Profiler.enable");
  if (options.intervalUs != null) {
    await session.post("Profiler.setSamplingInterval", { interval: options.intervalUs });
  }
  await session.post("Profiler.start");

  const completedRequests = await runLoad(baseUrl, options.url, headers, options.durationMs, options.concurrency);

  const { profile } = await session.post("Profiler.stop");
  await session.post("Profiler.disable");
  await Bun.write(options.out, `${JSON.stringify(profile, null, 2)}\n`);

  console.log(`Inspector profile written to ${options.out}`);
  console.log(`Completed requests: ${completedRequests}`);
  console.log(`Profiled URL: ${options.url}`);
  console.log(`Auth mode: ${options.auth}`);
  console.log(`Concurrency: ${options.concurrency}`);
  console.log(`Duration: ${options.durationMs}ms`);
} finally {
  session.disconnect();
  await server.stop();
}
