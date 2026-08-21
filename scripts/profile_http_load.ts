#!/usr/bin/env bun
// PocketBun-only maintainer helper: generate HTTP load from a child process for cleaner server CPU profiles.

import { readFileSync } from "node:fs";
import { defaultUrl, isScenario, type Scenario } from "./profile_scenarios.ts";

type Options = {
  authorId: string | null;
  authorization: string | null;
  baseUrl: string;
  concurrency: number;
  deleteIds: string[] | null;
  durationMs: number | null;
  iterations: number | null;
  scenario: Scenario;
  url: string;
  warmupRequests: number;
};

type ScenarioRequest = {
  init?: RequestInit;
  url: string;
};

type LoadResult = {
  completedRequests: number;
  latencyMs: {
    p50: number;
    p95: number;
    p99: number;
  };
};

function parseArgs(argv: string[]): Options {
  const options: Options = {
    authorId: null,
    authorization: null,
    baseUrl: "",
    concurrency: 1,
    deleteIds: null,
    durationMs: 1000,
    iterations: null,
    scenario: "list-records",
    url: defaultUrl("list-records"),
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
      if (!isScenario(value)) {
        throw new Error(`invalid --scenario value: ${value}`);
      }
      options.scenario = value;
      options.url = defaultUrl(value);
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
    if (arg === "--author-id") {
      options.authorId = requireValue(argv, ++i, arg);
      continue;
    }
    if (arg === "--ids-file") {
      options.deleteIds = parseIdsFile(requireValue(argv, ++i, arg));
      continue;
    }
    if (arg === "-h" || arg === "--help") {
      console.log(`Usage:
  bun run scripts/profile_http_load.ts --base-url <url> --scenario <name> [options]

Options:
  --authorization <token>  optional Authorization header value
  --url <path>             list-records request path
  --duration-ms <ms>       load window duration in milliseconds
  --iterations <n>         fixed number of requests to send instead of a timed window
  --concurrency <n>        concurrent in-flight requests
  --warmup-requests <n>    sequential warmup requests before profiling
  --author-id <id>         record author id for create-posts scenarios
  --ids-file <path>        JSON file with delete record ids for delete scenarios
`);
      process.exit(0);
    }
    throw new Error(`unknown argument: ${arg}`);
  }

  if (!options.baseUrl) {
    throw new Error("missing --base-url");
  }
  if (options.durationMs == null && options.iterations == null) {
    throw new Error("one of --duration-ms or --iterations is required");
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

function parseIdsFile(path: string): string[] {
  const ids = JSON.parse(readFileSync(path, "utf8")) as unknown;
  if (!Array.isArray(ids) || ids.some((value) => typeof value !== "string" || value === "")) {
    throw new Error(`invalid ids payload in ${path}`);
  }
  return ids;
}

function buildRequest(options: Options, headers: Headers, index: number, runTag: string): ScenarioRequest {
  if (options.scenario === "create-posts10k" || options.scenario === "create-posts10k-rule") {
    const authorId = options.authorId;
    if (!authorId) {
      throw new Error(`scenario ${options.scenario} requires --author-id`);
    }
    return {
      url: `${options.baseUrl}/api/collections/posts10k/records`,
      init: {
        method: "POST",
        headers: new Headers({ ...Object.fromEntries(headers.entries()), "Content-Type": "application/json" }),
        body: JSON.stringify({
          title: `profile-post-${runTag}-${index}`,
          description:
            "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec sit amet sodales nisl, quis pretium nunc. Suspendisse vel auctor velit, sed luctus lectus. Phasellus rhoncus imperdiet feugiat. Duis et laoreet felis, ut facilisis enim. Quisque aliquet aliquam magna eget eleifend. Duis sed tellus nibh. Nunc ac lacus auctor, scelerisque magna congue, euismod purus. Fusce sollicitudin pharetra egestas. Quisque pulvinar augue nec aliquam placerat. Suspendisse dapibus ornare sodales.",
          public: index % 2 !== 0,
          type: [index % 2 === 0 ? "a" : "b", index % 3 === 0 ? "c" : "d"],
          author: authorId,
        }),
      },
    };
  }

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

  if (options.scenario === "delete-posts25k" || options.scenario === "delete-posts25k-rule") {
    const deleteIds = options.deleteIds;
    if (!deleteIds) {
      throw new Error(`scenario ${options.scenario} requires --ids-file`);
    }
    const id = deleteIds[index];
    if (!id) {
      throw new Error(`missing delete id for request index ${index}`);
    }
    return {
      url: `${options.baseUrl}/api/collections/posts25k/records/${id}`,
      init: {
        method: "DELETE",
        headers,
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

async function runLoad(options: Options, headers: Headers, runTag: string): Promise<LoadResult> {
  let completed = 0;
  let nextIndex = options.warmupRequests;
  const latenciesMs: number[] = [];
  const deadline = options.durationMs == null ? null : Date.now() + options.durationMs;
  const totalIterations = options.iterations ?? Number.POSITIVE_INFINITY;

  const worker = async () => {
    while (true) {
      const index = nextIndex;
      if (index >= totalIterations) {
        return;
      }
      if (
        (options.scenario === "delete-posts25k" || options.scenario === "delete-posts25k-rule") &&
        index >= (options.deleteIds?.length ?? 0)
      ) {
        return;
      }
      if (deadline != null && Date.now() >= deadline) {
        return;
      }
      nextIndex += 1;
      const request = buildRequest(options, headers, index, runTag);
      const start = performance.now();
      const response = await fetch(request.url, request.init);
      if (!response.ok) {
        throw new Error(`profile request failed with status ${response.status}`);
      }
      await response.arrayBuffer();
      latenciesMs.push(performance.now() - start);
      completed += 1;
    }
  };

  await Promise.all(Array.from({ length: options.concurrency }, () => worker()));
  latenciesMs.sort((left, right) => left - right);
  return {
    completedRequests: completed,
    latencyMs: {
      p50: percentile(latenciesMs, 0.5),
      p95: percentile(latenciesMs, 0.95),
      p99: percentile(latenciesMs, 0.99),
    },
  };
}

function percentile(sortedValues: number[], percentile: number): number {
  if (sortedValues.length === 0) {
    return 0;
  }
  return sortedValues[Math.min(Math.ceil(sortedValues.length * percentile) - 1, sortedValues.length - 1)]!;
}

const options = parseArgs(Bun.argv.slice(2));
const headers = new Headers();
if (options.authorization) {
  headers.set("Authorization", options.authorization);
}

const runTag = Date.now().toString(36);
await warmup(options, headers, runTag);
const result = await runLoad(options, headers, runTag);

console.log(JSON.stringify(result));
