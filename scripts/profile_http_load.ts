#!/usr/bin/env bun
// PocketBun-only maintainer helper: generate HTTP load from a child process for cleaner server CPU profiles.

type Scenario = "list-records" | "create-organizations" | "create-organizations-rule" | "create-permissions" | "create-permissions-rule";

type Options = {
  authorization: string | null;
  baseUrl: string;
  concurrency: number;
  durationMs: number;
  scenario: Scenario;
  url: string;
  warmupRequests: number;
};

type ScenarioRequest = {
  init?: RequestInit;
  url: string;
};

function parseArgs(argv: string[]): Options {
  const options: Options = {
    authorization: null,
    baseUrl: "",
    concurrency: 1,
    durationMs: 1000,
    scenario: "list-records",
    url: "/api/collections/demo2/records?page=1&perPage=30",
    warmupRequests: 0,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--base-url") {
      options.baseUrl = requireValue(argv, ++i, arg);
      continue;
    }
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
    if (arg === "--authorization") {
      options.authorization = requireValue(argv, ++i, arg);
      continue;
    }
    if (arg === "--url") {
      options.url = requireValue(argv, ++i, arg);
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
      console.log(`Usage:
  bun run scripts/profile_http_load.ts --base-url <url> --scenario <name> [options]

Options:
  --authorization <token>  optional Authorization header value
  --url <path>             list-records request path
  --duration-ms <ms>       load window duration in milliseconds
  --concurrency <n>        concurrent in-flight requests
  --warmup-requests <n>    sequential warmup requests before profiling
`);
      process.exit(0);
    }
    throw new Error(`unknown argument: ${arg}`);
  }

  if (!options.baseUrl) {
    throw new Error("missing --base-url");
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

function buildRequest(options: Options, headers: Headers, index: number, runTag: string): ScenarioRequest {
  if (options.scenario === "create-organizations" || options.scenario === "create-organizations-rule") {
    return {
      url: `${options.baseUrl}/api/collections/organizations/records`,
      init: {
        method: "POST",
        headers: new Headers({ ...Object.fromEntries(headers.entries()), "Content-Type": "application/json" }),
        body: JSON.stringify({ name: `profile-org-${runTag}-${index}` }),
      },
    };
  }

  if (options.scenario === "create-permissions" || options.scenario === "create-permissions-rule") {
    return {
      url: `${options.baseUrl}/api/collections/permissions/records`,
      init: {
        method: "POST",
        headers: new Headers({ ...Object.fromEntries(headers.entries()), "Content-Type": "application/json" }),
        body: JSON.stringify({
          active: index % 2 === 0,
          name: `profile-perm-${runTag}-${index}`,
        }),
      },
    };
  }

  return {
    url: `${options.baseUrl}${options.url}`,
    init: { headers },
  };
}

async function warmup(options: Options, headers: Headers, runTag: string): Promise<void> {
  for (let i = 0; i < options.warmupRequests; i += 1) {
    const request = buildRequest(options, headers, i, runTag);
    const response = await fetch(request.url, request.init);
    if (!response.ok) {
      throw new Error(`warmup request failed with status ${response.status}`);
    }
    await response.arrayBuffer();
  }
}

async function runLoad(options: Options, headers: Headers, runTag: string): Promise<number> {
  const deadline = Date.now() + options.durationMs;
  let completed = 0;
  let nextIndex = 0;

  const worker = async () => {
    while (Date.now() < deadline) {
      const index = nextIndex;
      nextIndex += 1;
      const request = buildRequest(options, headers, index, runTag);
      const response = await fetch(request.url, request.init);
      if (!response.ok) {
        throw new Error(`profile request failed with status ${response.status}`);
      }
      await response.arrayBuffer();
      completed += 1;
    }
  };

  await Promise.all(Array.from({ length: options.concurrency }, () => worker()));
  return completed;
}

const options = parseArgs(Bun.argv.slice(2));
const headers = new Headers();
if (options.authorization) {
  headers.set("Authorization", options.authorization);
}

const runTag = Date.now().toString(36);
await warmup(options, headers, runTag);
const completedRequests = await runLoad(options, headers, runTag);

console.log(JSON.stringify({ completedRequests }));
