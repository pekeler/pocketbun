// PocketBun-only: exercises the real multi-process CLI lifecycle across the supported Bun platforms.

import { expect, it } from "bun:test";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { LocalClusterGuardFileName } from "../../core/base_paths.ts";

type Identity = {
  pid: number;
  role: "leader" | "follower";
  slot: number;
  workerId: number;
};

it.serial("validates the public --workers CLI contract before bootstrap", async () => {
  const scenarios = [
    { args: ["--workers=0", "serve"], message: "between 1 and 256" },
    { args: ["--workers=2.5", "serve"], message: "expected an integer" },
    { args: ["--workers=257", "serve"], message: "between 1 and 256" },
    { args: ["--workers=2", "superuser", "upsert"], message: "only supported with the serve command" },
  ];

  for (const scenario of scenarios) {
    const child = spawnPocketBun(["bin/pocketbun", ...scenario.args]);
    const exitCode = await withTimeout(child.process.exited, `CLI rejection for ${scenario.args.join(" ")}`, 10_000);
    await child.output.done;
    expect(exitCode).not.toBe(0);
    expect(child.output.stderr).toContain(scenario.message);
  }

  const help = spawnPocketBun(["bin/pocketbun", "serve", "--workers=2", "--help"]);
  expect(await withTimeout(help.process.exited, "cluster help", 10_000)).toBe(0);
  await help.output.done;
  expect(help.output.stdout).toContain("--workers");
  expect(help.output.stdout).toContain("number of PocketBun HTTP worker processes");
});

it.serial("keeps --workers=1 on the existing single-process serve path", async () => {
  const root = await mkdtemp(join(tmpdir(), "pocketbun-single-worker-"));
  const dataDir = join(root, "pb_data");
  const hooksDir = join(root, "pb_hooks");
  const sourceData = resolve(fileURLToPath(new URL("../../tests/data", import.meta.url)));
  await cp(sourceData, dataDir, { recursive: true });
  await mkdir(hooksDir, { recursive: true });
  await writeFile(
    join(hooksDir, "single.pb.js"),
    `routerAdd("GET", "/__pocketbun_single_test", (event) => event.json(200, {
  pid: process.pid,
  role: process.env.POCKETBUN_CLUSTER_ROLE || "disabled",
}));\n`,
  );
  const [port] = await findConsecutivePorts(1);
  const child = spawnPocketBun([
    "bin/pocketbun",
    "--dir",
    dataDir,
    "--hooksDir",
    hooksDir,
    "--hooksWatch=false",
    "--hooksPool=1",
    "--automigrate=false",
    "--workers=1",
    "serve",
    "--http",
    `127.0.0.1:${port}`,
  ]);

  try {
    await withTimeout(child.output.waitFor("Server started at"), "single-worker startup", 30_000);
    const response = await fetch(`http://127.0.0.1:${port}/__pocketbun_single_test`);
    expect(await response.json()).toEqual({ pid: child.process.pid, role: "disabled" });
    expect(child.output.stdout).not.toContain("[cluster]");
    expect(await Bun.file(join(dataDir, LocalClusterGuardFileName)).exists()).toBeFalse();
    child.process.kill("SIGTERM");
    const exitCode = await withTimeout(child.process.exited, "single-worker shutdown", 15_000);
    if (process.platform !== "win32") {
      expect(exitCode).toBe(143);
    }
  } finally {
    if (isProcessAlive(child.process.pid)) {
      child.process.kill("SIGKILL");
      await child.process.exited;
    }
    await rm(root, { recursive: true, force: true });
  }
});

