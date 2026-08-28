// PocketBun-only: compare local PocketBase vs PocketBun RSS on idle/load and upload throughput.
//
// Why this file exists:
// The repository already has benchmark and upload probes, but this script keeps a
// simple local apples-to-apples memory comparison in one place so README notes can
// be backed by a reproducible command.

import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, open, readFile, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { cpus } from "node:os";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { readStreamText } from "./readable_stream.ts";

type Engine = "pocketbase" | "pocketbun";

type SampleSummary = {
  minBytes: number;
  maxBytes: number;
  meanBytes: number;
  lastBytes: number;
  samples: number;
};

type LoadMeasurement = {
  beforeBytes: number;
  peakBytes: number;
  meanBytes: number;
  afterBytes: number;
  peakDeltaBytes: number;
  completedRequests: number;
  failedRequests: number;
  durationMs: number;
  concurrency: number;
  url: string;
};

type UploadMeasurement = {
  fileSizeMiB: number;
  fileSizeBytes: number;
  beforeBytes: number;
  idleBytes: number;
  peakBytes: number;
  afterBytes: number;
  peakDeltaBytes: number;
  durationMs: number;
  throughputMiBsPerSec: number;
  statusCode: number;
};

type EngineMeasurement = {
  engine: Engine;
  idle: SampleSummary;
  load: LoadMeasurement;
  uploads: UploadMeasurement[];
};

type ComparisonResult = {
  generatedAt: string;
  host: {
    platform: NodeJS.Platform;
    arch: string;
    cpus: number;
    bunVersion: string;
  };
  versions: {
    pocketbaseTag: string;
    pocketbunVersion: string;
  };
  loadScenario: {
    endpoint: string;
    durationMs: number;
    concurrency: number;
    seededRecords: number;
  };
  uploadSizesMiB: number[];
  results: EngineMeasurement[];
  findings: string[];
};

type ParsedArgs = {
  uploadSizesMiB: number[];
  loadDurationMs: number;
  loadConcurrency: number;
  seededRecords: number;
  sampleIntervalMs: number;
  idleDurationMs: number;
  postUploadDurationMs: number;
  outputPath: string;
};

type RunningServer = {
  engine: Engine;
  dataDir: string;
  port: number;
  pid: number;
  baseUrl: string;
  stop: () => Promise<void>;
};

const pocketbaseUpstreamBuildDir = ".upstream/pocketbase/examples/base";
const pocketbaseGoBinary = process.env.POCKETBUN_GO_BIN ?? "/opt/homebrew/bin/go";
const pocketbaseAdminEmail = "memory@example.com";
const pocketbaseAdminPassword = "1234567890";
const loadCollectionPrefix = "memory_load_probe";
const uploadCollectionPrefix = "memory_upload_probe";
const uploadFieldName = "file";
const uploadLimitHeadroomMiB = 128;
const defaultUploadSizesMiB = [64, 256, 512];
const defaultLoadDurationMs = 10_000;
const defaultLoadConcurrency = 32;
const defaultSeededRecords = 250;
const defaultSampleIntervalMs = 50;
const defaultIdleDurationMs = 1_000;
const defaultPostUploadDurationMs = 1_500;
const defaultOutputPath = "/tmp/pocketbun-memory-compare-local.json";

const parsed = parseArgs(Bun.argv.slice(2));
const pocketbaseTag = (await Bun.file("pocketbase_tag.txt").text()).trim();
const pocketbunPackage = (await Bun.file("package.json").json()) as { version?: string };
const pocketbaseBuildDir = await mkdtemp(join(tmpdir(), "pocketbase-memory-build-"));
const pocketbaseBinaryPath = join(pocketbaseBuildDir, "pocketbase-memory-compare");

