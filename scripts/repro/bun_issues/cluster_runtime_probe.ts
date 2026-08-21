#!/usr/bin/env bun
// PocketBun-only: qualifies Bun's node:cluster control plane with native Bun.serve workers before production use.

import cluster, { type Worker } from "node:cluster";

type Options = {
  messages: number;
  restarts: number;
  smokeMs: number;
};

type ReadyMessage = {
  kind: "worker.ready";
  argv: string[];
  id: number;
  pid: number;
  port: number;
};

type WorkerMessage =
  | ReadyMessage
  | { kind: "worker.echo"; sequence: number; value: unknown }
  | { kind: "worker.request-started"; path: string }
  | { kind: "worker.stopped"; elapsedMs: number; force: boolean };

type ControllerResult = {
  argvPreserved: boolean;
  distinctWorkerIds: boolean;
  distinctWorkerPids: boolean;
  gracefulStopMs: number;
  httpRequests: number;
  ipcMessages: number;
  ipcOrdered: boolean;
  platform: NodeJS.Platform;
  proxyReachedWorkerIds: number[];
  restartCount: number;
  reusePort: boolean;
  sseGracefulStopWaited: boolean;
  sseRequests: number;
  workerIdsReached: number[];
};

const args = Bun.argv.slice(2);

if (args[0] === "--proxy") {
  await runProxy(args[1] ?? "");
} else if (cluster.isWorker) {
  await runWorker();
} else if (args[0] === "--controller") {
  await runController(parseOptions(args.slice(1)));
} else if (args[0] === "--orphan-controller") {
  await runOrphanController();
} else {
  await runSupervisor(parseOptions(args));
}

function parseOptions(values: string[]): Options {
  const extended = values.includes("--extended");
  return {
    messages: optionInt(values, "--messages", extended ? 10_000 : 1_000),
    restarts: optionInt(values, "--restarts", extended ? 100 : 5),
    smokeMs: optionInt(values, "--smoke-ms", extended ? 600_000 : 2_000),
  };
}

