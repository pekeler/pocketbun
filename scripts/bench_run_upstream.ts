// PocketBun-only: runs the vendored upstream PocketBase benchmark suite locally.
//
// This follows vendor/pocketbase-benchmarks/README.md "Run the benchmarks":
// 1) go build
// 2) run the created executable with `serve`

import type { AddressInfo } from "node:net";
import { cp, mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

type GoBuildConfig = {
  goos: string;
  goarch: string;
  cgoEnabled: string;
  outputPath: string;
};

const benchmarkRun = process.env.POCKETBUN_BENCHMARK_RUN ?? "create,auth,search,custom,delete";
const machineTag = sanitizeTag(process.env.POCKETBUN_BENCH_MACHINE_TAG ?? "m2-max");
const timestampTag = createTimestampTag(new Date());
const resultsDir = process.env.POCKETBUN_BENCH_RESULTS_DIR ?? "benchmarks/results";
const repoResultFile =
  process.env.POCKETBUN_BENCHMARK_RESULT_FILE ??
  join(resultsDir, `${timestampTag}-pocketbase-upstream-${machineTag}.md`);
const latestResultFile = process.env.POCKETBUN_BENCHMARK_RESULT_LATEST_FILE ?? "/tmp/pocketbase-benchmarks-latest.txt";

const serverReadyTimeoutMs = 60_000;
const benchmarkTimeoutMs = 90 * 60_000;
const pollIntervalMs = 5_000;

const goBinary = process.env.POCKETBUN_GO_BIN ?? "/opt/homebrew/bin/go";
const upstreamBuildGoos = process.env.POCKETBUN_UPSTREAM_BUILD_GOOS ?? "linux";
const upstreamBuildGoarch = process.env.POCKETBUN_UPSTREAM_BUILD_GOARCH ?? "amd64";
const upstreamBuildCgoEnabled = process.env.POCKETBUN_UPSTREAM_BUILD_CGO_ENABLED ?? "0";
const upstreamBenchRootDir = "vendor/pocketbase-benchmarks";

const port = await pickPort();
const baseUrl = `http://127.0.0.1:${port}`;
const runRootDir = await mkdtemp(join(tmpdir(), "pocketbase-bench-run-"));
const dataDir = join(runRootDir, "pb_data");
const buildDir = await mkdtemp(join(tmpdir(), "pocketbase-bench-build-"));

await mkdir(dataDir, { recursive: true });
await copyDirIfExists(join(upstreamBenchRootDir, "pb_hooks"), join(runRootDir, "pb_hooks"));
await copyDirIfExists(join(upstreamBenchRootDir, "pb_migrations"), join(runRootDir, "pb_migrations"));

const upstreamBinaryPath = join(buildDir, "app-upstream");
const hostBinaryPath = join(buildDir, "app-host");

await runGoBuild({
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
  cwd: upstreamBenchRootDir,
  env: { ...process.env },
  stdio: ["ignore", "inherit", "inherit"],
});

try {
  await ensureServerReady();

  const trigger = await fetch(`${baseUrl}/benchmarks?run=${encodeURIComponent(benchmarkRun)}`);
  if (!trigger.ok) {
    throw new Error(`failed to start upstream benchmarks: HTTP ${trigger.status}`);
  }

  const triggerText = (await trigger.text()).trim();
  console.log(`\nUpstream benchmark trigger response: ${triggerText}`);
  console.log(`Waiting for completion (run=${benchmarkRun})...`);

  const token = await authSuperuser();
  const result = await waitForBenchmarkResult(token);

  console.log("\nUpstream benchmark result");
  console.log(`  tests: ${String(result.tests ?? "")}`);
  if (typeof result.error === "string" && result.error !== "") {
    console.log(`  error: ${result.error}`);
    throw new Error(`upstream benchmark reported error: ${result.error}`);
  }
  console.log("  status: completed");
  console.log("\nResult body:");
  const resultBody = String(result.result ?? "").trim();
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
} finally {
  serverProc.kill();
  await serverProc.exited;
  await rm(runRootDir, { recursive: true, force: true });
  await rm(buildDir, { recursive: true, force: true });
}

async function runGoBuild(config: GoBuildConfig): Promise<void> {
  const processEnv = {
    ...process.env,
    GOOS: config.goos,
    GOARCH: config.goarch,
    CGO_ENABLED: config.cgoEnabled,
  };

  const buildProc = Bun.spawn({
    cmd: [goBinary, "build", "-o", config.outputPath],
    cwd: upstreamBenchRootDir,
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
  return date.toISOString().replace(/:/g, "-").replace(/\.\d{3}Z$/, "Z");
}

function sanitizeTag(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9._-]+/g, "-");
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

async function waitForBenchmarkResult(token: string): Promise<{ tests?: unknown; result?: unknown; error?: unknown }> {
  const deadline = Date.now() + benchmarkTimeoutMs;

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
      if (latest && latest.tests === benchmarkRun) {
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
