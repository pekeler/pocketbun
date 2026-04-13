// PocketBun-only: runs the vendored upstream PocketBase benchmark suite locally.
//
// This follows vendor/pocketbase-benchmarks/README.md "Run the benchmarks":
// 1) go build
// 2) run the created executable with `serve`

import type { AddressInfo } from "node:net";
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { benchmarkSchema } from "./bench_upstream_pocketbun/schema.ts";

type GoBuildConfig = {
  goos: string;
  goarch: string;
  cgoEnabled: string;
  outputPath: string;
};

const benchmarkRunOverrideFile = process.env.POCKETBUN_BENCHMARK_RUN_FILE ?? "/tmp/pocketbun-bench-upstream-run.txt";
const benchmarkRun = await resolveBenchmarkRun(benchmarkRunOverrideFile);
const benchmarkTransportModeFile =
  process.env.POCKETBUN_BENCHMARK_TRANSPORT_MODE_FILE ?? "/tmp/pocketbun-bench-upstream-transport-mode.txt";
const benchmarkTransportMode = await resolveBenchmarkTransportMode(benchmarkTransportModeFile);
const benchmarkDebugErrorsFile =
  process.env.POCKETBUN_BENCHMARK_DEBUG_ERRORS_FILE ?? "/tmp/pocketbun-bench-upstream-debug-errors.txt";
const benchmarkDebugErrors = await resolveBooleanOverride(
  process.env.POCKETBUN_BENCHMARK_DEBUG_ERRORS,
  benchmarkDebugErrorsFile,
  false,
);
const benchmarkWarmupRequestsFile =
  process.env.POCKETBUN_BENCHMARK_WARMUP_REQUESTS_FILE ?? "/tmp/pocketbun-bench-upstream-warmup-requests.txt";
const benchmarkWarmupRequests = await resolveIntOverride(
  process.env.POCKETBUN_BENCHMARK_WARMUP_REQUESTS,
  benchmarkWarmupRequestsFile,
  0,
);
const machineTag = sanitizeTag(process.env.POCKETBUN_BENCH_MACHINE_TAG ?? "m2-max");
const timestampTag = createTimestampTag(new Date());
const resultsDir = process.env.POCKETBUN_BENCH_RESULTS_DIR ?? "benchmarks/results";
const repoResultFile =
  process.env.POCKETBUN_BENCHMARK_RESULT_FILE ?? join(resultsDir, `${timestampTag}-pocketbase-upstream-${machineTag}.md`);
const latestResultFile = process.env.POCKETBUN_BENCHMARK_RESULT_LATEST_FILE ?? "/tmp/pocketbase-benchmarks-latest.txt";

const serverReadyTimeoutMs = 60_000;
const benchmarkTimeoutMs = 90 * 60_000;
const pollIntervalMs = 5_000;
const probePassword = "1234567890";
const probeUserEmail = "users0@example.com";
const probeUserUsername = "users0";

const goBinary = process.env.POCKETBUN_GO_BIN ?? "/opt/homebrew/bin/go";
const upstreamBuildGoos = process.env.POCKETBUN_UPSTREAM_BUILD_GOOS ?? "linux";
const upstreamBuildGoarch = process.env.POCKETBUN_UPSTREAM_BUILD_GOARCH ?? "amd64";
const upstreamBuildCgoEnabled = process.env.POCKETBUN_UPSTREAM_BUILD_CGO_ENABLED ?? "0";
const upstreamBenchRootDir = "vendor/pocketbase-benchmarks";
const sourceDir = await mkdtemp(join(tmpdir(), "pocketbase-bench-source-"));

const port = await pickPort();
const baseUrl = `http://127.0.0.1:${port}`;
const runRootDir = await mkdtemp(join(tmpdir(), "pocketbase-bench-run-"));
const dataDir = join(runRootDir, "pb_data");
const buildDir = await mkdtemp(join(tmpdir(), "pocketbase-bench-build-"));

await cp(upstreamBenchRootDir, sourceDir, { recursive: true, force: true });
if (shouldUseSharedClientTransport(benchmarkTransportMode)) {
  console.log("Applying PocketBun local transport patch for upstream benchmark requester...");
  await applySharedClientTransportPatch(sourceDir);
}
await applyBenchErrorCollectionPatch(sourceDir, benchmarkDebugErrors);