function optionInt(values: string[], flag: string, fallback: number): number {
  const index = values.indexOf(flag);
  if (index < 0) {
    return fallback;
  }
  const value = Number(values[index + 1]);
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${flag} must be a non-negative integer`);
  }
  return value;
}

async function runSupervisor(options: Options): Promise<void> {
  const sourceEntry = import.meta.path;
  const source = await runControllerChild(sourceEntry, options);

  const buildDirectory = `${process.cwd()}/.tmp/cluster-runtime-probe`;
  const build = await Bun.build({
    entrypoints: [sourceEntry],
    outdir: buildDirectory,
    target: "bun",
    format: "esm",
    packages: "external",
  });
  if (!build.success || !build.outputs[0]) {
    throw new AggregateError(build.logs, "failed to build cluster runtime probe");
  }

  const built = await runControllerChild(build.outputs[0].path, {
    messages: Math.min(options.messages, 100),
    restarts: Math.min(options.restarts, 1),
    smokeMs: Math.min(options.smokeMs, 1_000),
  });
  const orphanCleanup = await runOrphanProbe(sourceEntry);

  console.log(
    JSON.stringify(
      {
        bun: Bun.version_with_sha,
        source,
        built,
        orphanCleanup,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

async function runControllerChild(entry: string, options: Options): Promise<ControllerResult> {
  let resolveResult!: (result: ControllerResult) => void;
  const result = new Promise<ControllerResult>((resolve) => {
    resolveResult = resolve;
  });
  const child = Bun.spawn({
    cmd: [
      process.execPath,
      entry,
      "--controller",
      "--messages",
      String(options.messages),
      "--restarts",
      String(options.restarts),
      "--smoke-ms",
      String(options.smokeMs),
      "--probe-argument",
      "sentinel",
    ],
    cwd: process.cwd(),
    env: process.env,
    stdin: "ignore",
    stdout: "inherit",
    stderr: "inherit",
    ipc(message) {
      if (isRecord(message) && message.kind === "controller.result") {
        resolveResult(message.result as ControllerResult);
      }
    },
  });

  const resolved = await withTimeout(result, "controller result", options.smokeMs + 120_000);
  const exitCode = await child.exited;
  if (exitCode !== 0) {
    throw new Error(`cluster controller exited with status ${exitCode}`);
  }
  return resolved;
}

async function runController(options: Options): Promise<void> {
  cluster.schedulingPolicy = cluster.SCHED_NONE;
  const reusePort = process.platform === "linux";
  const ports = await findConsecutivePorts(4);
  const sharedPort = ports[0]!;
  const mainWorkers = await Promise.all([
    forkWorker(0, reusePort ? sharedPort : ports[0]!, reusePort),
    forkWorker(1, reusePort ? sharedPort : ports[1]!, reusePort),
  ]);

  const ready = mainWorkers.map((item) => item.ready);
  assert(new Set(ready.map((item) => item.id)).size === ready.length, "worker IDs must be distinct");
  assert(new Set(ready.map((item) => item.pid)).size === ready.length, "worker PIDs must be distinct");
  assert(
    ready.every((item) => item.argv.includes("--probe-argument") && item.argv.includes("sentinel")),
    "cluster.fork() must preserve entrypoint arguments",
  );

  let proxy: Awaited<ReturnType<typeof startProxy>> | null = null;
  const directUrls = ready.map((item) => `http://127.0.0.1:${item.port}`);
  let trafficUrl = directUrls[0]!;
  let proxyReachedWorkerIds: number[] = [];
  if (!reusePort) {
    proxy = await startProxy(import.meta.path, directUrls);
    trafficUrl = proxy.url;
    proxyReachedWorkerIds = await collectWorkerIds(trafficUrl, ready.length);
    assert(proxyReachedWorkerIds.length === ready.length, "external proxy must reach every distinct-port worker");
  }

  let workerIdsReached = await collectWorkerIds(trafficUrl, ready.length);
  assert(workerIdsReached.length === ready.length, "fresh HTTP connections must reach every worker");

  const ipc = await exerciseIpc(mainWorkers[0]!.worker, options.messages);
  assert(ipc.ordered, "IPC messages must remain ordered from one sender");

  if (reusePort) {
    await stopWorker(mainWorkers[0]!.worker, true);
    mainWorkers[0] = await forkWorker(0, sharedPort, true);
    workerIdsReached = await collectWorkerIds(trafficUrl, ready.length);
    assert(workerIdsReached.includes(mainWorkers[0]!.ready.id), "replacement shared-port worker must receive traffic");
  }

  const lifecyclePort = ports[2]!;
  let lifecycle = await forkWorker(2, lifecyclePort, false);
  const slowStarted = waitForWorkerMessage(
    lifecycle.worker,
    (message): message is Extract<WorkerMessage, { kind: "worker.request-started" }> =>
      isWorkerMessage(message) && message.kind === "worker.request-started" && message.path === "/slow",
    "slow request start",
  );
  const slowRequest = fetch(`http://127.0.0.1:${lifecyclePort}/slow`, { headers: { Connection: "close" } });
  await slowStarted;
  const gracefulStop = stopWorker(lifecycle.worker, false);
  const response = await slowRequest;
  assert(response.status === 200, "graceful stop must allow an in-flight request to finish");
  await response.arrayBuffer();
  const gracefulStopResult = await gracefulStop;
  assert(gracefulStopResult.elapsedMs >= 100, "graceful stop must wait for the in-flight request");

  lifecycle = await forkWorker(2, lifecyclePort, false);
  const sseResponse = await fetch(`http://127.0.0.1:${lifecyclePort}/sse`, { headers: { Connection: "close" } });
  const sseReader = sseResponse.body!.getReader();
  await sseReader.read();
  const sseStop = stopWorker(lifecycle.worker, false);
  const sseGracefulStopWaited = await Promise.race([sseStop.then(() => false), Bun.sleep(150).then(() => true)]);
  await sseReader.cancel();
  await sseStop;

  for (let index = 0; index < options.restarts; index += 1) {
    lifecycle = await forkWorker(2, lifecyclePort, false);
    const identity = await fetchIdentity(`http://127.0.0.1:${lifecyclePort}`);
    assert(identity.id === lifecycle.ready.id, "replacement worker must reclaim its assigned port");
    await stopWorker(lifecycle.worker, true);
  }

  const smoke = await runSmoke(trafficUrl, options.smokeMs);

  await Promise.all(mainWorkers.map((item) => stopWorker(item.worker, true)));
  proxy?.process.kill();
  if (proxy) {
    await proxy.process.exited;
  }
  await new Promise<void>((resolve) => cluster.disconnect(resolve));

  const result: ControllerResult = {
    argvPreserved: true,
    distinctWorkerIds: true,
    distinctWorkerPids: true,
    gracefulStopMs: gracefulStopResult.elapsedMs,
    httpRequests: smoke.httpRequests,
    ipcMessages: options.messages,
    ipcOrdered: ipc.ordered,
    platform: process.platform,
    proxyReachedWorkerIds,
    restartCount: options.restarts,
    reusePort,
    sseGracefulStopWaited,
    sseRequests: smoke.sseRequests,
    workerIdsReached,
  };
  await new Promise<void>((resolve, reject) => {
    const sent = process.send?.({ kind: "controller.result", result }, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
    if (!sent) {
      reject(new Error("controller has no parent IPC channel"));
    }
  });
  process.disconnect?.();
  process.exit(0);
}

async function runWorker(): Promise<void> {
  const id = cluster.worker!.id;
  const port = Number(process.env.POCKETBUN_CLUSTER_PROBE_PORT);
  const reusePort = process.env.POCKETBUN_CLUSTER_PROBE_REUSE_PORT === "1";
  let stopping = false;

  const server = Bun.serve({
    hostname: "127.0.0.1",
    port,
    reusePort,
    fetch(request) {
      const path = new URL(request.url).pathname;
      if (path === "/slow") {
        process.send?.({ kind: "worker.request-started", path });
        return Bun.sleep(250).then(() => new Response("ok"));
      }
      if (path === "/sse") {
        return new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(new TextEncoder().encode(`data: ${id}\n\n`));
            },
          }),
          { headers: { "Content-Type": "text/event-stream" } },
        );
      }
      return Response.json({ id, pid: process.pid, port });
    },
  });

  process.on("message", async (message: unknown) => {
    if (!isRecord(message)) {
      return;
    }
    if (message.kind === "echo" && typeof message.sequence === "number") {
      process.send?.({ kind: "worker.echo", sequence: message.sequence, value: message.value });
      return;
    }
    if (message.kind === "stop" && typeof message.force === "boolean" && !stopping) {
      stopping = true;
      const start = performance.now();
      await server.stop(message.force);
      process.send?.({
        kind: "worker.stopped",
        elapsedMs: performance.now() - start,
        force: message.force,
      });
      process.disconnect?.();
    }
  });
  process.on("disconnect", async () => {
    if (!stopping) {
      await server.stop(true);
    }
    process.exit(0);
  });

  process.send?.({
    kind: "worker.ready",
    argv: process.argv.slice(2),
    id,
    pid: process.pid,
    port: server.port,
  });
}