it.serial(
  "terminates the cluster after the worker crash budget is exhausted",
  async () => {
    const root = await mkdtemp(join(tmpdir(), "pocketbun-cluster-crash-loop-"));
    const dataDir = join(root, "pb_data");
    const hooksDir = join(root, "pb_hooks");
    const sourceData = resolve(fileURLToPath(new URL("../../tests/data", import.meta.url)));
    await cp(sourceData, dataDir, { recursive: true });
    await mkdir(hooksDir, { recursive: true });
    await writeFile(
      join(hooksDir, "crash.pb.js"),
      `if (process.env.POCKETBUN_CLUSTER_ROLE === "follower") process.exit(91);\n`,
    );
    const [port] = await findConsecutivePorts(1);
    const child = spawnPocketBun([
      "bin/pocketbun",
      "--dir",
      dataDir,
      "--hooksDir",
      hooksDir,
      "--hooksWatch=false",
      "--hooksPool=1",
      "--automigrate=false",
      "--workers=3",
      "serve",
      "--http",
      `127.0.0.1:${port}`,
    ]);

    try {
      const exitCode = await withTimeout(child.process.exited, "crash-loop shutdown", 30_000);
      await child.output.done;
      expect(exitCode).not.toBe(0);
      expect(child.output.stdout).toContain("follower workers crashed 5 times within 30 seconds");
      const pids = [...child.output.stdout.matchAll(/pid=(\d+)/g)].map((match) => Number(match[1]));
      await waitFor(() => pids.every((pid) => !isProcessAlive(pid)), "crash-loop worker cleanup", 10_000);
      expect(await Bun.file(join(dataDir, LocalClusterGuardFileName)).exists()).toBeFalse();
    } finally {
      if (isProcessAlive(child.process.pid)) {
        child.process.kill("SIGKILL");
        await child.process.exited;
      }
      await rm(root, { recursive: true, force: true });
    }
  },
  45_000,
);

it.serial(
  "force-kills a worker that ignores graceful shutdown",
  async () => {
    const root = await mkdtemp(join(tmpdir(), "pocketbun-cluster-forced-shutdown-"));
    const dataDir = join(root, "pb_data");
    const hooksDir = join(root, "pb_hooks");
    const sourceData = resolve(fileURLToPath(new URL("../../tests/data", import.meta.url)));
    await cp(sourceData, dataDir, { recursive: true });
    await mkdir(hooksDir, { recursive: true });
    await writeFile(
      join(hooksDir, "hang.pb.js"),
      `if (process.env.POCKETBUN_CLUSTER_ROLE === "follower") {
  onTerminate(async () => {
    console.log(\`[cluster-test] hanging termination pid=\${process.pid}\`);
    await new Promise(() => {});
  });
}

routerAdd("POST", "/__pocketbun_cluster_forced_restart", (event) => {
  setTimeout(() => $app.restart(), 50);
  return event.noContent(204);
});
`,
    );
    const ports = await findConsecutivePorts(2);
    const primary = spawnPocketBun([
      "bin/pocketbun",
      "--dir",
      dataDir,
      "--hooksDir",
      hooksDir,
      "--hooksWatch=false",
      "--hooksPool=1",
      "--automigrate=false",
      "--workers=2",
      "serve",
      "--http",
      `127.0.0.1:${ports[0]}`,
    ]);
    let workerPids: number[] = [];

    try {
      await withTimeout(primary.output.waitFor("[cluster] 2 workers"), "cluster startup", 30_000);
      const initialPids = [...primary.output.stdout.matchAll(/\[cluster\] ready .* pid=(\d+)/g)].map((match) =>
        Number(match[1]),
      );
      expect(initialPids).toHaveLength(2);

      const response = await fetch(`http://127.0.0.1:${ports[0]}/__pocketbun_cluster_forced_restart`, {
        method: "POST",
      });
      expect(response.status).toBe(204);
      await withTimeout(primary.output.waitFor("[cluster] restart complete with 2 workers"), "forced cluster restart", 20_000);
      expect(primary.output.stdout).toContain("[cluster-test] hanging termination");
      workerPids = [...primary.output.stdout.matchAll(/\[cluster\] ready .* pid=(\d+)/g)].map((match) => Number(match[1]));
      expect(workerPids).toHaveLength(4);
      await waitFor(() => initialPids.every((pid) => !isProcessAlive(pid)), "forced worker cleanup", 5_000);

      primary.process.kill("SIGKILL");
      await withTimeout(primary.process.exited, "forced cluster primary cleanup", 5_000);
      await primary.output.done;
      await waitFor(() => workerPids.every((pid) => !isProcessAlive(pid)), "replacement worker cleanup", 5_000);
    } finally {
      if (isProcessAlive(primary.process.pid)) {
        primary.process.kill("SIGKILL");
        await primary.process.exited;
      }
      for (const pid of workerPids) {
        if (isProcessAlive(pid)) {
          process.kill(pid, "SIGKILL");
        }
      }
      await withTimeout(primary.output.done, "forced cluster output cleanup", 10_000).catch(() => {});
      await rm(root, { recursive: true, force: true });
    }
  },
  45_000,
);

