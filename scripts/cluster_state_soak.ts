// PocketBun-only: sustained Linux cluster qualification against one shared pb_data directory.

import { Database } from "bun:sqlite";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ExtractAsync } from "../src/tools/archive/index.ts";

type State = { pid: number; role: "leader" | "follower"; slot: number; appName: string; count: number; checksum: number };
type SSE = { reader: ReadableStreamDefaultReader<Uint8Array>; buffer: string; pid: number; clientId: string };
type Sample = { elapsedSeconds: number; latencyMs: number; rssMiB: number; fds: number; cpuSeconds: number };

const migrationSource = `migrate((app) => {
  const items = newBaseCollection("soak_items");
  items.listRule = "";
  items.viewRule = "";
  items.createRule = "";
  items.updateRule = "";
  items.deleteRule = "";
  items.fields.add(new TextField({ name: "value", required: true }));
  app.save(items);

  app.db().newQuery("CREATE TABLE cluster_soak (op INTEGER PRIMARY KEY, value INTEGER NOT NULL)").execute();
  const settings = app.settings();
  settings.meta.appName = "cluster-soak-initial";
  settings.rateLimits.enabled = true;
  settings.rateLimits.rules = [{ label: "GET /__soak_rate", maxRequests: 3, duration: 1 }];
  app.save(settings);
});
`;

const hooksSource = `const fs = require("node:fs");

routerUse(new Middleware((event) => {
  event.response.header().set("X-PocketBun-Worker-Pid", String(process.pid));
  const excluded = (event.request.header.get("X-Exclude-Worker-Pids") || "")
    .split(",")
    .map((value) => Number(value.trim()));
  if (excluded.includes(process.pid)) return event.json(409, { pid: process.pid });
  return event.next();
}, -2000, "cluster-soak-affinity"));

routerAdd("GET", "/__soak_state", (event) => {
  const result = {};
  $app.db().newQuery("SELECT COUNT(*) AS count, COALESCE(SUM(value), 0) AS checksum FROM cluster_soak").one(result);
  return event.json(200, {
    pid: process.pid,
    role: process.env.POCKETBUN_CLUSTER_ROLE,
    slot: Number(process.env.POCKETBUN_CLUSTER_SLOT),
    appName: $app.settings().meta.appName,
    count: Number(result.count),
    checksum: Number(result.checksum),
  });
});

routerAdd("POST", "/__soak_write", (event) => {
  const op = Number(event.request.url.query().get("op"));
  if (!Number.isSafeInteger(op) || op < 1) return event.json(400, { error: "invalid op" });
  const error = $app.runInTransaction((txApp) => {
    txApp.db().newQuery("INSERT INTO cluster_soak (op, value) VALUES ({:op}, {:value})").bind({ op, value: op * 7 }).execute();
  });
  return event.json(error ? 500 : 200, { error: error ? error.message : "", pid: process.pid });
});

routerAdd("POST", "/__soak_settings", (event) => {
  const settings = $app.settings();
  settings.meta.appName = event.request.url.query().get("name") || "";
  $app.save(settings);
  return event.json(200, { pid: process.pid });
});

routerAdd("POST", "/__soak_checkpoint", (event) => {
  try {
    $app.db().newQuery("PRAGMA wal_checkpoint(TRUNCATE)").execute();
    return event.json(200, { error: "", pid: process.pid });
  } catch (error) {
    return event.json(200, { error: error.message || String(error), pid: process.pid });
  }
});

routerAdd("POST", "/__soak_backup", async (event) => {
  const name = "cluster-soak-" + Date.now() + ".zip";
  const error = await $app.createBackup(null, name);
  return event.json(error ? 500 : 200, { error: error ? error.message : "", name, pid: process.pid });
});

routerAdd("POST", "/__soak_restart", (event) => {
  setTimeout(() => $app.restart(), 50);
  return event.noContent(204);
});

routerAdd("GET", "/__soak_rate", (event) => event.json(200, { pid: process.pid }));
`;