await mkdir(dataDir, { recursive: true });
await copyDirIfExists(join(sourceDir, "pb_hooks"), join(runRootDir, "pb_hooks"));
await copyDirIfExists(join(sourceDir, "pb_migrations"), join(runRootDir, "pb_migrations"));

const upstreamBinaryPath = join(buildDir, "app-upstream");
const hostBinaryPath = join(buildDir, "app-host");

await runGoBuild({
  cwd: sourceDir,
  goos: upstreamBuildGoos,
  goarch: upstreamBuildGoarch,
  cgoEnabled: upstreamBuildCgoEnabled,
  outputPath: upstreamBinaryPath,
});

let executablePath = upstreamBinaryPath;

if (!isRunnableOnCurrentHost(upstreamBuildGoos, upstreamBuildGoarch)) {
  const hostGoos = mapNodePlatformToGoos(process.platform);
  const hostGoarch = mapNodeArchToGoarch(process.arch);

  console.log(
    `Built upstream target ${upstreamBuildGoos}/${upstreamBuildGoarch} (CGO_ENABLED=${upstreamBuildCgoEnabled}) per upstream docs.`,
  );
  console.log(`Building host target ${hostGoos}/${hostGoarch} to run benchmarks on this machine...`);

  await runGoBuild({
    cwd: sourceDir,
    goos: hostGoos,
    goarch: hostGoarch,
    cgoEnabled: upstreamBuildCgoEnabled,
    outputPath: hostBinaryPath,
  });

  executablePath = hostBinaryPath;
}

console.log(`Starting upstream benchmark server executable: ${basename(executablePath)}`);

const serverProc = Bun.spawn({
  cmd: [executablePath, "serve", `--http=127.0.0.1:${port}`, `--dir=${dataDir}`],
  cwd: sourceDir,
  env: { ...process.env },
  stdio: ["ignore", "inherit", "inherit"],
});

try {
  await ensureServerReady();

  if (
    benchmarkRun === "probe:create-errors" ||
    benchmarkRun === "probe:create-latency" ||
    benchmarkRun === "probe:create-organizations" ||
    benchmarkRun === "probe:create-users" ||
    benchmarkRun === "probe:create-users-upstream" ||
    benchmarkRun === "probe:auth-refresh"
  ) {
    const token = await authSuperuser();
    await importProbeSchema(token);

    const probeReport =
      benchmarkRun === "probe:create-errors"
        ? await runCreateErrorProbe(token)
        : benchmarkRun === "probe:auth-refresh"
          ? await runAuthRefreshProbe(token)
          : await runCreateLatencyProbe(
              token,
              benchmarkRun === "probe:create-organizations"
                ? "organizations-only"
                : benchmarkRun === "probe:create-users"
                  ? "users-only"
                  : benchmarkRun === "probe:create-users-upstream"
                    ? "users-upstream"
                    : "full",
            );

    const metadataHeader = [
      "# Upstream PocketBase Benchmark Probe",
      "",
      `- machine: ${machineTag}`,
      `- timestamp: ${new Date().toISOString()}`,
      `- mode: ${benchmarkRun}`,
      `- upstream build target: ${upstreamBuildGoos}/${upstreamBuildGoarch}`,
      `- upstream build cgo: ${upstreamBuildCgoEnabled}`,
      `- executable used: ${basename(executablePath)}`,
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
      throw new Error(`failed to start upstream benchmarks: HTTP ${trigger.status}`);
    }

    const triggerText = (await trigger.text()).trim();
    console.log(`\nUpstream benchmark trigger response: ${triggerText}`);
    console.log(`Waiting for completion (run=${benchmarkRun})...`);

    const token = await authSuperuser();
    const result = await waitForBenchmarkResult(token, benchmarkRun, benchmarkTimeoutMs);

    console.log("\nUpstream benchmark result");
    console.log(`  tests: ${formatUnknownText(result.tests)}`);
    if (typeof result.error === "string" && result.error !== "") {
      console.log(`  error: ${result.error}`);
      throw new Error(`upstream benchmark reported error: ${result.error}`);
    }
    console.log("  status: completed");
    console.log("\nResult body:");
    const resultBody = formatUnknownText(result.result).trim();
    console.log(resultBody || "(empty)");

    const metadataHeader = [
      "# Upstream PocketBase Benchmark Result",
      "",
      `- machine: ${machineTag}`,
      `- timestamp: ${new Date().toISOString()}`,
      `- tests: ${benchmarkRun}`,
      `- upstream build target: ${upstreamBuildGoos}/${upstreamBuildGoarch}`,
      `- upstream build cgo: ${upstreamBuildCgoEnabled}`,
      `- executable used: ${basename(executablePath)}`,
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
  serverProc.kill();
  await serverProc.exited;
  await rm(sourceDir, { recursive: true, force: true });
  await rm(runRootDir, { recursive: true, force: true });
  await rm(buildDir, { recursive: true, force: true });
}

async function runGoBuild(config: GoBuildConfig & { cwd: string }): Promise<void> {
  const processEnv = {
    ...process.env,
    GOOS: config.goos,
    GOARCH: config.goarch,
    CGO_ENABLED: config.cgoEnabled,
  };

  const buildProc = Bun.spawn({
    cmd: [goBinary, "build", "-mod=mod", "-o", config.outputPath],
    cwd: config.cwd,
    env: processEnv,
    stdio: ["ignore", "inherit", "inherit"],
  });

  const exitCode = await buildProc.exited;
  if (exitCode !== 0) {
    throw new Error(`go build failed (${config.goos}/${config.goarch}, exit=${exitCode})`);
  }
}

async function copyDirIfExists(source: string, destination: string): Promise<void> {
  try {
    await cp(source, destination, { recursive: true, force: true });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return;
    }
    throw error;
  }
}

function isRunnableOnCurrentHost(goos: string, goarch: string): boolean {
  const hostGoos = mapNodePlatformToGoos(process.platform);
  const hostGoarch = mapNodeArchToGoarch(process.arch);
  return goos === hostGoos && goarch === hostGoarch;
}

function mapNodePlatformToGoos(platform: NodeJS.Platform): string {
  switch (platform) {
    case "win32":
      return "windows";
    default:
      return platform;
  }
}

function mapNodeArchToGoarch(arch: string): string {
  switch (arch) {
    case "x64":
      return "amd64";
    case "ia32":
      return "386";
    case "arm":
      return "arm";
    case "arm64":
      return "arm64";
    default:
      return arch;
  }
}

function createTimestampTag(date: Date): string {
  return date
    .toISOString()
    .replace(/:/g, "-")
    .replace(/\.\d{3}Z$/, "Z");
}

function sanitizeTag(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9._-]+/g, "-");
}

