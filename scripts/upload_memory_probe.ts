// PocketBun-only: measures server RSS during large multipart uploads before upgrade work.

import { mkdtemp, open, readFile, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "../src/apis/serve.ts";
import { BaseApp } from "../src/core/base.ts";
import { NewBaseCollection } from "../src/core/collection_model.ts";
import { FileField } from "../src/core/field_file.ts";
import { readStreamText } from "./readable_stream.ts";

const defaultSizesMiB = [64, 256];
const defaultWarmupSizeMiB = 1;
const defaultSampleIntervalMs = 50;
const defaultBaselineDurationMs = 1000;
const defaultPostUploadDurationMs = 1500;
const defaultReadyTimeoutMs = 20_000;
const defaultOutputPath = "/tmp/pocketbun-upload-memory-latest.json";
const uploadLimitHeadroomMiB = 128;
const uploadCollectionName = "upload_probe";
const uploadFieldName = "file";

type ProbeConfig = {
  port: number;
  sizesMiB: number[];
  warmupSizeMiB: number;
  sampleIntervalMs: number;
  baselineDurationMs: number;
  postUploadDurationMs: number;
  outputPath: string;
};

type SampleSummary = {
  minBytes: number;
  maxBytes: number;
  meanBytes: number;
  lastBytes: number;
  samples: number;
};

type UploadMeasurement = {
  fileSizeMiB: number;
  fileSizeBytes: number;
  beforeBytes: number;
  peakBytes: number;
  afterBytes: number;
  peakDeltaBytes: number;
  durationMs: number;
  statusCode: number;
};

type ProbeResult = {
  port: number;
  sampleIntervalMs: number;
  baseline: SampleSummary;
  postWarmup: SampleSummary;
  uploads: UploadMeasurement[];
  findings: string[];
};

type ParsedArgs = ProbeConfig & {
  serverMode: boolean;
  maxUploadMiB: number;
};

const parsed = parseArgs(Bun.argv.slice(2));

if (parsed.serverMode) {
  await runServerMode(parsed.port, parsed.maxUploadMiB);
} else {
  const result = await runProbe(parsed);
  await Bun.write(parsed.outputPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
}

async function runProbe(config: ProbeConfig): Promise<ProbeResult> {
  const port = config.port > 0 ? config.port : await findAvailablePort();
  const scriptPath = fileURLToPath(import.meta.url);
  const maxUploadMiB = Math.max(config.warmupSizeMiB, ...config.sizesMiB);
  const child = Bun.spawn({
    cmd: [process.execPath, scriptPath, "--server", `--port=${port}`, `--max-upload-mib=${maxUploadMiB}`],
    stdout: "pipe",
    stderr: "pipe",
    stdin: "ignore",
    cwd: process.cwd(),
  });

  try {
    await waitForServerReady(port, child);

    const baseline = await sampleWindow(child.pid, config.baselineDurationMs, config.sampleIntervalMs);

    if (config.warmupSizeMiB > 0) {
      await runUpload(child.pid, port, config.warmupSizeMiB, config.sampleIntervalMs);
    }

    const postWarmup = await sampleWindow(child.pid, config.baselineDurationMs, config.sampleIntervalMs);
    const uploads: UploadMeasurement[] = [];
    for (const sizeMiB of config.sizesMiB) {
      uploads.push(await runUpload(child.pid, port, sizeMiB, config.sampleIntervalMs, config.postUploadDurationMs));
    }

    return {
      port,
      sampleIntervalMs: config.sampleIntervalMs,
      baseline,
      postWarmup,
      uploads,
      findings: buildFindings(baseline, postWarmup, uploads),
    };
  } finally {
    child.kill("SIGTERM");
    await child.exited;
  }
}

async function runServerMode(port: number, maxUploadMiB: number): Promise<void> {
  const dataDir = await mkdtemp(join(tmpdir(), "pocketbun-upload-memory-"));
  const app = new BaseApp({ dataDir });
  app.bootstrap();
  app.runAllMigrations();

  const collection = NewBaseCollection(uploadCollectionName);
  collection.CreateRule = "";
  collection.Fields.Add(
    Object.assign(new FileField(), {
      Name: uploadFieldName,
      MaxSize: mebibytes(maxUploadMiB + uploadLimitHeadroomMiB),
      MaxSelect: 1,
    }),
  );

  const saveErr = await app.Save(collection);
  if (saveErr) {
    throw saveErr;
  }

  const server = serve(app, { httpAddr: `127.0.0.1:${port}`, showStartBanner: false });

  const shutdown = async () => {
    await server.stop();
    app.resetBootstrapState();
    await rm(dataDir, { recursive: true, force: true });
    process.exit(0);
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
  process.stdin.resume();
}

async function runUpload(
  pid: number,
  port: number,
  sizeMiB: number,
  sampleIntervalMs: number,
  postUploadDurationMs: number = 0,
): Promise<UploadMeasurement> {
  const tempDir = await mkdtemp(join(tmpdir(), "pocketbun-upload-input-"));
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

    const beforeBytes = await sampleRss(pid);
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
        `http://127.0.0.1:${port}/api/collections/${uploadCollectionName}/records`,
      ],
      stdout: "pipe",
      stderr: "pipe",
      stdin: "ignore",
    });

    let peakBytes = beforeBytes;
    const startedAt = Date.now();
    let done = false;
    const exitPromise = upload.exited.then((code) => {
      done = true;
      return code;
    });

    while (!done) {
      const sample = await sampleRss(pid);
      if (sample > peakBytes) {
        peakBytes = sample;
      }
      await Bun.sleep(sampleIntervalMs);
    }

    const exitCode = await exitPromise;
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

    let afterBytes = await sampleRss(pid);
    if (postUploadDurationMs > 0) {
      const post = await sampleWindow(pid, postUploadDurationMs, sampleIntervalMs);
      afterBytes = post.lastBytes;
      peakBytes = Math.max(peakBytes, post.maxBytes);
    }

    return {
      fileSizeMiB: sizeMiB,
      fileSizeBytes,
      beforeBytes,
      peakBytes,
      afterBytes,
      peakDeltaBytes: peakBytes - beforeBytes,
      durationMs: Date.now() - startedAt,
      statusCode,
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function waitForServerReady(port: number, child: Bun.Subprocess<"ignore", "pipe", "pipe">): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < defaultReadyTimeoutMs) {
    if (child.exitCode !== null) {
      const stderrText = await readStreamText(child.stderr);
      throw new Error(`probe server exited early: ${stderrText.trim()}`);
    }

    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (response.status === 200) {
        return;
      }
    } catch {
      // retry
    }
    await Bun.sleep(100);
  }

  throw new Error(`timed out waiting for probe server on port ${port}`);
}

