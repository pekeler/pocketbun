// PocketBun-only: runs the vendored upstream PocketBase benchmark suite locally.
//
// This follows vendor/pocketbase-benchmarks/README.md "Run the benchmarks":
// 1) go build
// 2) run the created executable with `serve`

import type { AddressInfo } from "node:net";
import { Database } from "bun:sqlite";
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { bench, setBenchIterationLimit } from "./bench_upstream_pocketbun/bench.ts";
import { BenchRequest } from "./bench_upstream_pocketbun/request.ts";
import { benchmarkSchema } from "./bench_upstream_pocketbun/schema.ts";

type GoBuildConfig = {
  goos: string;
  goarch: string;
  cgoEnabled: string;
  outputPath: string;
};

const benchmarkRunOverrideFile = process.env.POCKETBUN_BENCHMARK_RUN_FILE ?? "/tmp/pocketbun-bench-upstream-run.txt";
const benchmarkRun = await resolveBenchmarkRun(benchmarkRunOverrideFile);
const benchmarkSourceRevision = (await readFile("pocketbase_benchmarks_commit.txt", "utf8")).trim();
if (!/^[0-9a-f]{40}$/.test(benchmarkSourceRevision)) {
  throw new Error("pocketbase_benchmarks_commit.txt must contain a full Git commit hash");
}
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
  300,
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
const externalLoadUrl = process.env.POCKETBUN_BENCH_EXTERNAL_LOAD_URL?.trim() ?? "";
const targetHost = process.env.POCKETBUN_BENCH_TARGET_HOST?.trim() ?? "";
if (externalLoadUrl && !targetHost) {
  throw new Error("POCKETBUN_BENCH_TARGET_HOST is required with POCKETBUN_BENCH_EXTERNAL_LOAD_URL");
}
const benchmarkBaseUrl = targetHost ? `http://${targetHost}:${port}` : baseUrl;
const runRootDir = await mkdtemp(join(tmpdir(), "pocketbase-bench-run-"));
const dataDir = join(runRootDir, "pb_data");
const buildDir = await mkdtemp(join(tmpdir(), "pocketbase-bench-build-"));

await cp(upstreamBenchRootDir, sourceDir, { recursive: true, force: true });
if (shouldUseSharedClientTransport(benchmarkTransportMode)) {
  console.log("Applying PocketBun local transport patch for upstream benchmark requester...");
  await applySharedClientTransportPatch(sourceDir);
}
await applyBenchErrorCollectionPatch(sourceDir, benchmarkDebugErrors);
if (externalLoadUrl) {
  await applyExternalLoadPatch(sourceDir);
}
await applyFullSuiteWarmupPatch(sourceDir);

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
  cmd: [executablePath, "serve", `--http=${externalLoadUrl ? "0.0.0.0" : "127.0.0.1"}:${port}`, `--dir=${dataDir}`],
  cwd: sourceDir,
  env: {
    ...process.env,
    POCKETBUN_BENCHMARK_WARMUP_REQUESTS: String(benchmarkWarmupRequests),
  },
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
      `- benchmark source: ${benchmarkSourceRevision}`,
      `- upstream build target: ${upstreamBuildGoos}/${upstreamBuildGoarch}`,
      `- upstream build cgo: ${upstreamBuildCgoEnabled}`,
      `- executable used: ${basename(executablePath)}`,
      `- load generator: ${externalLoadUrl || "co-located"}`,
      `- benchmark target host: ${targetHost || "loopback"}`,
      `- warmup request target/cap: ${benchmarkWarmupRequests}`,
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
      `- benchmark source: ${benchmarkSourceRevision}`,
      `- upstream build target: ${upstreamBuildGoos}/${upstreamBuildGoarch}`,
      `- upstream build cgo: ${upstreamBuildCgoEnabled}`,
      `- executable used: ${basename(executablePath)}`,
      `- load generator: ${externalLoadUrl || "co-located"}`,
      `- benchmark target host: ${targetHost || "loopback"}`,
      `- warmup request target/cap: ${benchmarkWarmupRequests}`,
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