async function forkWorker(slot: number, port: number, reusePort: boolean): Promise<{ ready: ReadyMessage; worker: Worker }> {
  const worker = cluster.fork({
    POCKETBUN_CLUSTER_PROBE_PORT: String(port),
    POCKETBUN_CLUSTER_PROBE_REUSE_PORT: reusePort ? "1" : "0",
    POCKETBUN_CLUSTER_PROBE_SLOT: String(slot),
  });
  const ready = await waitForWorkerMessage(
    worker,
    (message): message is ReadyMessage => isWorkerMessage(message) && message.kind === "worker.ready",
    `worker ${worker.id} readiness`,
  );
  return { ready, worker };
}

async function stopWorker(worker: Worker, force: boolean): Promise<Extract<WorkerMessage, { kind: "worker.stopped" }>> {
  const stopped = waitForWorkerMessage(
    worker,
    (message): message is Extract<WorkerMessage, { kind: "worker.stopped" }> =>
      isWorkerMessage(message) && message.kind === "worker.stopped" && message.force === force,
    `worker ${worker.id} stop`,
  );
  const exited = new Promise<void>((resolve) => worker.once("exit", () => resolve()));
  worker.send({ kind: "stop", force });
  const result = await stopped;
  await withTimeout(exited, `worker ${worker.id} exit`, 10_000);
  return result;
}

