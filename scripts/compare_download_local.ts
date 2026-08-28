// PocketBun-only: compare local PocketBase vs PocketBun download RSS and throughput.
//
// Why this file exists:
// The repository has upload memory probes, but download behavior has different
// failure modes. This script keeps a reproducible local PocketBase-vs-PocketBun
// comparison for real file-serving paths, including integrity checks.

import { createHash, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { cpus, tmpdir } from "node:os";
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

type DownloadTransferMeasurement = {
  beforeBytes: number;
  idleBytes: number;
  peakBytes: number;
  afterBytes: number;
  peakDeltaBytes: number;
  durationMs: number;
  bytesDownloaded: number;
  throughputMiBsPerSec: number;
};

type SingleDownloadMeasurement = DownloadTransferMeasurement & {
  statusCode: number;
  sha256: string;
  integrityOk: boolean;
};

type BurstDownloadMeasurement = DownloadTransferMeasurement & {
  concurrency: number;
  completedRequests: number;
  failedRequests: number;
};

type DownloadMeasurement = {
  fileSizeBytes: number;
  fileSizeLabel: string;
  sourceSha256: string;
  single: SingleDownloadMeasurement;
  burst: BurstDownloadMeasurement;
};

type EngineMeasurement = {
  engine: Engine;
  downloads: DownloadMeasurement[];
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
  settings: {
    fileSizesBytes: number[];
    burstConcurrency: number;
    sampleIntervalMs: number;
    idleDurationMs: number;
    postDownloadDurationMs: number;
  };
  results: EngineMeasurement[];
  findings: string[];
};

type ParsedArgs = {
  fileSizesBytes: number[];
  burstConcurrency: number;
  sampleIntervalMs: number;
  idleDurationMs: number;
  postDownloadDurationMs: number;
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

type SeededDownloadRecord = {
  url: string;
  sha256: string;
};

const pocketbaseUpstreamBuildDir = ".upstream/pocketbase/examples/base";
const pocketbaseGoBinary = process.env.POCKETBUN_GO_BIN ?? "/opt/homebrew/bin/go";
const pocketbaseAdminEmail = "download-memory@example.com";
const pocketbaseAdminPassword = "1234567890";
const downloadCollectionPrefix = "download_probe";
const downloadFieldName = "file";
const uploadLimitHeadroomMiB = 128;
const defaultFileSizesBytes = [64 * 1024, 64 * 1024 * 1024, 256 * 1024 * 1024];
const defaultBurstConcurrency = 4;
const defaultSampleIntervalMs = 50;
const defaultIdleDurationMs = 1_000;
const defaultPostDownloadDurationMs = 1_500;
const defaultOutputPath = "/tmp/pocketbun-download-compare-local.json";

const parsed = parseArgs(Bun.argv.slice(2));
const pocketbaseTag = (await Bun.file("pocketbase_tag.txt").text()).trim();
const pocketbunPackage = (await Bun.file("package.json").json()) as { version?: string };
const pocketbaseBuildDir = await mkdtemp(join(tmpdir(), "pocketbase-download-build-"));
const pocketbaseBinaryPath = join(pocketbaseBuildDir, "pocketbase-download-compare");

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
    settings: {
      fileSizesBytes: parsed.fileSizesBytes,
      burstConcurrency: parsed.burstConcurrency,
      sampleIntervalMs: parsed.sampleIntervalMs,
      idleDurationMs: parsed.idleDurationMs,
      postDownloadDurationMs: parsed.postDownloadDurationMs,
    },
    results,
    findings: buildFindings(results),
  };

  await Bun.write(parsed.outputPath, `${JSON.stringify(comparison, null, 2)}\n`);
  console.log(JSON.stringify(comparison, null, 2));
} finally {
  await rm(pocketbaseBuildDir, { recursive: true, force: true });
}