const options = parseOptions();
if (process.platform !== "linux") {
  throw new Error("cluster_state_soak.ts is a Linux-only qualification harness");
}

const root = await mkdtemp(join(tmpdir(), "pocketbun-cluster-soak-"));
const dataDir = join(root, "pb_data");
const hooksDir = join(root, "pb_hooks");
const migrationsDir = join(root, "pb_migrations");
const [port] = await findPorts();
const address = `127.0.0.1:${port}`;
const baseUrl = `http://${address}`;
const sourceData = resolve(fileURLToPath(new URL("../src/tests/data", import.meta.url)));
await cp(sourceData, dataDir, { recursive: true });
await mkdir(hooksDir, { recursive: true });
await mkdir(migrationsDir, { recursive: true });
await writeFile(join(hooksDir, "cluster-soak.pb.js"), hooksSource);
await writeFile(join(migrationsDir, "9999999999_cluster_soak.js"), migrationSource);

const primary = Bun.spawn({
  cmd: [
    process.execPath,
    "bin/pocketbun",
    "--dir",
    dataDir,
    "--hooksDir",
    hooksDir,
    "--migrationsDir",
    migrationsDir,
    "--hooksWatch=false",
    "--hooksPool=1",
    `--workers=${options.workers}`,
    "serve",
    "--http",
    address,
  ],
  cwd: process.cwd(),
  env: process.env,
  stdin: "ignore",
  stdout: "pipe",
  stderr: "pipe",
});
const output = collectOutput(primary);
const startedAt = Date.now();
const samples: Sample[] = [];
let op = 1;
let expectedCount = 0;
let expectedChecksum = 0;
let stream: SSE | null = null;
let lastBackup = "";
let interrupted = false;
process.once("SIGTERM", () => {
  interrupted = true;
});
process.once("SIGINT", () => {
  interrupted = true;
});