async function applyFullSuiteWarmupPatch(rootDir: string): Promise<void> {
  const benchPath = join(rootDir, "benchmarks", "bench.go");
  const runPath = join(rootDir, "benchmarks", "run.go");
  const createPath = join(rootDir, "benchmarks", "test_create.go");

  const benchOriginal = await readFile(benchPath, "utf8");
  const benchPatched = benchOriginal
    .replace(
      `// A negative concurrency indicates no limit
// (aka. a go routine will be fired for each iteration).
func bench(action func(i int) error, iterations int, concurrency int) (*BenchResult, error) {`,
      `var benchmarkIterationLimit int

func benchmarkWarmupIterations(iterations int) int {
	if benchmarkIterationLimit > iterations {
		return benchmarkIterationLimit
	}
	return iterations
}

// A negative concurrency indicates no limit
// (aka. a go routine will be fired for each iteration).
func bench(action func(i int) error, iterations int, concurrency int) (*BenchResult, error) {`,
    )
    .replace(
      `\tif iterations < 1 {
\t\treturn nil, errors.New("iterations must be >= 1")
\t}`,
      `\tif iterations < 1 {
\t\treturn nil, errors.New("iterations must be >= 1")
\t}
\tif benchmarkIterationLimit > 0 && iterations > benchmarkIterationLimit {
\t\titerations = benchmarkIterationLimit
\t}`,
    );
  if (
    benchPatched === benchOriginal ||
    !benchPatched.includes("var benchmarkIterationLimit int") ||
    !benchPatched.includes("func benchmarkWarmupIterations(iterations int) int") ||
    !benchPatched.includes("iterations = benchmarkIterationLimit")
  ) {
    throw new Error(`failed to patch ${benchPath} for benchmark warmup`);
  }

  const runOriginal = await readFile(runPath, "utf8");
  const runPatched = runOriginal.replace(`\t"os"\n\t"strings"`, `\t"os"\n\t"strconv"\n\t"strings"`).replace(
    `\t\t\troutine.FireAndForget(func() {
\t\t\t\t// the response was already commited, so we just log the error
\t\t\t\tif err := r.run(toRun); err != nil {
\t\t\t\t\tlog.Println("Run error: ", err)
\t\t\t\t}

\t\t\t\tapp.Store().Remove(benchmarkStartedKey)
\t\t\t})`,
    `\t\t\troutine.FireAndForget(func() {
\t\t\t\tvar runErr error
\t\t\t\twarmupRequests, _ := strconv.Atoi(os.Getenv("POCKETBUN_BENCHMARK_WARMUP_REQUESTS"))
\t\t\t\tif warmupRequests > 0 && len(toRun) > 0 && strings.TrimSpace(toRun[0]) == "create" {
\t\t\t\t\tlog.Printf("Running untimed benchmark warmup (%d-request target/cap per scenario)...\\n", warmupRequests)
\t\t\t\t\twarmup := runner{app: app, baseUrl: r.baseUrl, writers: map[io.Writer]AfterRunFunc{}}
\t\t\t\t\trunErr = func() error {
\t\t\t\t\t\tbenchmarkIterationLimit = warmupRequests
\t\t\t\t\t\tdefer func() { benchmarkIterationLimit = 0 }()
\t\t\t\t\t\tif err := warmup.run(toRun); err != nil {
\t\t\t\t\t\t\treturn err
\t\t\t\t\t\t}
\t\t\t\t\t\treturn nil
\t\t\t\t\t}()
\t\t\t\t\tif runErr == nil {
\t\t\t\t\t\tlog.Println("Untimed benchmark warmup completed.")
\t\t\t\t\t}
\t\t\t\t}
\t\t\t\tif runErr == nil {
\t\t\t\t\trunErr = r.run(toRun)
\t\t\t\t} else {
\t\t\t\t\trunErr = fmt.Errorf("benchmark warmup failed: %w", runErr)
\t\t\t\t\tfor _, afterRun := range r.writers {
\t\t\t\t\t\tif afterRun != nil {
\t\t\t\t\t\t\tafterRun(runErr)
\t\t\t\t\t\t}
\t\t\t\t\t}
\t\t\t\t}
\t\t\t\tif runErr != nil {
\t\t\t\t\tlog.Println("Run error: ", runErr)
\t\t\t\t}

\t\t\t\tapp.Store().Remove(benchmarkStartedKey)
\t\t\t})`,
  );
  if (runPatched === runOriginal || !runPatched.includes('strconv.Atoi(os.Getenv("POCKETBUN_BENCHMARK_WARMUP_REQUESTS"))')) {
    throw new Error(`failed to patch ${runPath} for benchmark warmup`);
  }

  const createOriginal = await readFile(createPath, "utf8");
  let createPatched = createOriginal;
  for (let i = 0; i < 2; i += 1) {
    createPatched = createPatched.replace(
      "}, s.iterations, s.concurrency)",
      "}, benchmarkWarmupIterations(s.iterations), s.concurrency)",
    );
  }
  if (createPatched === createOriginal || createPatched.split("benchmarkWarmupIterations(s.iterations)").length - 1 !== 2) {
    throw new Error(`failed to patch ${createPath} for short-scenario warmup targets`);
  }

  await Promise.all([writeFile(benchPath, benchPatched), writeFile(runPath, runPatched), writeFile(createPath, createPatched)]);
}