async function measureEngine(engine: Engine): Promise<EngineMeasurement> {
  const downloads: DownloadMeasurement[] = [];
  for (const fileSizeBytes of parsed.fileSizesBytes) {
    downloads.push(
      await withServer(engine, async (server, adminToken) => {
        const collectionName = uniqueCollectionName(downloadCollectionPrefix);
        await createDownloadCollection(
          server.baseUrl,
          adminToken,
          collectionName,
          Math.ceil(fileSizeBytes / (1024 * 1024)) + uploadLimitHeadroomMiB,
        );
        const record = await seedDownloadRecord(server.baseUrl, collectionName, fileSizeBytes);
        await warmupDownloadEndpoint(record.url);

        return {
          fileSizeBytes,
          fileSizeLabel: formatBinarySize(fileSizeBytes),
          sourceSha256: record.sha256,
          single: await runSingleDownloadProbe(server.pid, record.url, fileSizeBytes, record.sha256),
          burst: await runBurstDownloadProbe(server.pid, record.url, fileSizeBytes),
        };
      }),
    );
  }

  return { engine, downloads };
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
  const tempRoot = await mkdtemp(join(tmpdir(), `${engine}-download-`));
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

async function createDownloadCollection(
  baseUrl: string,
  adminToken: string,
  collectionName: string,
  maxUploadMiB: number,
): Promise<void> {
  const response = await fetch(`${baseUrl}/api/collections`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: adminToken,
    },
    body: JSON.stringify({
      name: collectionName,
      type: "base",
      listRule: "",
      viewRule: "",
      createRule: "",
      updateRule: "",
      deleteRule: "",
      fields: [{ type: "file", name: downloadFieldName, maxSize: mebibytes(maxUploadMiB), maxSelect: 1 }],
    }),
  });

  if (!response.ok) {
    throw new Error(`failed to create collection: HTTP ${response.status} ${await response.text()}`);
  }
}