type BenchmarkTransportMode = "auto" | "strict" | "shared-client";

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

async function resolveBenchmarkTransportMode(overrideFile: string): Promise<BenchmarkTransportMode> {
  const envMode = normalizeTransportMode(process.env.POCKETBUN_BENCHMARK_TRANSPORT_MODE);
  if (envMode) {
    return envMode;
  }

  try {
    const raw = await readFile(overrideFile, "utf8");
    const firstNonCommentLine = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line !== "" && !line.startsWith("#"));

    const fileMode = normalizeTransportMode(firstNonCommentLine);
    if (fileMode) {
      console.log(`Using benchmark transport mode override from ${overrideFile}: ${fileMode}`);
      return fileMode;
    }
  } catch (error) {
    const errno = error as NodeJS.ErrnoException;
    if (errno.code !== "ENOENT") {
      throw error;
    }
  }

  return "auto";
}

function normalizeTransportMode(value: string | null | undefined): BenchmarkTransportMode | null {
  const mode = value?.trim().toLowerCase();
  switch (mode) {
    case "auto":
    case "strict":
    case "shared-client":
      return mode;
    default:
      return null;
  }
}

function shouldUseSharedClientTransport(mode: BenchmarkTransportMode): boolean {
  if (mode === "shared-client") {
    return true;
  }
  if (mode === "strict") {
    return false;
  }
  return process.platform === "darwin";
}