try {
  await ensurePocketBaseBinary();

  const results: EngineMeasurement[] = [];
  for (const engine of ["pocketbase", "pocketbun"] as const) {
    results.push(await measureEngine(engine));
  }

  const comparison: ComparisonResult = {
    generatedAt: new Date().toISOString(),
    host: {
      platform: process.platform,
      arch: process.arch,
      cpus: cpus().length,
      bunVersion: Bun.version,
    },
    versions: {
      pocketbaseTag,
      pocketbunVersion: pocketbunPackage.version ?? "unknown",
    },
    loadScenario: {
      endpoint: `/api/collections/{load_probe}/records?page=1&perPage=30`,
      durationMs: parsed.loadDurationMs,
      concurrency: parsed.loadConcurrency,
      seededRecords: parsed.seededRecords,
    },
    uploadSizesMiB: parsed.uploadSizesMiB,
    results,
    findings: buildFindings(results),
  };

  await Bun.write(parsed.outputPath, `${JSON.stringify(comparison, null, 2)}\n`);
  console.log(JSON.stringify(comparison, null, 2));
} finally {
  await rm(pocketbaseBuildDir, { recursive: true, force: true });
}

async function measureEngine(engine: Engine): Promise<EngineMeasurement> {
  const idleAndLoad = await withServer(engine, async (server, adminToken) => {
    const loadCollectionName = uniqueCollectionName(loadCollectionPrefix);
    await createLoadCollection(server.baseUrl, adminToken, loadCollectionName);
    await seedLoadRecords(server.baseUrl, loadCollectionName, parsed.seededRecords);
    await warmupListEndpoint(server.baseUrl, adminToken, loadCollectionName);

    const idle = await sampleWindow(server.pid, parsed.idleDurationMs, parsed.sampleIntervalMs);
    const load = await runLoadProbe(server.pid, server.baseUrl, adminToken, loadCollectionName);
    return { idle, load };
  });

  const uploads: UploadMeasurement[] = [];
  for (const sizeMiB of parsed.uploadSizesMiB) {
    uploads.push(
      await withServer(engine, async (server, adminToken) => {
        const uploadCollectionName = uniqueCollectionName(uploadCollectionPrefix);
        await createUploadCollection(server.baseUrl, adminToken, uploadCollectionName, sizeMiB + uploadLimitHeadroomMiB);
        await warmupUploadEndpoint(server.baseUrl, uploadCollectionName);
        return await runUploadProbe(server.pid, server.baseUrl, uploadCollectionName, sizeMiB);
      }),
    );
  }

  return {
    engine,
    idle: idleAndLoad.idle,
    load: idleAndLoad.load,
    uploads,
  };
}

async function withServer<T>(engine: Engine, action: (server: RunningServer, adminToken: string) => Promise<T>): Promise<T> {
  const server = await startServer(engine);
  try {
    const adminToken = await authSuperuser(server.baseUrl);
    return await action(server, adminToken);
  } finally {
    await server.stop();
  }
}

async function startServer(engine: Engine): Promise<RunningServer> {
  const port = await findAvailablePort();
  const tempRoot = await mkdtemp(join(tmpdir(), `${engine}-memory-`));
  const dataDir = join(tempRoot, "pb_data");
  await mkdir(dataDir);
  await ensureSuperuser(engine, dataDir);

  const cmd =
    engine === "pocketbase"
      ? [pocketbaseBinaryPath, `--dir=${dataDir}`, "serve", `--http=127.0.0.1:${port}`]
      : ["bun", "run", "src/cli.ts", `--dir=${dataDir}`, "--hooksWatch=false", "serve", `--http=127.0.0.1:${port}`];

  const proc = Bun.spawn({
    cmd,
    cwd: process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
    stdin: "ignore",
  });

  try {
    await waitForServerReady(`http://127.0.0.1:${port}`, proc);
  } catch (error) {
    const [stdoutText, stderrText] = await Promise.all([readStreamText(proc.stdout), readStreamText(proc.stderr)]);
    await proc.exited.catch(() => {});
    await rm(tempRoot, { recursive: true, force: true });
    throw new Error(
      `failed to start ${engine}: ${String(error)}\nstdout:\n${stdoutText.trim()}\nstderr:\n${stderrText.trim()}`.trim(),
    );
  }

  return {
    engine,
    dataDir,
    port,
    pid: proc.pid,
    baseUrl: `http://127.0.0.1:${port}`,
    stop: async () => {
      proc.kill("SIGTERM");
      await proc.exited.catch(() => {});
      await rm(tempRoot, { recursive: true, force: true });
    },
  };
}