async function seedDownloadRecord(
  baseUrl: string,
  collectionName: string,
  fileSizeBytes: number,
): Promise<SeededDownloadRecord> {
  const tempDir = await mkdtemp(join(tmpdir(), "download-probe-seed-"));
  try {
    const filePath = join(tempDir, `seed-${fileSizeBytes}.bin`);
    const responsePath = join(tempDir, "response.json");
    const fileSha256 = await writePatternFile(filePath, fileSizeBytes);

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
        `${downloadFieldName}=@${filePath};type=application/octet-stream`,
        `${baseUrl}/api/collections/${collectionName}/records`,
      ],
      stdout: "pipe",
      stderr: "pipe",
      stdin: "ignore",
    });

    const exitCode = await upload.exited;
    const [statusCodeText, stderrText, responseText] = await Promise.all([
      readStreamText(upload.stdout),
      readStreamText(upload.stderr),
      readFile(responsePath, "utf8"),
    ]);

    if (exitCode !== 0) {
      throw new Error(`curl upload failed with exit code ${exitCode}: ${stderrText.trim()}`);
    }

    const statusCode = Number.parseInt(statusCodeText.trim(), 10);
    if (statusCode !== 200) {
      throw new Error(`upload returned HTTP ${statusCode}: ${responseText.trim()}`);
    }

    const payload = JSON.parse(responseText) as { id?: string } & Record<string, unknown>;
    const recordId = typeof payload.id === "string" ? payload.id : "";
    const rawField = payload[downloadFieldName];
    const fileName =
      Array.isArray(rawField) && typeof rawField[0] === "string" ? rawField[0] : typeof rawField === "string" ? rawField : "";

    if (!recordId || !fileName) {
      throw new Error(`upload response missing record id or file name: ${responseText.trim()}`);
    }

    return {
      url: `${baseUrl}/api/files/${collectionName}/${recordId}/${fileName}`,
      sha256: fileSha256,
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function warmupDownloadEndpoint(url: string): Promise<void> {
  for (let i = 0; i < 3; i += 1) {
    const response = await fetch(url, {
      headers: { Range: "bytes=0-0" },
    });
    if (!response.ok && response.status !== 206) {
      throw new Error(`failed to warm download endpoint: HTTP ${response.status} ${await response.text()}`);
    }
    await response.arrayBuffer();
  }
}

async function runSingleDownloadProbe(
  pid: number,
  url: string,
  fileSizeBytes: number,
  expectedSha256: string,
): Promise<SingleDownloadMeasurement> {
  const idle = await sampleWindow(pid, parsed.idleDurationMs, parsed.sampleIntervalMs);
  const beforeBytes = idle.meanBytes;

  const tempDir = await mkdtemp(join(tmpdir(), "download-probe-single-"));
  try {
    const outputPath = join(tempDir, "download.bin");
    const download = Bun.spawn({
      cmd: ["curl", "--silent", "--show-error", "--output", outputPath, "--write-out", "%{http_code}", url],
      stdout: "pipe",
      stderr: "pipe",
      stdin: "ignore",
    });

    const startedAt = Date.now();
    let peakBytes = await sampleRss(pid);
    let sampling = true;
    const sampler = (async () => {
      while (sampling) {
        peakBytes = Math.max(peakBytes, await sampleRss(pid));
        await Bun.sleep(parsed.sampleIntervalMs);
      }
    })();

    const exitCode = await download.exited;
    sampling = false;
    await sampler;
    const finishedAt = Date.now();

    const [statusCodeText, stderrText, downloadedSha256] = await Promise.all([
      readStreamText(download.stdout),
      readStreamText(download.stderr),
      sha256File(outputPath),
    ]);

    if (exitCode !== 0) {
      throw new Error(`curl download failed with exit code ${exitCode}: ${stderrText.trim()}`);
    }

    const statusCode = Number.parseInt(statusCodeText.trim(), 10);
    if (statusCode !== 200) {
      const body = await readFile(outputPath, "utf8").catch(() => "");
      throw new Error(`download returned HTTP ${statusCode}: ${body.trim()}`);
    }

    const afterWindow = await sampleWindow(pid, parsed.postDownloadDurationMs, parsed.sampleIntervalMs);
    const integrityOk = downloadedSha256 === expectedSha256;
    const durationMs = finishedAt - startedAt;

    return {
      beforeBytes,
      idleBytes: idle.meanBytes,
      peakBytes: Math.max(peakBytes, afterWindow.maxBytes),
      afterBytes: afterWindow.lastBytes,
      peakDeltaBytes: Math.max(peakBytes, afterWindow.maxBytes) - beforeBytes,
      durationMs,
      bytesDownloaded: fileSizeBytes,
      throughputMiBsPerSec: computeMiBPerSec(fileSizeBytes, durationMs),
      statusCode,
      sha256: downloadedSha256,
      integrityOk,
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function runBurstDownloadProbe(pid: number, url: string, fileSizeBytes: number): Promise<BurstDownloadMeasurement> {
  const idle = await sampleWindow(pid, parsed.idleDurationMs, parsed.sampleIntervalMs);
  const beforeBytes = idle.meanBytes;
  const workers = Array.from({ length: parsed.burstConcurrency }, () =>
    Bun.spawn({
      cmd: ["curl", "--silent", "--show-error", "--output", "/dev/null", "--write-out", "%{http_code}:%{size_download}", url],
      stdout: "pipe",
      stderr: "pipe",
      stdin: "ignore",
    }),
  );

  const startedAt = Date.now();
  let peakBytes = await sampleRss(pid);
  let sampling = true;
  const sampler = (async () => {
    while (sampling) {
      peakBytes = Math.max(peakBytes, await sampleRss(pid));
      await Bun.sleep(parsed.sampleIntervalMs);
    }
  })();

  const results = await Promise.all(
    workers.map(async (worker) => {
      const exitCode = await worker.exited;
      const [stdoutText, stderrText] = await Promise.all([readStreamText(worker.stdout), readStreamText(worker.stderr)]);
      if (exitCode !== 0) {
        return { ok: false, bytesDownloaded: 0, detail: `curl exit ${exitCode}: ${stderrText.trim()}` };
      }

      const [statusCodeText, sizeText] = stdoutText.trim().split(":");
      const statusCode = Number.parseInt(statusCodeText ?? "", 10);
      const sizeDownloaded = Number.parseInt(sizeText ?? "", 10);
      if (statusCode !== 200) {
        return { ok: false, bytesDownloaded: 0, detail: `HTTP ${statusCode}` };
      }

      return {
        ok: Number.isFinite(sizeDownloaded) && sizeDownloaded === fileSizeBytes,
        bytesDownloaded: Number.isFinite(sizeDownloaded) ? sizeDownloaded : 0,
        detail: Number.isFinite(sizeDownloaded) && sizeDownloaded === fileSizeBytes ? "" : `size ${sizeDownloaded}`,
      };
    }),
  );

  sampling = false;
  await sampler;
  const finishedAt = Date.now();

  const afterWindow = await sampleWindow(pid, parsed.postDownloadDurationMs, parsed.sampleIntervalMs);
  const durationMs = finishedAt - startedAt;
  const completedRequests = results.filter((result) => result.ok).length;
  const failedRequests = results.length - completedRequests;
  const bytesDownloaded = results.reduce((sum, result) => sum + result.bytesDownloaded, 0);

  const failures = results
    .filter((result) => !result.ok)
    .map((result) => result.detail)
    .filter(Boolean);
  if (failures.length > 0) {
    throw new Error(`burst download failures: ${failures.join("; ")}`);
  }

  const peak = Math.max(peakBytes, afterWindow.maxBytes);
  return {
    beforeBytes,
    idleBytes: idle.meanBytes,
    peakBytes: peak,
    afterBytes: afterWindow.lastBytes,
    peakDeltaBytes: peak - beforeBytes,
    durationMs,
    bytesDownloaded,
    throughputMiBsPerSec: computeMiBPerSec(bytesDownloaded, durationMs),
    concurrency: parsed.burstConcurrency,
    completedRequests,
    failedRequests,
  };
}

async function writePatternFile(path: string, sizeBytes: number): Promise<string> {
  const writer = Bun.file(path).writer({ highWaterMark: 256 * 1024 });
  const hash = createHash("sha256");
  let remaining = sizeBytes;
  let state = 0x9e3779b9;

  try {
    while (remaining > 0) {
      const chunkSize = Math.min(256 * 1024, remaining);
      const chunk = new Uint8Array(chunkSize);
      for (let i = 0; i < chunk.length; i += 1) {
        state ^= state << 13;
        state ^= state >>> 17;
        state ^= state << 5;
        chunk[i] = state & 0xff;
      }
      const writeResult = writer.write(chunk);
      if (writeResult instanceof Promise) {
        await writeResult;
      }
      hash.update(chunk);
      remaining -= chunk.length;
    }
  } finally {
    const result = writer.end();
    if (result instanceof Promise) {
      await result;
    }
  }

  return hash.digest("hex");
}

async function sha256File(path: string): Promise<string> {
  const hash = createHash("sha256");
  const stream = Bun.file(path).stream();
  for await (const chunk of stream) {
    hash.update(chunk);
  }
  return hash.digest("hex");
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

  const findings: string[] = [];
  for (const fileSizeBytes of parsed.fileSizesBytes) {
    const baseDownload = pocketbase.downloads.find((entry) => entry.fileSizeBytes === fileSizeBytes);
    const bunDownload = pocketbun.downloads.find((entry) => entry.fileSizeBytes === fileSizeBytes);
    if (!baseDownload || !bunDownload) {
      continue;
    }

    findings.push(
      `${formatBinarySize(fileSizeBytes)} single download peak delta: PocketBase ${formatMiB(baseDownload.single.peakDeltaBytes)}, PocketBun ${formatMiB(bunDownload.single.peakDeltaBytes)}; throughput: PocketBase ${formatMiBPerSec(baseDownload.single.throughputMiBsPerSec)}, PocketBun ${formatMiBPerSec(bunDownload.single.throughputMiBsPerSec)}.`,
    );
    findings.push(
      `${formatBinarySize(fileSizeBytes)} burst x${parsed.burstConcurrency} peak delta: PocketBase ${formatMiB(baseDownload.burst.peakDeltaBytes)}, PocketBun ${formatMiB(bunDownload.burst.peakDeltaBytes)}; aggregate throughput: PocketBase ${formatMiBPerSec(baseDownload.burst.throughputMiBsPerSec)}, PocketBun ${formatMiBPerSec(bunDownload.burst.throughputMiBsPerSec)}.`,
    );
  }

  return findings;
}

function uniqueCollectionName(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 10)}`;
}

function parseArgs(args: string[]): ParsedArgs {
  let fileSizesBytes = [...defaultFileSizesBytes];
  let burstConcurrency = defaultBurstConcurrency;
  let sampleIntervalMs = defaultSampleIntervalMs;
  let idleDurationMs = defaultIdleDurationMs;
  let postDownloadDurationMs = defaultPostDownloadDurationMs;
  let outputPath = defaultOutputPath;

  for (const arg of args) {
    if (arg.startsWith("--sizes=")) {
      fileSizesBytes = parseByteSizeList(arg.slice("--sizes=".length));
      continue;
    }
    if (arg.startsWith("--burst-concurrency=")) {
      burstConcurrency = Number.parseInt(arg.slice("--burst-concurrency=".length), 10);
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
    if (arg.startsWith("--post-download-ms=")) {
      postDownloadDurationMs = Number.parseInt(arg.slice("--post-download-ms=".length), 10);
      continue;
    }
    if (arg.startsWith("--output=")) {
      outputPath = arg.slice("--output=".length);
    }
  }

  if (fileSizesBytes.length === 0) {
    fileSizesBytes = [...defaultFileSizesBytes];
  }

  return {
    fileSizesBytes,
    burstConcurrency,
    sampleIntervalMs,
    idleDurationMs,
    postDownloadDurationMs,
    outputPath,
  };
}

function parseByteSizeList(raw: string): number[] {
  const values = raw
    .split(",")
    .map((entry) => parseByteSize(entry.trim()))
    .filter((value) => Number.isFinite(value) && value > 0);
  return Array.from(new Set(values));
}

function parseByteSize(raw: string): number {
  const match = /^(\d+)(b|k|kb|kib|m|mb|mib|g|gb|gib)?$/i.exec(raw);
  if (!match) {
    return Number.NaN;
  }

  const value = Number.parseInt(match[1] ?? "", 10);
  const unit = (match[2] ?? "b").toLowerCase();
  switch (unit) {
    case "b":
      return value;
    case "k":
    case "kb":
    case "kib":
      return value * 1024;
    case "m":
    case "mb":
    case "mib":
      return value * 1024 * 1024;
    case "g":
    case "gb":
    case "gib":
      return value * 1024 * 1024 * 1024;
    default:
      return Number.NaN;
  }
}

function mebibytes(value: number): number {
  return value * 1024 * 1024;
}

function computeMiBPerSec(bytes: number, durationMs: number): number {
  if (durationMs <= 0) {
    return 0;
  }
  return bytes / (1024 * 1024) / (durationMs / 1000);
}

function formatMiB(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

function formatMiBPerSec(value: number): string {
  return `${value.toFixed(1)} MiB/s`;
}

function formatBinarySize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GiB`;
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KiB`;
  }
  return `${bytes} B`;
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