async function applySharedClientTransportPatch(rootDir: string): Promise<void> {
  const requestPath = join(rootDir, "benchmarks", "request.go");
  const original = await readFile(requestPath, "utf8");

  if (original.includes("PocketBun-only: reuse a shared http.Client")) {
    return;
  }

  const withGlobals = original.replace(
    ")\n\ntype Request struct {",
    `)

// PocketBun-only: reuse a shared http.Client to avoid local ephemeral-port exhaustion
// during high-concurrency benchmark scenarios on hosts with stricter socket limits.
var sharedDialer = &net.Dialer{
\tTimeout:   30 * time.Second,
\tKeepAlive: 30 * time.Second,
}

var sharedClient = http.Client{
\tTransport: &http.Transport{
\t\tProxy: http.ProxyFromEnvironment,
\t\tDialContext: sharedDialer.DialContext,
\t\tMaxIdleConns:          1000,
\t\tMaxIdleConnsPerHost:   1000,
\t\tIdleConnTimeout:       120 * time.Second,
\t\tTLSHandshakeTimeout:   10 * time.Second,
\t\tExpectContinueTimeout: 1 * time.Second,
\t},
}

type Request struct {`,
  );

  const withImports = withGlobals.replace(
    `\t"net/http"
\t"time"`,
    `\t"net/http"
\t"strings"
\t"time"`,
  );

  const needle = `\tdialer := &net.Dialer{
\t\tTimeout:   30 * time.Second,
\t\tKeepAlive: 30 * time.Second,
\t}

\tclient := http.Client{
\t\tTransport: &http.Transport{
\t\t\tProxy:                 http.ProxyFromEnvironment,
\t\t\tDialContext:           dialer.DialContext,
\t\t\tMaxIdleConns:          0,
\t\t\tIdleConnTimeout:       120 * time.Second,
\t\t\tTLSHandshakeTimeout:   10 * time.Second,
\t\t\tExpectContinueTimeout: 1 * time.Second,
\t\t},
\t}

\tres, err := client.Do(req)`;
  const replacement = `\tvar res *http.Response
\tfor attempt := 0; attempt < 8; attempt++ {
\t\tres, err = sharedClient.Do(req)
\t\tif err == nil {
\t\t\tbreak
\t\t}
\t\tif !strings.Contains(err.Error(), "can't assign requested address") {
\t\t\treturn err
\t\t}
\t\ttime.Sleep(2 * time.Millisecond)
\t}
\tif err != nil {
\t\treturn err
\t}`;
  const withRequestPatch = withImports.replace(needle, replacement);
  // Drain every response body to EOF so shared keep-alive connections are reusable.
  const patched = withRequestPatch.replace(
    `\tif destBody != nil {
\t\tbodyRaw, err := io.ReadAll(res.Body)
\t\tif err != nil {
\t\t\treturn err
\t\t}

\t\tif err := json.Unmarshal(bodyRaw, destBody); err != nil {
\t\t\treturn err
\t\t}
\t}

\treturn nil`,
    `\tbodyRaw, err := io.ReadAll(res.Body)
\tif err != nil {
\t\treturn err
\t}

\tif destBody != nil {
\t\tif err := json.Unmarshal(bodyRaw, destBody); err != nil {
\t\t\treturn err
\t\t}
\t}

\treturn nil`,
  );

  if (patched === original || patched === withGlobals || patched === withImports || patched === withRequestPatch) {
    throw new Error(`failed to patch ${requestPath} for shared client transport`);
  }

  await writeFile(requestPath, patched);
}

async function applyBenchErrorCollectionPatch(rootDir: string, debugErrors: boolean): Promise<void> {
  const benchPath = join(rootDir, "benchmarks", "bench.go");
  const original = await readFile(benchPath, "utf8");
  if (original.includes("PocketBun-only: synchronize errors slice writes")) {
    return;
  }

  let patched = original;
  if (debugErrors) {
    patched = patched.replace(
      `"errors"
\t"fmt"
\t"time"`,
      `"errors"
\t"fmt"
\t"log"
\t"sync"
\t"time"`,
    );
  } else {
    patched = patched.replace(
      `"errors"
\t"fmt"
\t"time"`,
      `"errors"
\t"fmt"
\t"sync"
\t"time"`,
    );
  }

  const errorsVarsReplacement = debugErrors
    ? `var errors []error
\t// PocketBun-only: synchronize errors slice writes to avoid data races at high concurrency.
\tvar errorsMu sync.Mutex
\tloggedErrors := 0`
    : `var errors []error
\t// PocketBun-only: synchronize errors slice writes to avoid data races at high concurrency.
\tvar errorsMu sync.Mutex`;
  patched = patched.replace("var errors []error", errorsVarsReplacement);

  const replacementBody = debugErrors
    ? `\t\t\tif err := action(i); err != nil {
\t\t\t\terrorsMu.Lock()
\t\t\t\tif loggedErrors < 8 {
\t\t\t\t\tlog.Printf("bench error sample: %v\\n", err)
\t\t\t\t\tloggedErrors++
\t\t\t\t}
\t\t\t\terrors = append(errors, err)
\t\t\t\terrorsMu.Unlock()
\t\t\t}`
    : `\t\t\tif err := action(i); err != nil {
\t\t\t\terrorsMu.Lock()
\t\t\t\terrors = append(errors, err)
\t\t\t\terrorsMu.Unlock()
\t\t\t}`;

  patched = patched.replace(
    `\t\t\tif err := action(i); err != nil {
\t\t\t\terrors = append(errors, err)
\t\t\t}`,
    replacementBody,
  );

  if (patched === original) {
    throw new Error(`failed to patch ${benchPath} for synchronized error collection`);
  }

  await writeFile(benchPath, patched);
}