async function applyExternalLoadPatch(rootDir: string): Promise<void> {
  const benchPath = join(rootDir, "benchmarks", "bench.go");
  const requestPath = join(rootDir, "benchmarks", "request.go");
  const runPath = join(rootDir, "benchmarks", "run.go");
  const searchPath = join(rootDir, "benchmarks", "test_search.go");
  const externalPath = join(rootDir, "benchmarks", "external.go");

  const benchOriginal = await readFile(benchPath, "utf8");
  const benchPatched = benchOriginal.replace(
    `\tif iterations < 1 {
\t\treturn nil, errors.New("iterations must be >= 1")
\t}

\ttotalStart := time.Now()`,
    `\tif iterations < 1 {
\t\treturn nil, errors.New("iterations must be >= 1")
\t}

\tif externalLoadEnabled() {
\t\treturn externalBench(action, iterations, concurrency)
\t}

\ttotalStart := time.Now()`,
  );
  if (benchPatched === benchOriginal) {
    throw new Error(`failed to patch ${benchPath} for external load execution`);
  }

  const requestOriginal = await readFile(requestPath, "utf8");
  const requestPatched = requestOriginal.replace(
    `func (c *Request) Send(destBodyPtr any) error {
\tif c.Context == nil {`,
    `func (c *Request) Send(destBodyPtr any) error {
\tif captured, err := captureExternalRequest(c, destBodyPtr); captured {
\t\treturn err
\t}

\tif c.Context == nil {`,
  );
  if (requestPatched === requestOriginal) {
    throw new Error(`failed to patch ${requestPath} for external request capture`);
  }

  const runOriginal = await readFile(runPath, "utf8");
  const runPatched = runOriginal.replace(
    `baseUrl: "http://" + se.Server.Addr,`,
    `baseUrl: resolveExternalBenchmarkBaseURL("http://" + se.Server.Addr),`,
  );
  if (runPatched === runOriginal) {
    throw new Error(`failed to patch ${runPath} for the external target address`);
  }

  const searchOriginal = await readFile(searchPath, "utf8");
  const mixedWritesOriginal = `\t\t\tscenario{"mixed read and write (simpleA list with additional 300 concurrent random " + col + " updates running in the background)", 1000, 1000, col, "?perPage=20", "", []string{}, func() error {
\t\t\t\tg := errgroup.Group{}
\t\t\t\tg.SetLimit(-1)

\t\t\t\tids, err := r.randomRecordIds(col, 300)
\t\t\t\tif err != nil {
\t\t\t\t\treturn err
\t\t\t\t}

\t\t\t\tfor _, id := range ids {
\t\t\t\t\tid := id
\t\t\t\t\tg.Go(func() error {
\t\t\t\t\t\treq := Request{
\t\t\t\t\t\t\tUrl:    r.baseUrl + "/api/collections/" + col + "/records/" + id,
\t\t\t\t\t\t\tMethod: "PATCH",
\t\t\t\t\t\t\tBody:   strings.NewReader(\`{"title": "update\` + id + \`"}\`),
\t\t\t\t\t\t\tHeaders: map[string]string{
\t\t\t\t\t\t\t\t"Authorization": userToken,
\t\t\t\t\t\t\t},
\t\t\t\t\t\t}

\t\t\t\t\t\treturn req.Send(nil)
\t\t\t\t\t})
\t\t\t\t}

\t\t\t\treturn g.Wait()
\t\t\t}},`;
  const mixedWritesPatched = `\t\t\tscenario{"mixed read and write (simpleA list with additional 300 concurrent random " + col + " updates running in the background)", 1000, 1000, col, "?perPage=20", "", []string{}, func() error {
\t\t\t\tids, err := r.randomRecordIds(col, 300)
\t\t\t\tif err != nil {
\t\t\t\t\treturn err
\t\t\t\t}

\t\t\t\tresult, err := bench(func(i int) error {
\t\t\t\t\tid := ids[i]
\t\t\t\t\treq := Request{
\t\t\t\t\t\tUrl:    r.baseUrl + "/api/collections/" + col + "/records/" + id,
\t\t\t\t\t\tMethod: "PATCH",
\t\t\t\t\t\tBody:   strings.NewReader(\`{"title": "update\` + id + \`"}\`),
\t\t\t\t\t\tHeaders: map[string]string{
\t\t\t\t\t\t\t"Authorization": userToken,
\t\t\t\t\t\t},
\t\t\t\t\t}

\t\t\t\t\treturn req.Send(nil)
\t\t\t\t}, len(ids), -1)
\t\t\t\tif err != nil {
\t\t\t\t\treturn err
\t\t\t\t}
\t\t\t\tif len(result.Errors) > 0 {
\t\t\t\t\treturn result.Errors[0]
\t\t\t\t}

\t\t\t\treturn nil
\t\t\t}},`;
  const searchPatched = searchOriginal.replace(mixedWritesOriginal, mixedWritesPatched);
  if (searchPatched === searchOriginal) {
    throw new Error(`failed to patch ${searchPath} for external mixed writes`);
  }

  const externalSource = `package benchmarks

// PocketBun-only: move timed upstream benchmark requests to a separate load-generator host.

import (
\t"bytes"
\t"encoding/json"
\t"errors"
\t"fmt"
\t"io"
\t"net"
\t"net/http"
\t"net/url"
\t"os"
\t"strings"
\t"sync"
\t"time"
)

type externalRequest struct {
\tBody    *string           \`json:"body"\`
\tHeaders map[string]string \`json:"headers"\`
\tMethod  string            \`json:"method"\`
\tURL     string            \`json:"url"\`
}

type externalBatch struct {
\tRequests    []externalRequest \`json:"requests"\`
\tConcurrency int               \`json:"concurrency"\`
\tPhase       string            \`json:"phase"\`
}

type externalResult struct {
\tBestMs      float64 \`json:"bestMs"\`
\tWorstMs     float64 \`json:"worstMs"\`
\tCompletedMs float64 \`json:"completedMs"\`
\tErrorCount  int     \`json:"errorCount"\`
\tSampleError string  \`json:"sampleError"\`
}

var externalCaptureMu sync.Mutex
var externalCaptured *[]externalRequest

func externalLoadEnabled() bool {
\treturn strings.TrimSpace(os.Getenv("POCKETBUN_BENCH_EXTERNAL_LOAD_URL")) != ""
}

func captureExternalRequest(request *Request, destBodyPtr any) (bool, error) {
\tif externalCaptured == nil {
\t\treturn false, nil
\t}
\tif destBodyPtr != nil {
\t\treturn true, errors.New("external benchmark capture does not support response bodies")
\t}

\theaders := make(map[string]string, len(request.Headers)+1)
\tfor name, value := range request.Headers {
\t\theaders[name] = value
\t}
\tif _, ok := headers["content-type"]; !ok {
\t\theaders["content-type"] = "application/json"
\t}

\tvar body *string
\tif request.Body != nil {
\t\traw, err := io.ReadAll(request.Body)
\t\tif err != nil {
\t\t\treturn true, err
\t\t}
\t\tvalue := string(raw)
\t\tbody = &value
\t}

\t*externalCaptured = append(*externalCaptured, externalRequest{
\t\tBody: body, Headers: headers, Method: request.Method, URL: request.Url,
\t})
\treturn true, nil
}

func externalBench(action func(i int) error, iterations int, concurrency int) (*BenchResult, error) {
\texternalCaptureMu.Lock()
\trequests := make([]externalRequest, 0, iterations)
\texternalCaptured = &requests
\tpreparationErrors := make([]error, 0)
\tfor i := 0; i < iterations; i++ {
\t\tif err := action(i); err != nil {
\t\t\tpreparationErrors = append(preparationErrors, err)
\t\t}
\t}
\texternalCaptured = nil
\texternalCaptureMu.Unlock()

\tphase := "measurement"
\tif benchmarkIterationLimit > 0 {
\t\tphase = "warmup"
\t}
\tpayload, err := json.Marshal(externalBatch{Requests: requests, Concurrency: concurrency, Phase: phase})
\tif err != nil {
\t\treturn nil, err
\t}
\tendpoint := strings.TrimRight(os.Getenv("POCKETBUN_BENCH_EXTERNAL_LOAD_URL"), "/") + "/run"
\treq, err := http.NewRequest(http.MethodPost, endpoint, bytes.NewReader(payload))
\tif err != nil {
\t\treturn nil, err
\t}
\treq.Header.Set("Content-Type", "application/json")
\treq.Header.Set("X-PocketBun-Benchmark-Token", os.Getenv("POCKETBUN_BENCH_EXTERNAL_LOAD_TOKEN"))

\tresponse, err := customClient.Do(req)
\tif err != nil {
\t\treturn nil, err
\t}
\tdefer response.Body.Close()
\tresponseBody, err := io.ReadAll(response.Body)
\tif err != nil {
\t\treturn nil, err
\t}
\tif response.StatusCode >= 400 {
\t\treturn nil, fmt.Errorf("external benchmark load service failed with status %d: %s", response.StatusCode, responseBody)
\t}

\tvar remote externalResult
\tif err := json.Unmarshal(responseBody, &remote); err != nil {
\t\treturn nil, err
\t}
\tif remote.BestMs < 0 || remote.WorstMs < 0 || remote.CompletedMs < 0 || remote.ErrorCount < 0 || remote.ErrorCount > len(requests) {
\t\treturn nil, errors.New("external benchmark load service returned invalid metrics")
\t}

\tresultErrors := append([]error{}, preparationErrors...)
\tfor i := 0; i < remote.ErrorCount; i++ {
\t\tmessage := "external request failed"
\t\tif i == 0 && remote.SampleError != "" {
\t\t\tmessage = remote.SampleError
\t\t}
\t\tresultErrors = append(resultErrors, errors.New(message))
\t}
\treturn &BenchResult{
\t\tBest: time.Duration(remote.BestMs * float64(time.Millisecond)),
\t\tWorst: time.Duration(remote.WorstMs * float64(time.Millisecond)),
\t\tCompleted: time.Duration(remote.CompletedMs * float64(time.Millisecond)),
\t\tErrors: resultErrors,
\t}, nil
}

func resolveExternalBenchmarkBaseURL(fallback string) string {
\thost := strings.TrimSpace(os.Getenv("POCKETBUN_BENCH_TARGET_HOST"))
\tif !externalLoadEnabled() || host == "" {
\t\treturn fallback
\t}
\tparsed, err := url.Parse(fallback)
\tif err != nil || parsed.Port() == "" {
\t\treturn fallback
\t}
\tparsed.Host = net.JoinHostPort(host, parsed.Port())
\treturn parsed.String()
}
`;

  await Promise.all([
    writeFile(benchPath, benchPatched),
    writeFile(requestPath, requestPatched),
    writeFile(runPath, runPatched),
    writeFile(searchPath, searchPatched),
    writeFile(externalPath, externalSource),
  ]);
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
              iterations: 5_000,
              concurrency: 10,
              payload: (index) => ({ name: `probe-org-${runTag}-${index}` }),
            },
            {
              collection: "organizations",
              rule: "@request.body.name != ''",
              iterations: 5_000,
              concurrency: 10,
              payload: (index) => ({ name: `probe-org-rule-${runTag}-${index}` }),
            },
            {
              collection: "permissions",
              rule: "",
              iterations: 2_500,
              concurrency: 5,
              payload: (index) => ({ name: `probe-perm-${runTag}-${index}`, active: index % 2 === 0 }),
            },
            {
              collection: "permissions",
              rule: "@request.body.name != ''",
              iterations: 2_500,
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
    clearCreateLatencyRecords(scenario.collection);
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

function clearCreateLatencyRecords(collection: CreateLatencyScenario["collection"]): void {
  if (collection === "users") {
    return;
  }
  const db = new Database(join(dataDir, "data.db"));
  try {
    db.run("PRAGMA busy_timeout = 10000");
    db.run(`DELETE FROM "${collection}"`);
  } finally {
    db.close();
  }
}

async function runCreateLatencyScenario(scenario: CreateLatencyScenario): Promise<CreateLatencyResult> {
  if (benchmarkWarmupRequests > 0) {
    await runCreateLatencyWarmup(scenario, benchmarkWarmupRequests);
  }

  const result = await bench(
    async (index) => {
      await new BenchRequest({
        Url: `${benchmarkBaseUrl}/api/collections/${scenario.collection}/records`,
        Method: "POST",
        Body: JSON.stringify(scenario.payload(index)),
      }).Send(null);
    },
    scenario.iterations,
    scenario.concurrency,
  );

  return {
    scenario,
    completedMs: result.CompletedMs,
    avgMs: result.AverageMs,
    p50Ms: result.P50Ms,
    p95Ms: result.P95Ms,
    errors: result.Errors.length,
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

  const indexOffset = 1_000_000;
  setBenchIterationLimit(total);
  try {
    const result = await bench(
      async (index) => {
        await new BenchRequest({
          Url: `${benchmarkBaseUrl}/api/collections/${scenario.collection}/records`,
          Method: "POST",
          Body: JSON.stringify(scenario.payload(indexOffset + index)),
        }).Send(null);
      },
      total,
      scenario.concurrency,
    );
    if (result.Errors.length > 0) {
      console.log(`  warmup errors (${scenario.collection}): ${result.Errors.length}/${total}`);
    }
  } finally {
    setBenchIterationLimit(0);
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
