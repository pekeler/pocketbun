#!/usr/bin/env bun
// PocketBun-only maintainer helper: shared scenario-shaped inspector profiling utilities.

import type { Record as RecordModel } from "../src/core/record_model.ts";
import type { TestApp } from "../src/tests/app.ts";
import { CollectionNameSuperusers } from "../src/core/collection_model.ts";
import {
  defaultAuth,
  defaultUrl,
  defaultWarmupRequests,
  isScenario,
  type AuthMode,
  type Scenario,
} from "./profile_scenarios.ts";

export type InspectorScenarioOptions = {
  auth: AuthMode | null;
  concurrency: number;
  durationMs: number | null;
  iterations: number | null;
  out: string | null;
  scenario: Scenario;
  settleMs: number;
  url: string;
  warmupRequests: number | null;
};

export function initBaseOptions(defaultScenario: Scenario): InspectorScenarioOptions {
  return {
    auth: null,
    concurrency: 16,
    durationMs: 3000,
    iterations: null,
    out: null,
    scenario: defaultScenario,
    settleMs: 0,
    url: defaultUrl(defaultScenario),
    warmupRequests: null,
  };
}

export function parseBaseArg(options: InspectorScenarioOptions, argv: string[], index: number): number | null {
  const arg = argv[index];
  if (arg === "--scenario") {
    const value = requireValue(argv, index + 1, arg);
    if (!isScenario(value)) {
      throw new Error(`invalid --scenario value: ${value}`);
    }
    options.scenario = value;
    options.url = defaultUrl(value);
    return index + 1;
  }
  if (arg === "--url") {
    options.url = requireValue(argv, index + 1, arg);
    return index + 1;
  }
  if (arg === "--auth") {
    const value = requireValue(argv, index + 1, arg);
    if (value !== "none" && value !== "user" && value !== "superuser") {
      throw new Error(`invalid --auth value: ${value}`);
    }
    options.auth = value;
    return index + 1;
  }
  if (arg === "--duration-ms") {
    options.durationMs = parsePositiveInt(requireValue(argv, index + 1, arg), arg);
    options.iterations = null;
    return index + 1;
  }
  if (arg === "--iterations") {
    options.iterations = parsePositiveInt(requireValue(argv, index + 1, arg), arg);
    options.durationMs = null;
    return index + 1;
  }
  if (arg === "--concurrency") {
    options.concurrency = parsePositiveInt(requireValue(argv, index + 1, arg), arg);
    return index + 1;
  }
  if (arg === "--warmup-requests") {
    options.warmupRequests = parseNonNegativeInt(requireValue(argv, index + 1, arg), arg);
    return index + 1;
  }
  if (arg === "--settle-ms") {
    options.settleMs = parseNonNegativeInt(requireValue(argv, index + 1, arg), arg);
    return index + 1;
  }
  if (arg === "-h" || arg === "--help") {
    return index;
  }
  return null;
}

export function finalizeBaseOptions(options: InspectorScenarioOptions): void {
  options.auth ??= defaultAuth(options.scenario);
  options.warmupRequests ??= defaultWarmupRequests(options.scenario);
}

export function requireValue(argv: string[], index: number, flag: string): string {
  const value = argv[index];
  if (!value) {
    throw new Error(`missing value for ${flag}`);
  }
  return value;
}

export function parsePositiveInt(raw: string, flag: string): number {
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${flag} must be a positive integer`);
  }
  return value;
}

export function parseNonNegativeInt(raw: string, flag: string): number {
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${flag} must be a non-negative integer`);
  }
  return value;
}

export async function resolveAuthToken(app: TestApp, auth: AuthMode): Promise<string | null> {
  if (auth === "none") {
    return null;
  }

  if (auth === "superuser") {
    return app.FindAuthRecordByEmail(CollectionNameSuperusers, "test@example.com").NewAuthToken();
  }

  return (app.RecordQuery("users").OrderBy("id").Limit(1).One() as RecordModel).NewAuthToken();
}

export async function runExternalLoad(
  baseUrl: string,
  token: string | null,
  options: Pick<InspectorScenarioOptions, "concurrency" | "durationMs" | "iterations" | "scenario" | "url" | "warmupRequests">,
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