try {
  await waitFor(() => output.stdout.includes(`[cluster] ${options.workers} workers`), "cluster startup", 60_000);
  await states(baseUrl, options.workers);
  stream = await openSSE(baseUrl);
  console.log(`cluster soak started: workers=${options.workers}, minutes=${options.minutes}, root=${root}`);

  let nextSettings = startedAt;
  let nextBackup = startedAt;
  let nextFault = startedAt + 120_000;
  let nextRestart = startedAt + 300_000;
  let nextSample = startedAt;
  let iteration = 0;
  const deadline = startedAt + options.minutes * 60_000;

  while (Date.now() < deadline) {
    iteration += 1;
    const write = await request(baseUrl, `/__soak_write?op=${op}`, { method: "POST" });
    requireStatus(write.response, 200, "soak write");
    expectedCount += 1;
    expectedChecksum += op * 7;
    op += 1;

    const created = await request(baseUrl, "/api/collections/soak_items/records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: `soak-${iteration}` }),
    });
    requireStatus(created.response, 200, "record create");
    const record = (await created.response.json()) as { id: string };
    await expectRecordEvent(stream, record.id);
    const updated = await request(baseUrl, `/api/collections/soak_items/records/${record.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: `updated-${iteration}` }),
    });
    requireStatus(updated.response, 200, "record update");
    await expectRecordEvent(stream, record.id);
    if (iteration % 3 === 0) {
      const removed = await request(baseUrl, `/api/collections/soak_items/records/${record.id}`, { method: "DELETE" });
      requireStatus(removed.response, 204, "record delete");
      await expectRecordEvent(stream, record.id);
    }

    const checkpoint = await request(baseUrl, "/__soak_checkpoint", { method: "POST" });
    requireStatus(checkpoint.response, 200, "checkpoint");
    const checkpointBody = (await checkpoint.response.json()) as { error: string };
    if (checkpointBody.error && !/busy|locked/i.test(checkpointBody.error)) {
      throw new Error(`unexpected checkpoint error: ${checkpointBody.error}`);
    }

    if (Date.now() >= nextSettings) {
      const name = `cluster-soak-${iteration}`;
      requireStatus((await request(baseUrl, `/__soak_settings?name=${name}`, { method: "POST" })).response, 200, "settings");
      await waitFor(
        async () => (await states(baseUrl, options.workers)).every((state) => state.appName === name),
        "settings convergence",
        10_000,
      );
      nextSettings = Date.now() + 30_000;
    }

    if (Date.now() >= nextBackup) {
      const backup = await request(baseUrl, "/__soak_backup", { method: "POST" });
      requireStatus(backup.response, 200, "backup");
      const body = (await backup.response.json()) as { error: string; name: string };
      if (body.error) throw new Error(`backup failed: ${body.error}`);
      lastBackup = body.name;
      await verifyBackup(join(dataDir, "backups", lastBackup), expectedCount, expectedChecksum);
      nextBackup = Date.now() + 120_000;
    }

    if (Date.now() >= nextFault) {
      const current = await states(baseUrl, options.workers);
      const victim = current.find((state) => state.pid === stream!.pid) ?? current[current.length - 1]!;
      process.kill(victim.pid, "SIGKILL");
      await expectClosed(stream!);
      await waitFor(
        async () => (await states(baseUrl, options.workers)).every((state) => state.pid !== victim.pid),
        "worker replacement",
        20_000,
      );
      stream = await openSSE(baseUrl);
      nextFault = Date.now() + 120_000;
    }

    if (Date.now() >= nextRestart) {
      const before = new Set((await states(baseUrl, options.workers)).map((state) => state.pid));
      requireStatus((await request(baseUrl, "/__soak_restart", { method: "POST" })).response, 204, "cluster restart");
      await waitFor(
        async () => (await states(baseUrl, options.workers)).every((state) => !before.has(state.pid)),
        "cluster restart",
        30_000,
      );
      await stream!.reader.cancel().catch(() => {});
      stream = await openSSE(baseUrl);
      nextRestart = Date.now() + 300_000;
    }

    if (Date.now() >= nextSample) {
      samples.push(
        await sample(
          primary.pid,
          (await states(baseUrl, options.workers)).map((state) => state.pid),
          startedAt,
          baseUrl,
        ),
      );
      console.log(JSON.stringify({ iteration, ...samples[samples.length - 1], backup: lastBackup }));
      nextSample = Date.now() + 30_000;
    }

    // Keep the soak representative and bounded: this exercises long-lived connections and state convergence,
    // not maximum write throughput (which has a separate benchmark gate).
    await Bun.sleep(50);
  }

  if (interrupted) throw new Error("cluster soak interrupted");
  await verifyCluster(baseUrl, options.workers, expectedCount, expectedChecksum);
  if (lastBackup) await verifyBackup(join(dataDir, "backups", lastBackup), expectedCount, expectedChecksum);
  printSummary(samples);
  console.log("cluster soak passed");
} catch (error) {
  console.error(`cluster soak failed; retained data at ${root}`);
  console.error(output.stderr);
  throw error;
} finally {
  await stream?.reader.cancel().catch(() => {});
  if (isAlive(primary.pid)) primary.kill("SIGTERM");
  await Promise.race([primary.exited, Bun.sleep(20_000)]);
  if (isAlive(primary.pid)) primary.kill("SIGKILL");
  await primary.exited;
  await output.done;
  if (!options.keep) await rm(root, { recursive: true, force: true });
}

function parseOptions(): { workers: number; minutes: number; keep: boolean } {
  const workers = Number(arg("workers") ?? "2");
  const minutes = Number(arg("minutes") ?? "60");
  if (!Number.isInteger(workers) || workers < 2 || !Number.isFinite(minutes) || minutes <= 0) {
    throw new Error("usage: bun scripts/cluster_state_soak.ts [--workers=2|4] [--minutes=60] [--keep]");
  }
  return { workers, minutes, keep: process.argv.includes("--keep") };
}

function arg(name: string): string | undefined {
  return process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
}

async function request(baseUrl: string, path: string, init: RequestInit = {}): Promise<{ response: Response; pid: number }> {
  const response = await fetch(`${baseUrl}${path}`, init);
  return { response, pid: Number(response.headers.get("X-PocketBun-Worker-Pid")) };
}

async function states(baseUrl: string, workers: number): Promise<State[]> {
  let latest: State[] = [];
  await waitFor(
    async () => {
      const found = new Map<number, State>();
      for (let index = 0; index < workers * 12 && found.size < workers; index += 1) {
        const response = await fetch(`${baseUrl}/__soak_state?probe=${crypto.randomUUID()}`, {
          headers: { Connection: "close" },
        });
        if (response.ok) {
          const state = (await response.json()) as State;
          found.set(state.pid, state);
        }
      }
      latest = [...found.values()];
      return latest.length === workers;
    },
    `${workers} worker states`,
    20_000,
  );
  return latest;
}

async function openSSE(baseUrl: string): Promise<SSE> {
  const opened = await request(baseUrl, "/api/realtime");
  requireStatus(opened.response, 200, "realtime connect");
  if (!opened.response.body) throw new Error("realtime response has no body");
  const stream: SSE = {
    reader: opened.response.body.getReader() as SSE["reader"],
    buffer: "",
    pid: opened.pid,
    clientId: "",
  };
  const connect = await readEvent(stream, 10_000);
  if (connect.name !== "PB_CONNECT") throw new Error(`expected PB_CONNECT, got ${connect.name}`);
  stream.clientId = (JSON.parse(connect.data) as { clientId: string }).clientId;
  const subscribed = await request(baseUrl, "/api/realtime", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId: stream.clientId, subscriptions: ["soak_items/*"] }),
  });
  requireStatus(subscribed.response, 204, "realtime subscribe");
  return stream;
}

async function expectRecordEvent(stream: SSE, id: string): Promise<void> {
  const event = await readEvent(stream, 10_000);
  const payload = JSON.parse(event.data) as { record?: { id?: string } };
  if (event.name !== "soak_items/*" || payload.record?.id !== id) {
    throw new Error(`unexpected realtime event: ${event.name} ${event.data}`);
  }
}

async function readEvent(stream: SSE, timeoutMs: number): Promise<{ name: string; data: string }> {
  const deadline = Date.now() + timeoutMs;
  const decoder = new TextDecoder();
  while (Date.now() < deadline) {
    const separator = stream.buffer.indexOf("\n\n");
    if (separator >= 0) {
      const block = stream.buffer.slice(0, separator);
      stream.buffer = stream.buffer.slice(separator + 2);
      const name =
        block
          .split("\n")
          .find((line) => line.startsWith("event:"))
          ?.slice(6) ?? "";
      const data = block
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5))
        .join("\n");
      if (name) return { name, data };
      continue;
    }
    const result = await Promise.race([
      stream.reader.read(),
      Bun.sleep(Math.max(1, deadline - Date.now())).then(() => {
        throw new Error(`realtime event timed out after ${timeoutMs}ms`);
      }),
    ]);
    if (result.done) throw new Error("realtime stream closed");
    stream.buffer += decoder.decode(result.value, { stream: true }).replaceAll("\r\n", "\n");
  }
  throw new Error(`realtime event timed out after ${timeoutMs}ms`);
}

async function expectClosed(stream: SSE): Promise<void> {
  await Promise.race([
    stream.reader.read().catch(() => undefined),
    Bun.sleep(10_000).then(() => {
      throw new Error("realtime stream did not close after worker death");
    }),
  ]);
}

async function verifyCluster(baseUrl: string, workers: number, count: number, checksum: number): Promise<void> {
  const current = await states(baseUrl, workers);
  for (const state of current) {
    if (state.count !== count || state.checksum !== checksum) {
      throw new Error(`state mismatch on ${state.pid}: ${JSON.stringify(state)}, expected ${count}/${checksum}`);
    }
  }
}

async function verifyBackup(path: string, count: number, checksum: number): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "pocketbun-cluster-soak-backup-"));
  try {
    await ExtractAsync(path, root);
    using db = new Database(join(root, "data.db"), { readonly: true });
    const integrity = db.query("PRAGMA integrity_check").get() as { integrity_check: string };
    if (integrity.integrity_check !== "ok") throw new Error(`backup integrity check failed: ${integrity.integrity_check}`);
    const result = db.query("SELECT COUNT(*) AS count, COALESCE(SUM(value), 0) AS checksum FROM cluster_soak").get() as {
      count: number;
      checksum: number;
    };
    if (Number(result.count) > count || Number(result.checksum) > checksum) {
      throw new Error(`backup contains impossible future state: ${JSON.stringify(result)}`);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function sample(primaryPid: number, workerPids: number[], startedAt: number, baseUrl: string): Promise<Sample> {
  const before = performance.now();
  requireStatus((await request(baseUrl, "/__soak_state")).response, 200, "latency probe");
  const processes = [primaryPid, ...workerPids];
  const stats = await Promise.all(processes.map(readProcessStats));
  return {
    elapsedSeconds: Math.round((Date.now() - startedAt) / 1000),
    latencyMs: Math.round((performance.now() - before) * 100) / 100,
    rssMiB: Math.round((stats.reduce((total, item) => total + item.rssKiB, 0) / 1024) * 100) / 100,
    fds: stats.reduce((total, item) => total + item.fds, 0),
    cpuSeconds: Math.round(stats.reduce((total, item) => total + item.cpuSeconds, 0) * 100) / 100,
  };
}

async function readProcessStats(pid: number): Promise<{ rssKiB: number; fds: number; cpuSeconds: number }> {
  const [status, stat, fds] = await Promise.all([
    readFile(`/proc/${pid}/status`, "utf8"),
    readFile(`/proc/${pid}/stat`, "utf8"),
    readdir(`/proc/${pid}/fd`),
  ]);
  const rssKiB = Number(status.match(/^VmRSS:\s+(\d+)/m)?.[1] ?? 0);
  const fields = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
  const ticks = Number(fields[11]) + Number(fields[12]);
  return { rssKiB, fds: fds.length, cpuSeconds: ticks / 100 };
}

function printSummary(samples: Sample[]): void {
  const first = samples[0];
  const last = samples[samples.length - 1];
  if (!first || !last) return;
  console.log(
    JSON.stringify({
      samples: samples.length,
      rssMiB: [first.rssMiB, last.rssMiB],
      fds: [first.fds, last.fds],
      latencyMs: [first.latencyMs, last.latencyMs],
      cpuSeconds: last.cpuSeconds,
    }),
  );
}

function requireStatus(response: Response, status: number, label: string): void {
  if (response.status !== status) throw new Error(`${label} returned ${response.status}`);
}

function collectOutput(child: ReturnType<typeof Bun.spawn>) {
  let stdout = "";
  let stderr = "";
  const read = async (stream: ReadableStream<Uint8Array>, append: (value: string) => void) => {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    for (;;) {
      const result = await reader.read();
      if (result.done) return;
      append(decoder.decode(result.value, { stream: true }));
    }
  };
  const done = Promise.all([
    read(child.stdout as ReadableStream<Uint8Array>, (value) => {
      stdout += value;
    }),
    read(child.stderr as ReadableStream<Uint8Array>, (value) => {
      stderr += value;
    }),
  ]).then(() => undefined);
  return {
    get stdout() {
      return stdout;
    },
    get stderr() {
      return stderr;
    },
    done,
  };
}

async function findPorts(): Promise<[number]> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const port = 20_000 + Math.floor(Math.random() * 20_000);
    try {
      const server = Bun.serve({ hostname: "127.0.0.1", port, fetch: () => new Response() });
      await server.stop(true);
      return [port];
    } catch {
      // Try another ephemeral candidate.
    }
  }
  throw new Error("could not find a test port");
}

async function waitFor(check: () => boolean | Promise<boolean>, label: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return;
    await Bun.sleep(50);
  }
  throw new Error(`${label} timed out after ${timeoutMs}ms`);
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