async function ensureSuperuser(engine: Engine, dataDir: string): Promise<void> {
  const cmd =
    engine === "pocketbase"
      ? [pocketbaseBinaryPath, `--dir=${dataDir}`, "superuser", "upsert", pocketbaseAdminEmail, pocketbaseAdminPassword]
      : [
          "bun",
          "run",
          "src/cli.ts",
          `--dir=${dataDir}`,
          "--hooksWatch=false",
          "superuser",
          "upsert",
          pocketbaseAdminEmail,
          pocketbaseAdminPassword,
        ];

  const proc = Bun.spawn({
    cmd,
    cwd: process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
    stdin: "ignore",
  });

  const exitCode = await proc.exited;
  const [stdoutText, stderrText] = await Promise.all([readStreamText(proc.stdout), readStreamText(proc.stderr)]);
  if (exitCode !== 0) {
    throw new Error(
      `failed to create superuser for ${engine} (exit=${exitCode})\nstdout:\n${stdoutText.trim()}\nstderr:\n${stderrText.trim()}`.trim(),
    );
  }
}

async function waitForServerReady(baseUrl: string, proc: Bun.Subprocess<"ignore", "pipe", "pipe">): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (proc.exitCode !== null) {
      throw new Error(`${baseUrl} exited early with code ${proc.exitCode}`);
    }

    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.status === 200) {
        return;
      }
    } catch {
      // retry
    }

    await delay(100);
  }

  throw new Error(`timed out waiting for ${baseUrl}`);
}