it.serial(
  "starts, replaces, excludes, and stops real cluster workers",
  async () => {
    const root = await mkdtemp(join(tmpdir(), "pocketbun-cluster-integration-"));
    const dataDir = join(root, "pb_data");
    const hooksDir = join(root, "pb_hooks");
    const sourceData = resolve(fileURLToPath(new URL("../../tests/data", import.meta.url)));
    await cp(sourceData, dataDir, { recursive: true });
    await mkdir(hooksDir, { recursive: true });
    await writeFile(
      join(hooksDir, "cluster.pb.js"),
      `routerAdd("GET", "/__pocketbun_cluster_test", (event) => event.json(200, {
  pid: process.pid,
  role: process.env.POCKETBUN_CLUSTER_ROLE,
  slot: Number(process.env.POCKETBUN_CLUSTER_SLOT),
  workerId: Number(process.env.POCKETBUN_CLUSTER_WORKER_ID),
}));\n`,
    );

    const ports = await findConsecutivePorts(3);
    const address = `127.0.0.1:${ports[0]}`;
    const args = [
      "bin/pocketbun",
      "--dir",
      dataDir,
      "--hooksDir",
      hooksDir,
      "--hooksWatch=false",
      "--hooksPool=1",
      "--automigrate=false",
      "--workers=3",
      "serve",
      "--http",
      address,
    ];
    const primary = spawnPocketBun(args);
    let proxy: ReturnType<typeof Bun.serve> | null = null;
    let knownWorkerPids: number[] = [];

    try {
      await withTimeout(primary.output.waitFor("[cluster] 3 workers"), "cluster startup", 60_000);

      const backendUrls =
        process.platform === "linux" ? [`http://${address}`] : ports.map((port) => `http://127.0.0.1:${port}`);
      let publicUrl = backendUrls[0]!;
      if (process.platform !== "linux") {
        let next = 0;
        proxy = Bun.serve({
          hostname: "127.0.0.1",
          port: 0,
          fetch(request) {
            const backend = backendUrls[next++ % backendUrls.length]!;
            const url = new URL(request.url);
            return fetch(`${backend}${url.pathname}${url.search}`);
          },
        });
        publicUrl = `http://127.0.0.1:${proxy.port}`;
      }

      let identities = await collectIdentities(publicUrl, 3);
      expect(identities.map((identity) => identity.slot).sort((left, right) => left - right)).toEqual([0, 1, 2]);
      expect(new Set(identities.map((identity) => identity.pid)).size).toBe(3);
      expect(identities.filter((identity) => identity.role === "leader")).toHaveLength(1);
      knownWorkerPids = identities.map((identity) => identity.pid);

      const follower = identities.find((identity) => identity.role === "follower")!;
      process.kill(follower.pid, "SIGKILL");
      const replacementFollower = await waitForReplacement(backendUrls, follower);
      expect(replacementFollower.role).toBe("follower");
      knownWorkerPids.push(replacementFollower.pid);

      const leader = identities.find((identity) => identity.role === "leader")!;
      process.kill(leader.pid, "SIGKILL");
      const replacementLeader = await waitForReplacement(backendUrls, leader);
      expect(replacementLeader.role).toBe("leader");
      knownWorkerPids.push(replacementLeader.pid);

      identities = await collectIdentities(publicUrl, 3);
      expect(new Set(identities.map((identity) => identity.pid)).size).toBe(3);
      knownWorkerPids.push(...identities.map((identity) => identity.pid));

      const competing = spawnPocketBun(args);
      const competingExit = await withTimeout(competing.process.exited, "competing primary exit", 15_000);
      await competing.output.done;
      expect(competingExit).not.toBe(0);
      expect(competing.output.stderr).toContain("already owns");
      expect(competing.output.stderr).toContain(dataDir);

      primary.process.kill(process.platform === "win32" ? "SIGTERM" : "SIGINT");
      const exitCode = await withTimeout(primary.process.exited, "cluster shutdown", 20_000);
      if (process.platform !== "win32") {
        expect(exitCode).toBe(130);
      }
      await primary.output.done;
      expect(primary.output.stdout.match(/\[cluster\] 3 workers/g)?.length ?? 0).toBe(1);

      const uniquePids = [...new Set(knownWorkerPids)];
      await waitFor(() => uniquePids.every((pid) => !isProcessAlive(pid)), "worker cleanup", 10_000);
    } finally {
      await proxy?.stop(true);
      if (isProcessAlive(primary.process.pid)) {
        primary.process.kill("SIGKILL");
        await primary.process.exited;
      }
      for (const pid of knownWorkerPids) {
        if (isProcessAlive(pid)) {
          process.kill(pid, "SIGKILL");
        }
      }
      await rm(root, { recursive: true, force: true });
    }
  },
  120_000,
);