async function resolveBooleanOverride(
  envValue: string | undefined,
  overrideFile: string,
  defaultValue: boolean,
): Promise<boolean> {
  const parsedEnv = parseBoolean(envValue);
  if (parsedEnv !== null) {
    return parsedEnv;
  }

  try {
    const raw = await readFile(overrideFile, "utf8");
    const firstNonCommentLine = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line !== "" && !line.startsWith("#"));

    const parsedFile = parseBoolean(firstNonCommentLine);
    if (parsedFile !== null) {
      console.log(`Using boolean override from ${overrideFile}: ${parsedFile}`);
      return parsedFile;
    }
  } catch (error) {
    const errno = error as NodeJS.ErrnoException;
    if (errno.code !== "ENOENT") {
      throw error;
    }
  }

  return defaultValue;
}

async function resolveIntOverride(envValue: string | undefined, overrideFile: string, defaultValue: number): Promise<number> {
  const parsedEnv = parseNonNegativeInt(envValue);
  if (parsedEnv !== null) {
    return parsedEnv;
  }

  try {
    const raw = await readFile(overrideFile, "utf8");
    const firstNonCommentLine = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line !== "" && !line.startsWith("#"));

    const parsedFile = parseNonNegativeInt(firstNonCommentLine);
    if (parsedFile !== null) {
      console.log(`Using integer override from ${overrideFile}: ${parsedFile}`);
      return parsedFile;
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

  throw new Error("upstream benchmark server did not become ready in time");
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

type ProbeFailure = {
  kind: "http" | "transport";
  count: number;
  sample: string;
};

type ProbeAuthIdentity = {
  id: string;
  email: string;
  password: string;
};

type CreateLatencyScenario = {
  collection: "organizations" | "permissions" | "users";
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

type CreateLatencyProbeMode = "full" | "organizations-only" | "users-only" | "users-upstream";

type AuthRefreshScenario = {
  label: string;
  iterations: number;
  concurrency: number;
};

type AuthRefreshResult = {
  scenario: AuthRefreshScenario;
  completedMs: number;
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
  errors: number;
};

async function runAuthRefreshProbe(superuserToken: string): Promise<string> {
  const identity = await ensureProbeAuthIdentity(superuserToken);
  const authResponse = await fetch(`${baseUrl}/api/collections/users/auth-with-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      identity: identity.email,
      password: identity.password,
    }),
  });
  if (!authResponse.ok) {
    const body = compactErrorSample(await authResponse.text());
    throw new Error(`failed to auth probe user: HTTP ${authResponse.status} ${body}`);
  }
  const authPayload = (await authResponse.json()) as { token?: string };
  const authToken = authPayload.token ?? "";
  if (!authToken) {
    throw new Error("failed to read auth probe token");
  }

  const scenarios: AuthRefreshScenario[] = [
    { label: "high concurrency", iterations: 1000, concurrency: 1000 },
    { label: "medium concurrency", iterations: 1000, concurrency: 100 },
  ];

  const results: AuthRefreshResult[] = [];
  for (const scenario of scenarios) {
    console.log(
      `\nRunning upstream auth refresh probe (${scenario.label}, reqs=${scenario.iterations}, conc=${scenario.concurrency})...`,
    );
    const result = await runAuthRefreshScenario(scenario, authToken);
    results.push(result);
  }

  const reportLines = ["## Auth refresh probe", ""];
  for (const result of results) {
    reportLines.push(`### ${result.scenario.label}`);
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

async function runCreateErrorProbe(superuserToken: string): Promise<string> {
  const collection = "posts25k";
  const iterations = 12500;
  const concurrency = 500;
  const types = ["a", "b", "c", "d"];
  const probeIdentity = await ensureProbeAuthIdentity(superuserToken);
  const userIds = [probeIdentity.id];

  const updateCollectionResponse = await fetch(`${baseUrl}/api/collections/${collection}`, {
    method: "PATCH",
    headers: {
      Authorization: superuserToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ createRule: "" }),
  });
  if (!updateCollectionResponse.ok) {
    throw new Error(`failed to set ${collection}.createRule for probe: HTTP ${updateCollectionResponse.status}`);
  }

  console.log(
    `\nRunning upstream create probe (collection=${collection}, reqs=${iterations}, conc=${concurrency}, createRule="")...`,
  );

  let nextIndex = 0;
  const httpFailures = new Map<number, { count: number; sample: string }>();
  const transportFailures = new Map<string, { count: number; sample: string }>();

  const started = performance.now();
  const workerCount = Math.min(concurrency, iterations);
  const workers = Array.from({ length: workerCount }, async () => {
    while (true) {
      const i = nextIndex;
      nextIndex += 1;
      if (i >= iterations) {
        return;
      }

      const payload = {
        title: `${collection}-probe-${i}`,
        description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec sit amet sodales nisl, quis pretium nunc.",
        public: i % 2 !== 0,
        type: [types[i % types.length], types[(i + 1) % types.length]],
        author: userIds[i % userIds.length] ?? userIds[0] ?? "",
      };

      try {
        const response = await fetch(`${baseUrl}/api/collections/${collection}/records`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (response.status >= 400) {
          const sample = compactErrorSample(await response.text());
          const existing = httpFailures.get(response.status);
          if (existing) {
            existing.count += 1;
          } else {
            httpFailures.set(response.status, { count: 1, sample });
          }
        }
      } catch (error) {
        const sample = compactErrorSample(String(error));
        const existing = transportFailures.get(sample);
        if (existing) {
          existing.count += 1;
        } else {
          transportFailures.set(sample, { count: 1, sample });
        }
      }
    }
  });
  await Promise.all(workers);
  const completedMs = performance.now() - started;

  const failures: ProbeFailure[] = [];
  for (const [status, entry] of httpFailures) {
    failures.push({ kind: "http", count: entry.count, sample: `HTTP ${status}: ${entry.sample}` });
  }
  for (const entry of transportFailures.values()) {
    failures.push({ kind: "transport", count: entry.count, sample: entry.sample });
  }
  failures.sort((a, b) => b.count - a.count);

  const totalErrors = failures.reduce((sum, item) => sum + item.count, 0);

  const reportLines = [
    "## Create error probe",
    `- collection: ${collection}`,
    `- reqs: ${iterations}`,
    `- concurrency: ${concurrency}`,
    `- elapsed_ms: ${Math.round(completedMs)}`,
    `- total_errors: ${totalErrors}`,
    "",
    "### Failure buckets",
  ];

  if (failures.length === 0) {
    reportLines.push("- none");
  } else {
    for (const failure of failures) {
      reportLines.push(`- ${failure.kind}: ${failure.count} (${failure.sample})`);
    }
  }

  const report = reportLines.join("\n");
  console.log("\n" + report);
  return report;
}

async function runCreateLatencyProbe(superuserToken: string, mode: CreateLatencyProbeMode): Promise<string> {
  const runTag = Date.now();
  const usersProbeDependencies =
    mode === "users-only" || mode === "users-upstream"
      ? await ensureCreateUsersProbeDependencies(superuserToken, runTag)
      : null;
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
      : mode === "users-only" || mode === "users-upstream"
        ? [
            {
              collection: "users",
              rule: "",
              iterations: mode === "users-upstream" ? 250 : 150,
              concurrency: mode === "users-upstream" ? 50 : 25,
              payload: (index) => {
                const deps = usersProbeDependencies;
                if (!deps) {
                  throw new Error("missing users probe dependencies");
                }
                const username = `probe-user-${runTag}-${index}`;
                return {
                  email: `${username}@example.com`,
                  username,
                  name: username,
                  organization: deps.organizationId,
                  permissions: deps.permissionIds,
                  password: probePassword,
                  passwordConfirm: probePassword,
                };
              },
            },
            {
              collection: "users",
              rule: "@request.body.email != '' && @request.body.permissions:length > 0",
              iterations: mode === "users-upstream" ? 250 : 150,
              concurrency: mode === "users-upstream" ? 50 : 25,
              payload: (index) => {
                const deps = usersProbeDependencies;
                if (!deps) {
                  throw new Error("missing users probe dependencies");
                }
                const username = `probe-user-rule-${runTag}-${index}`;
                return {
                  email: `${username}@example.com`,
                  username,
                  name: username,
                  organization: deps.organizationId,
                  permissions: deps.permissionIds,
                  password: probePassword,
                  passwordConfirm: probePassword,
                };
              },
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
      `\nRunning upstream create latency probe (${scenario.collection}, reqs=${scenario.iterations}, conc=${scenario.concurrency}, rule=${JSON.stringify(scenario.rule)})...`,
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
            discardResponseBody(response);
          }
        } else {
          discardResponseBody(response);
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

async function runAuthRefreshScenario(scenario: AuthRefreshScenario, authToken: string): Promise<AuthRefreshResult> {
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
        const response = await fetch(`${baseUrl}/api/collections/users/auth-refresh`, {
          method: "POST",
          headers: {
            Authorization: authToken,
          },
        });

        if (response.status >= 400) {
          errors += 1;
          if (errors <= 4) {
            const sample = compactErrorSample(await response.text());
            console.log(`  sample auth-refresh error (${scenario.label}): HTTP ${response.status} ${sample}`);
          } else {
            discardResponseBody(response);
          }
        } else {
          discardResponseBody(response);
        }
      } catch (error) {
        errors += 1;
        if (errors <= 4) {
          console.log(`  sample auth-refresh transport error (${scenario.label}): ${compactErrorSample(String(error))}`);
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
        discardResponseBody(response);
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

type CreateUsersProbeDependencies = {
  organizationId: string;
  permissionIds: [string, string, string];
};

async function ensureCreateUsersProbeDependencies(
  superuserToken: string,
  runTag: number,
): Promise<CreateUsersProbeDependencies> {
  const organizationName = `probe-user-org-${runTag}`;
  const createOrganizationResponse = await fetch(`${baseUrl}/api/collections/organizations/records`, {
    method: "POST",
    headers: {
      Authorization: superuserToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: organizationName }),
  });
  if (!createOrganizationResponse.ok) {
    const body = compactErrorSample(await createOrganizationResponse.text());
    throw new Error(`failed to create users probe organization: HTTP ${createOrganizationResponse.status} ${body}`);
  }
  const createdOrganization = (await createOrganizationResponse.json()) as { id?: string };
  const organizationId = createdOrganization.id ?? "";
  if (!organizationId) {
    throw new Error("failed to read users probe organization id");
  }

  const permissionIds: string[] = [];
  for (let i = 0; i < 3; i += 1) {
    const createPermissionResponse = await fetch(`${baseUrl}/api/collections/permissions/records`, {
      method: "POST",
      headers: {
        Authorization: superuserToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: `probe-user-perm-${runTag}-${i}`,
        active: i % 2 === 0,
      }),
    });
    if (!createPermissionResponse.ok) {
      const body = compactErrorSample(await createPermissionResponse.text());
      throw new Error(`failed to create users probe permission: HTTP ${createPermissionResponse.status} ${body}`);
    }
    const createdPermission = (await createPermissionResponse.json()) as { id?: string };
    if (!createdPermission.id) {
      throw new Error("failed to read users probe permission id");
    }
    permissionIds.push(createdPermission.id);
  }

  return {
    organizationId,
    permissionIds: [permissionIds[0]!, permissionIds[1]!, permissionIds[2]!],
  };
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

function compactErrorSample(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, 240);
}

function discardResponseBody(response: Response): void {
  void response.body?.cancel();
}

function formatUnknownText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  if (value == null) {
    return "";
  }
  return JSON.stringify(value) ?? "";
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

async function waitForBenchmarkResult(
  token: string,
  runName: string,
  timeoutMs: number,
): Promise<{ tests?: unknown; result?: unknown; error?: unknown }> {
  const deadline = Date.now() + timeoutMs;

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
      if (latest && latest.tests === runName) {
        return latest;
      }
    }

    await delay(pollIntervalMs);
  }

  throw new Error("timed out waiting for upstream benchmark completion");
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