async function sampleWindow(pid: number, durationMs: number, sampleIntervalMs: number): Promise<SampleSummary> {
  const values: number[] = [];
  const startedAt = Date.now();
  while (Date.now() - startedAt < durationMs) {
    values.push(await sampleRss(pid));
    await Bun.sleep(sampleIntervalMs);
  }

  if (values.length === 0) {
    const value = await sampleRss(pid);
    values.push(value);
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

function buildFindings(baseline: SampleSummary, postWarmup: SampleSummary, uploads: UploadMeasurement[]): string[] {
  const findings: string[] = [];
  findings.push(
    `Idle RSS after warmup was ${formatMiB(postWarmup.meanBytes)} (startup baseline ${formatMiB(baseline.meanBytes)}).`,
  );

  for (const upload of uploads) {
    findings.push(
      `${upload.fileSizeMiB} MiB upload peaked at ${formatMiB(upload.peakBytes)} RSS, ${formatMiB(upload.peakDeltaBytes)} above pre-upload RSS ${formatMiB(upload.beforeBytes)}.`,
    );
  }

  return findings;
}

function parseArgs(args: string[]): ParsedArgs {
  let port = 0;
  let sizesMiB = [...defaultSizesMiB];
  let warmupSizeMiB = defaultWarmupSizeMiB;
  let sampleIntervalMs = defaultSampleIntervalMs;
  let baselineDurationMs = defaultBaselineDurationMs;
  let postUploadDurationMs = defaultPostUploadDurationMs;
  let outputPath = defaultOutputPath;
  let serverMode = false;
  let maxUploadMiB = Math.max(warmupSizeMiB, ...sizesMiB);

  for (const arg of args) {
    if (arg === "--server") {
      serverMode = true;
      continue;
    }
    if (arg.startsWith("--port=")) {
      port = Number.parseInt(arg.slice("--port=".length), 10);
      continue;
    }
    if (arg.startsWith("--sizes-mib=")) {
      sizesMiB = parseIntegerList(arg.slice("--sizes-mib=".length));
      continue;
    }
    if (arg.startsWith("--warmup-mib=")) {
      warmupSizeMiB = Number.parseInt(arg.slice("--warmup-mib=".length), 10);
      continue;
    }
    if (arg.startsWith("--sample-ms=")) {
      sampleIntervalMs = Number.parseInt(arg.slice("--sample-ms=".length), 10);
      continue;
    }
    if (arg.startsWith("--baseline-ms=")) {
      baselineDurationMs = Number.parseInt(arg.slice("--baseline-ms=".length), 10);
      continue;
    }
    if (arg.startsWith("--post-upload-ms=")) {
      postUploadDurationMs = Number.parseInt(arg.slice("--post-upload-ms=".length), 10);
      continue;
    }
    if (arg.startsWith("--output=")) {
      outputPath = arg.slice("--output=".length);
      continue;
    }
    if (arg.startsWith("--max-upload-mib=")) {
      maxUploadMiB = Number.parseInt(arg.slice("--max-upload-mib=".length), 10);
    }
  }

  if (sizesMiB.length === 0) {
    sizesMiB = [...defaultSizesMiB];
  }

  return {
    port,
    sizesMiB,
    warmupSizeMiB,
    sampleIntervalMs,
    baselineDurationMs,
    postUploadDurationMs,
    outputPath,
    serverMode,
    maxUploadMiB,
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

      const { port } = address;
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