function spawnPocketBun(args: string[]) {
  const child = Bun.spawn({
    cmd: [process.execPath, ...args],
    cwd: process.cwd(),
    env: process.env,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });
  return { process: child, output: collectOutput(child) };
}

function collectOutput(child: ReturnType<typeof Bun.spawn>) {
  let stdout = "";
  let stderr = "";
  const waiters: Array<{ text: string; resolve: () => void }> = [];
  const read = async (stream: ReadableStream<Uint8Array>, append: (value: string) => void) => {
    const decoder = new TextDecoder();
    const reader = stream.getReader();
    for (;;) {
      const result = await reader.read();
      if (result.done) {
        return;
      }
      append(decoder.decode(result.value, { stream: true }));
      for (let index = waiters.length - 1; index >= 0; index -= 1) {
        const waiter = waiters[index]!;
        if (stdout.includes(waiter.text)) {
          waiters.splice(index, 1);
          waiter.resolve();
        }
      }
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
    waitFor(text: string): Promise<void> {
      if (stdout.includes(text)) {
        return Promise.resolve();
      }
      return new Promise((resolveWaiter) => {
        waiters.push({ text, resolve: resolveWaiter });
      });
    },
  };
}

async function collectIdentities(url: string, count: number): Promise<Identity[]> {
  const identities = new Map<number, Identity>();
  await waitFor(
    async () => {
      try {
        const identity = await fetchIdentity(url);
        identities.set(identity.slot, identity);
      } catch {
        // A worker may be between exit and replacement.
      }
      return identities.size === count;
    },
    `${count} worker identities`,
    20_000,
  );
  return [...identities.values()];
}

async function waitForReplacement(urls: string[], previous: Identity): Promise<Identity> {
  let replacement: Identity | null = null;
  await waitFor(
    async () => {
      const candidates = process.platform === "linux" ? urls : [urls[previous.slot]!];
      for (const url of candidates) {
        try {
          const identity = await fetchIdentity(url);
          if (identity.slot === previous.slot && identity.pid !== previous.pid) {
            replacement = identity;
            return true;
          }
        } catch {
          // The replacement has not bound its slot yet.
        }
      }
      return false;
    },
    `replacement for slot ${previous.slot}`,
    30_000,
  );
  return replacement!;
}

async function fetchIdentity(url: string): Promise<Identity> {
  const response = await fetch(`${url}/__pocketbun_cluster_test?request=${crypto.randomUUID()}`, {
    headers: { Connection: "close" },
  });
  if (!response.ok) {
    throw new Error(`identity request failed with status ${response.status}`);
  }
  return (await response.json()) as Identity;
}

async function findConsecutivePorts(count: number): Promise<number[]> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const first = 20_000 + Math.floor(Math.random() * (40_000 - count));
    const servers: Array<ReturnType<typeof Bun.serve>> = [];
    try {
      for (let offset = 0; offset < count; offset += 1) {
        servers.push(Bun.serve({ hostname: "127.0.0.1", port: first + offset, fetch: () => new Response("reserved") }));
      }
      await Promise.all(servers.map((server) => server.stop(true)));
      return Array.from({ length: count }, (_, offset) => first + offset);
    } catch {
      await Promise.all(servers.map((server) => server.stop(true)));
    }
  }
  throw new Error(`could not find ${count} consecutive loopback ports`);
}

async function waitFor(check: () => boolean | Promise<boolean>, label: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) {
      return;
    }
    await Bun.sleep(25);
  }
  throw new Error(`${label} timed out after ${timeoutMs}ms`);
}

function withTimeout<T>(promise: Promise<T>, label: string, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    Bun.sleep(timeoutMs).then(() => {
      throw new Error(`${label} timed out after ${timeoutMs}ms`);
    }),
  ]);
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