async function exerciseIpc(worker: Worker, count: number): Promise<{ ordered: boolean }> {
  const received: number[] = [];
  const complete = new Promise<void>((resolve) => {
    worker.on("message", (message: unknown) => {
      if (isWorkerMessage(message) && message.kind === "worker.echo") {
        received.push(message.sequence);
        if (received.length === count) {
          resolve();
        }
      }
    });
  });
  for (let sequence = 0; sequence < count; sequence += 1) {
    worker.send({
      kind: "echo",
      sequence,
      value: sequence === 0 ? { array: [1, "two", true, null], nested: { ok: true } } : null,
    });
  }
  await withTimeout(complete, `${count} ordered IPC messages`, 60_000);
  return { ordered: received.every((value, index) => value === index) };
}

async function collectWorkerIds(url: string, expected: number): Promise<number[]> {
  const ids = new Set<number>();
  for (let attempt = 0; attempt < 200 && ids.size < expected; attempt += 1) {
    const identity = await fetchIdentity(url);
    ids.add(identity.id);
  }
  return [...ids].sort((left, right) => left - right);
}

async function fetchIdentity(url: string): Promise<{ id: number; pid: number; port: number }> {
  const response = await fetch(`${url}/identity?request=${crypto.randomUUID()}`, {
    headers: { Connection: "close" },
  });
  assert(response.ok, `identity request failed with status ${response.status}`);
  return (await response.json()) as { id: number; pid: number; port: number };
}

async function runSmoke(url: string, durationMs: number): Promise<{ httpRequests: number; sseRequests: number }> {
  const deadline = performance.now() + durationMs;
  let httpRequests = 0;
  let sseRequests = 0;
  while (performance.now() < deadline) {
    await fetchIdentity(url);
    httpRequests += 1;
    if (httpRequests % 25 === 0) {
      const response = await fetch(`${url}/sse?request=${crypto.randomUUID()}`, {
        headers: { Connection: "close" },
      });
      const reader = response.body!.getReader();
      await reader.read();
      await reader.cancel();
      sseRequests += 1;
    }
  }
  return { httpRequests, sseRequests };
}

async function startProxy(entry: string, backends: string[]) {
  let resolvePort!: (port: number) => void;
  const ready = new Promise<number>((resolve) => {
    resolvePort = resolve;
  });
  const process = Bun.spawn({
    cmd: [globalThis.process.execPath, entry, "--proxy", backends.join(",")],
    cwd: globalThis.process.cwd(),
    env: globalThis.process.env,
    stdin: "ignore",
    stdout: "inherit",
    stderr: "inherit",
    ipc(message) {
      if (isRecord(message) && message.kind === "proxy.ready" && typeof message.port === "number") {
        resolvePort(message.port);
      }
    },
  });
  const port = await withTimeout(ready, "test proxy readiness", 10_000);
  return { process, url: `http://127.0.0.1:${port}` };
}