async function authSuperuser(baseUrl: string): Promise<string> {
  const response = await fetch(`${baseUrl}/api/collections/_superusers/auth-with-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      identity: pocketbaseAdminEmail,
      password: pocketbaseAdminPassword,
    }),
  });

  if (!response.ok) {
    throw new Error(`failed to auth superuser: HTTP ${response.status} ${await response.text()}`);
  }

  const body = (await response.json()) as { token?: string };
  if (!body.token) {
    throw new Error("superuser auth response missing token");
  }
  return body.token;
}

async function createLoadCollection(baseUrl: string, adminToken: string, collectionName: string): Promise<void> {
  await createCollection(baseUrl, adminToken, {
    name: collectionName,
    type: "base",
    listRule: "",
    viewRule: "",
    createRule: "",
    updateRule: "",
    deleteRule: "",
    fields: [{ type: "text", name: "title", required: true }],
  });
}

async function createUploadCollection(
  baseUrl: string,
  adminToken: string,
  collectionName: string,
  maxUploadMiB: number,
): Promise<void> {
  await createCollection(baseUrl, adminToken, {
    name: collectionName,
    type: "base",
    listRule: "",
    viewRule: "",
    createRule: "",
    updateRule: "",
    deleteRule: "",
    fields: [{ type: "file", name: uploadFieldName, maxSize: mebibytes(maxUploadMiB), maxSelect: 1 }],
  });
}

async function createCollection(baseUrl: string, adminToken: string, body: Record<string, unknown>): Promise<void> {
  const response = await fetch(`${baseUrl}/api/collections`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: adminToken,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`failed to create collection: HTTP ${response.status} ${await response.text()}`);
  }
}

async function seedLoadRecords(baseUrl: string, collectionName: string, count: number): Promise<void> {
  const recordsUrl = `${baseUrl}/api/collections/${collectionName}/records`;
  for (let i = 0; i < count; i += 20) {
    const chunk: Promise<void>[] = [];
    for (let j = i; j < Math.min(count, i + 20); j += 1) {
      chunk.push(
        (async () => {
          const response = await fetch(recordsUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: `record-${String(j).padStart(4, "0")}` }),
          });

          if (!response.ok) {
            throw new Error(`failed to seed record ${j}: HTTP ${response.status} ${await response.text()}`);
          }
        })(),
      );
    }
    await Promise.all(chunk);
  }
}

async function warmupListEndpoint(baseUrl: string, adminToken: string, collectionName: string): Promise<void> {
  const url = `${baseUrl}/api/collections/${collectionName}/records?page=1&perPage=30`;
  for (let i = 0; i < 10; i += 1) {
    const response = await fetch(url, {
      headers: { Authorization: adminToken },
    });
    if (!response.ok) {
      throw new Error(`failed to warm list endpoint: HTTP ${response.status} ${await response.text()}`);
    }
    await response.arrayBuffer();
  }
}

async function warmupUploadEndpoint(baseUrl: string, collectionName: string): Promise<void> {
  await runUploadRequest(baseUrl, collectionName, 1);
}

async function runLoadProbe(
  pid: number,
  baseUrl: string,
  adminToken: string,
  collectionName: string,
): Promise<LoadMeasurement> {
  const url = `${baseUrl}/api/collections/${collectionName}/records?page=1&perPage=30`;
  const beforeBytes = await sampleRss(pid);
  const deadline = Date.now() + parsed.loadDurationMs;
  let completedRequests = 0;
  let failedRequests = 0;
  let sampling = true;
  const samples: number[] = [];

  const workers = Array.from({ length: parsed.loadConcurrency }, () =>
    (async () => {
      while (Date.now() < deadline) {
        try {
          const response = await fetch(url, {
            headers: { Authorization: adminToken },
          });
          await response.arrayBuffer();
          if (response.ok) {
            completedRequests += 1;
          } else {
            failedRequests += 1;
          }
        } catch {
          failedRequests += 1;
        }
      }
    })(),
  );

  const sampler = (async () => {
    while (sampling) {
      samples.push(await sampleRss(pid));
      await Bun.sleep(parsed.sampleIntervalMs);
    }
    samples.push(await sampleRss(pid));
  })();

  const startedAt = Date.now();
  await Promise.all(workers);
  sampling = false;
  await sampler;

  const afterBytes = await sampleRss(pid);
  const peakBytes = Math.max(beforeBytes, ...samples);
  const total = samples.reduce((sum, value) => sum + value, 0);

  return {
    beforeBytes,
    peakBytes,
    meanBytes: Math.round(total / samples.length),
    afterBytes,
    peakDeltaBytes: peakBytes - beforeBytes,
    completedRequests,
    failedRequests,
    durationMs: Date.now() - startedAt,
    concurrency: parsed.loadConcurrency,
    url,
  };
}

async function runUploadProbe(
  pid: number,
  baseUrl: string,
  collectionName: string,
  sizeMiB: number,
): Promise<UploadMeasurement> {
  const idle = await sampleWindow(pid, parsed.idleDurationMs, parsed.sampleIntervalMs);
  const beforeBytes = idle.meanBytes;
  const upload = await runUploadRequest(baseUrl, collectionName, sizeMiB, pid);
  const fileSizeBytes = mebibytes(sizeMiB);
  return {
    fileSizeMiB: sizeMiB,
    fileSizeBytes,
    beforeBytes,
    idleBytes: idle.meanBytes,
    peakBytes: upload.peakBytes,
    afterBytes: upload.afterBytes,
    peakDeltaBytes: upload.peakBytes - beforeBytes,
    durationMs: upload.durationMs,
    throughputMiBsPerSec: calculateThroughputMiBsPerSec(fileSizeBytes, upload.durationMs),
    statusCode: upload.statusCode,
  };
}

async function runUploadRequest(
  baseUrl: string,
  collectionName: string,
  sizeMiB: number,
  pid?: number,
): Promise<{ peakBytes: number; afterBytes: number; durationMs: number; statusCode: number }> {
  const tempDir = await mkdtemp(join(tmpdir(), "memory-upload-input-"));
  try {
    const filePath = join(tempDir, `upload-${sizeMiB}m.bin`);
    const responsePath = join(tempDir, "response.json");
    const fileSizeBytes = mebibytes(sizeMiB);
    const handle = await open(filePath, "w");
    try {
      await handle.truncate(fileSizeBytes);
    } finally {
      await handle.close();
    }

    const upload = Bun.spawn({
      cmd: [
        "curl",
        "--silent",
        "--show-error",
        "--output",
        responsePath,
        "--write-out",
        "%{http_code}",
        "--form",
        `title=${sizeMiB}m`,
        "--form",
        `${uploadFieldName}=@${filePath};type=application/octet-stream`,
        `${baseUrl}/api/collections/${collectionName}/records`,
      ],
      stdout: "pipe",
      stderr: "pipe",
      stdin: "ignore",
    });

    const startedAt = Date.now();
    let peakBytes = pid ? await sampleRss(pid) : 0;
    let sampling = pid !== undefined;
    const sampler = pid
      ? (async () => {
          while (sampling) {
            peakBytes = Math.max(peakBytes, await sampleRss(pid));
            await Bun.sleep(parsed.sampleIntervalMs);
          }
        })()
      : Promise.resolve();

    const exitCode = await upload.exited;
    sampling = false;
    await sampler;

    const statusCodeText = await readStreamText(upload.stdout);
    const stderrText = await readStreamText(upload.stderr);
    const statusCode = Number.parseInt(statusCodeText.trim(), 10);
    const responseBody = await readFile(responsePath, "utf8").catch(() => "");

    if (exitCode !== 0) {
      throw new Error(`curl upload failed with exit code ${exitCode}: ${stderrText.trim()}`);
    }
    if (statusCode !== 200) {
      throw new Error(`upload returned HTTP ${statusCode}: ${responseBody.trim()}`);
    }

    const afterWindow = pid ? await sampleWindow(pid, parsed.postUploadDurationMs, parsed.sampleIntervalMs) : null;

    return {
      peakBytes: afterWindow ? Math.max(peakBytes, afterWindow.maxBytes) : peakBytes,
      afterBytes: afterWindow?.lastBytes ?? 0,
      durationMs: Date.now() - startedAt,
      statusCode,
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function sampleWindow(pid: number, durationMs: number, sampleIntervalMs: number): Promise<SampleSummary> {
  const values: number[] = [];
  const startedAt = Date.now();

  while (Date.now() - startedAt < durationMs) {
    values.push(await sampleRss(pid));
    await Bun.sleep(sampleIntervalMs);
  }

  if (values.length === 0) {
    values.push(await sampleRss(pid));
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  return {
    minBytes: Math.min(...values),
    maxBytes: Math.max(...values),
    meanBytes: Math.round(total / values.length),
    lastBytes: values[values.length - 1] ?? 0,
    samples: values.length,
  };
}

async function sampleRss(pid: number): Promise<number> {
  const proc = Bun.spawn({
    cmd: ["ps", "-o", "rss=", "-p", String(pid)],
    stdout: "pipe",
    stderr: "ignore",
    stdin: "ignore",
  });
  const text = await readStreamText(proc.stdout);
  await proc.exited;

  const kib = Number.parseInt(text.trim(), 10);
  if (!Number.isFinite(kib)) {
    throw new Error(`failed to read RSS for pid ${pid}: ${JSON.stringify(text)}`);
  }

  return kib * 1024;
}

async function ensurePocketBaseBinary(): Promise<void> {
  await mkdir(pocketbaseBuildDir, { recursive: true });
  const proc = Bun.spawn({
    cmd: [pocketbaseGoBinary, "build", "-o", pocketbaseBinaryPath],
    cwd: pocketbaseUpstreamBuildDir,
    stdout: "pipe",
    stderr: "pipe",
    stdin: "ignore",
  });

  const exitCode = await proc.exited;
  const [stdoutText, stderrText] = await Promise.all([readStreamText(proc.stdout), readStreamText(proc.stderr)]);
  if (exitCode !== 0) {
    throw new Error(
      `failed to build PocketBase (exit=${exitCode})\nstdout:\n${stdoutText.trim()}\nstderr:\n${stderrText.trim()}`.trim(),
    );
  }
}

function buildFindings(results: EngineMeasurement[]): string[] {
  const pocketbase = results.find((result) => result.engine === "pocketbase");
  const pocketbun = results.find((result) => result.engine === "pocketbun");
  if (!pocketbase || !pocketbun) {
    return [];
  }

  const findings = [
    `Idle RSS after warmup: PocketBase ${formatMiB(pocketbase.idle.meanBytes)}, PocketBun ${formatMiB(pocketbun.idle.meanBytes)}.`,
    `Under ${parsed.loadDurationMs}ms list load at concurrency ${parsed.loadConcurrency}: PocketBase peaked at ${formatMiB(pocketbase.load.peakBytes)} (${formatMiB(pocketbase.load.peakDeltaBytes)} above idle), PocketBun peaked at ${formatMiB(pocketbun.load.peakBytes)} (${formatMiB(pocketbun.load.peakDeltaBytes)} above idle).`,
  ];

  for (const sizeMiB of parsed.uploadSizesMiB) {
    const baseUpload = pocketbase.uploads.find((upload) => upload.fileSizeMiB === sizeMiB);
    const bunUpload = pocketbun.uploads.find((upload) => upload.fileSizeMiB === sizeMiB);
    if (!baseUpload || !bunUpload) {
      continue;
    }
    findings.push(
      `${sizeMiB} MiB upload peak delta: PocketBase ${formatMiB(baseUpload.peakDeltaBytes)}, PocketBun ${formatMiB(bunUpload.peakDeltaBytes)}; throughput: PocketBase ${formatThroughput(baseUpload.throughputMiBsPerSec)}, PocketBun ${formatThroughput(bunUpload.throughputMiBsPerSec)}.`,
    );
  }

  return findings;
}

function uniqueCollectionName(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 10)}`;
}

function parseArgs(args: string[]): ParsedArgs {
  let uploadSizesMiB = [...defaultUploadSizesMiB];
  let loadDurationMs = defaultLoadDurationMs;
  let loadConcurrency = defaultLoadConcurrency;
  let seededRecords = defaultSeededRecords;
  let sampleIntervalMs = defaultSampleIntervalMs;
  let idleDurationMs = defaultIdleDurationMs;
  let postUploadDurationMs = defaultPostUploadDurationMs;
  let outputPath = defaultOutputPath;

  for (const arg of args) {
    if (arg.startsWith("--upload-sizes-mib=")) {
      uploadSizesMiB = parseIntegerList(arg.slice("--upload-sizes-mib=".length));
      continue;
    }
    if (arg.startsWith("--load-duration-ms=")) {
      loadDurationMs = Number.parseInt(arg.slice("--load-duration-ms=".length), 10);
      continue;
    }
    if (arg.startsWith("--load-concurrency=")) {
      loadConcurrency = Number.parseInt(arg.slice("--load-concurrency=".length), 10);
      continue;
    }
    if (arg.startsWith("--seeded-records=")) {
      seededRecords = Number.parseInt(arg.slice("--seeded-records=".length), 10);
      continue;
    }
    if (arg.startsWith("--sample-ms=")) {
      sampleIntervalMs = Number.parseInt(arg.slice("--sample-ms=".length), 10);
      continue;
    }
    if (arg.startsWith("--idle-ms=")) {
      idleDurationMs = Number.parseInt(arg.slice("--idle-ms=".length), 10);
      continue;
    }
    if (arg.startsWith("--post-upload-ms=")) {
      postUploadDurationMs = Number.parseInt(arg.slice("--post-upload-ms=".length), 10);
      continue;
    }
    if (arg.startsWith("--output=")) {
      outputPath = arg.slice("--output=".length);
    }
  }

  if (uploadSizesMiB.length === 0) {
    uploadSizesMiB = [...defaultUploadSizesMiB];
  }

  return {
    uploadSizesMiB,
    loadDurationMs,
    loadConcurrency,
    seededRecords,
    sampleIntervalMs,
    idleDurationMs,
    postUploadDurationMs,
    outputPath,
  };
}

function parseIntegerList(raw: string): number[] {
  const values = raw
    .split(",")
    .map((entry) => Number.parseInt(entry.trim(), 10))
    .filter((value) => Number.isFinite(value) && value > 0);
  return Array.from(new Set(values));
}

function mebibytes(value: number): number {
  return value * 1024 * 1024;
}

function formatMiB(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

function formatThroughput(value: number): string {
  return `${value.toFixed(1)} MiB/s`;
}

function calculateThroughputMiBsPerSec(bytes: number, durationMs: number): number {
  if (durationMs <= 0) {
    return 0;
  }
  return bytes / (1024 * 1024) / (durationMs / 1000);
}

async function findAvailablePort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("failed to resolve ephemeral port"));
        return;
      }

      const port = address.port;
      server.close((closeErr) => {
        if (closeErr) {
          reject(closeErr);
          return;
        }
        resolve(port);
      });
    });
  });
}