async function runProxy(rawBackends: string): Promise<void> {
  const backends = rawBackends.split(",").filter(Boolean);
  assert(backends.length > 0, "proxy requires at least one backend");
  let next = 0;
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request) {
      const backend = backends[next++ % backends.length]!;
      const url = new URL(request.url);
      return fetch(`${backend}${url.pathname}${url.search}`, {
        method: request.method,
        headers: { Connection: "close" },
      });
    },
  });
  process.on("disconnect", async () => {
    await server.stop(true);
    process.exit(0);
  });
  process.send?.({ kind: "proxy.ready", port: server.port });
}

async function findConsecutivePorts(count: number): Promise<number[]> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const first = 20_000 + Math.floor(Math.random() * (40_000 - count));
    const servers: Array<ReturnType<typeof Bun.serve>> = [];
    try {
      for (let offset = 0; offset < count; offset += 1) {
        servers.push(
          Bun.serve({
            hostname: "127.0.0.1",
            port: first + offset,
            fetch: () => new Response("reserved"),
          }),
        );
      }
      await Promise.all(servers.map((server) => server.stop(true)));
      return Array.from({ length: count }, (_, offset) => first + offset);
    } catch {
      await Promise.all(servers.map((server) => server.stop(true)));
    }
  }
  throw new Error(`could not find ${count} consecutive loopback ports`);
}

async function runOrphanProbe(entry: string): Promise<{ workerPids: number[]; workersExited: boolean }> {
  let resolvePids!: (pids: number[]) => void;
  const ready = new Promise<number[]>((resolve) => {
    resolvePids = resolve;
  });
  const controller = Bun.spawn({
    cmd: [process.execPath, entry, "--orphan-controller", "--probe-argument", "sentinel"],
    cwd: process.cwd(),
    env: process.env,
    stdin: "ignore",
    stdout: "inherit",
    stderr: "inherit",
    ipc(message) {
      if (isRecord(message) && message.kind === "orphan.ready" && Array.isArray(message.pids)) {
        resolvePids(message.pids.filter((pid): pid is number => typeof pid === "number"));
      }
    },
  });
  const workerPids = await withTimeout(ready, "orphan probe readiness", 10_000);
  controller.kill("SIGKILL");
  await controller.exited;

  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline && workerPids.some(isProcessAlive)) {
    await Bun.sleep(25);
  }
  const workersExited = workerPids.every((pid) => !isProcessAlive(pid));
  assert(workersExited, "cluster workers must exit after an unexpected primary IPC disconnect");
  return { workerPids, workersExited };
}

async function runOrphanController(): Promise<void> {
  cluster.schedulingPolicy = cluster.SCHED_NONE;
  const ports = await findConsecutivePorts(2);
  const workers = await Promise.all([forkWorker(0, ports[0]!, false), forkWorker(1, ports[1]!, false)]);
  process.send?.({ kind: "orphan.ready", pids: workers.map((item) => item.ready.pid) });
  await new Promise(() => {});
}

function waitForWorkerMessage<T extends WorkerMessage>(
  worker: Worker,
  predicate: (message: unknown) => message is T,
  label: string,
): Promise<T> {
  return withTimeout(
    new Promise<T>((resolve, reject) => {
      const onMessage = (message: unknown) => {
        if (predicate(message)) {
          cleanup();
          resolve(message);
        }
      };
      const onExit = (code: number, signal: string) => {
        cleanup();
        reject(new Error(`${label} worker exited first with code ${code} signal ${signal}`));
      };
      const cleanup = () => {
        worker.off("message", onMessage);
        worker.off("exit", onExit);
      };
      worker.on("message", onMessage);
      worker.on("exit", onExit);
    }),
    label,
    30_000,
  );
}

function withTimeout<T>(promise: Promise<T>, label: string, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    Bun.sleep(timeoutMs).then(() => {
      throw new Error(`${label} timed out after ${timeoutMs}ms`);
    }),
  ]);
}

function isWorkerMessage(value: unknown): value is WorkerMessage {
  return isRecord(value) && typeof value.kind === "string" && value.kind.startsWith("worker.");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}
