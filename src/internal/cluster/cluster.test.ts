// PocketBun-only: exercises the real multi-process CLI lifecycle across the supported Bun platforms.

import { expect, it } from "bun:test";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
      expect(exitCode).toBe(0);
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
  "terminates the cluster when the leader or follower never becomes ready",
  async () => {
    const sourceData = resolve(fileURLToPath(new URL("../../tests/data", import.meta.url)));
    for (const role of ["leader", "follower"] as const) {
      const root = await mkdtemp(join(tmpdir(), `pocketbun-cluster-${role}-crash-loop-`));
      const dataDir = join(root, "pb_data");
      const hooksDir = join(root, "pb_hooks");
      await cp(sourceData, dataDir, { recursive: true });
      await mkdir(hooksDir, { recursive: true });
      await writeFile(
        join(hooksDir, "crash.pb.js"),
        `if (process.env.POCKETBUN_CLUSTER_ROLE === ${JSON.stringify(role)}) process.exit(91);\n`,
      );
      const [port] = await findConsecutivePorts(2);
      const child = spawnPocketBun([
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
        `127.0.0.1:${port}`,
      ]);

      try {
        const exitCode = await withTimeout(child.process.exited, `${role} crash-loop shutdown`, 30_000);
        await child.output.done;
        expect(exitCode).not.toBe(0);
        expect(child.output.stdout).toContain(`${role} workers crashed 5 times within 30 seconds`);
        const readyRoles = [...child.output.stdout.matchAll(/\[cluster\] ready (leader|follower)/g)].map((match) => match[1]);
        expect(readyRoles).toEqual(role === "leader" ? [] : ["leader"]);
        const pids = [...child.output.stdout.matchAll(/pid=(\d+)/g)].map((match) => Number(match[1])).filter((pid) => pid > 0);
        await waitFor(() => pids.every((pid) => !isProcessAlive(pid)), `${role} crash-loop worker cleanup`, 10_000);
        expect(await Bun.file(join(dataDir, LocalClusterGuardFileName)).exists()).toBeFalse();
      } finally {
        if (isProcessAlive(child.process.pid)) {
          child.process.kill("SIGKILL");
          await child.process.exited;
        }
        await rm(root, { recursive: true, force: true });
      }
    }
  },
  90_000,
);

it.serial(
  "replaces workers that send malformed, duplicate, or late IPC messages",
  async () => {
    const root = await mkdtemp(join(tmpdir(), "pocketbun-cluster-ipc-faults-"));
    const dataDir = join(root, "pb_data");
    const hooksDir = join(root, "pb_hooks");
    const markerPath = join(root, "ipc-fault");
    const sourceData = resolve(fileURLToPath(new URL("../../tests/data", import.meta.url)));
    const contextModule = new URL("./context.ts", import.meta.url).href;
    await cp(sourceData, dataDir, { recursive: true });
    await mkdir(hooksDir, { recursive: true });
    await writeFile(
      join(hooksDir, "ipc-faults.pb.js"),
      `const fs = require("node:fs");
const markerPath = ${JSON.stringify(markerPath)};
const contextModule = ${JSON.stringify(contextModule)};

routerAdd("GET", "/__pocketbun_cluster_test", (event) => event.json(200, {
  pid: process.pid,
  role: process.env.POCKETBUN_CLUSTER_ROLE,
  slot: Number(process.env.POCKETBUN_CLUSTER_SLOT),
  workerId: Number(process.env.POCKETBUN_CLUSTER_WORKER_ID),
}));

routerAdd("POST", "/__pocketbun_cluster_ipc_fault/{kind}", async (event) => {
  const cluster = await import(contextModule);
  const kind = event.request.pathValue("kind");
  const workerId = cluster.clusterWorkerId();
  let message;
  if (kind === "malformed") {
    message = { version: 2, kind: "worker.stopped", token: cluster.clusterToken(), workerId };
  } else if (kind === "duplicate-ready") {
    message = {
      version: 1,
      kind: "worker.ready",
      token: cluster.clusterToken(),
      role: cluster.clusterRole(),
      slot: cluster.clusterWorkerSlot(),
      workerId,
      pid: process.pid,
      hostname: "127.0.0.1",
      port: 1,
    };
  } else if (kind === "late-result") {
    message = {
      version: 1,
      kind: "coordinator.delivery-result",
      token: cluster.clusterToken(),
      requestId: "already-completed",
      workerId,
      ok: true,
      value: "late",
    };
  } else {
    return event.json(400, { error: "unknown IPC fault" });
  }

  fs.writeFileSync(markerPath, JSON.stringify({ kind, pid: process.pid }));
  process.send(message);
  return event.noContent(204);
});
`,
    );

    const ports = await findConsecutivePorts(2);
    const address = `127.0.0.1:${ports[0]}`;
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
      address,
    ]);
    const backendUrls = process.platform === "linux" ? [`http://${address}`] : ports.map((port) => `http://127.0.0.1:${port}`);
    const currentIdentities = () =>
      process.platform === "linux"
        ? collectIdentities(backendUrls[0]!, 2)
        : Promise.all(backendUrls.map((url) => fetchIdentity(url)));
    const knownWorkerPids = new Set<number>();

    try {
      await withTimeout(primary.output.waitFor("[cluster] 2 workers"), "IPC-fault cluster startup", 60_000);
      for (const kind of ["malformed", "duplicate-ready", "late-result"] as const) {
        const before = await currentIdentities();
        before.forEach((identity) => knownWorkerPids.add(identity.pid));
        await rm(markerPath, { force: true });
        await fetch(`${backendUrls[0]!}/__pocketbun_cluster_ipc_fault/${kind}`, {
          method: "POST",
          headers: { Connection: "close" },
        }).catch(() => null);
        await waitFor(() => Bun.file(markerPath).exists(), `${kind} IPC marker`, 10_000);
        const injected = JSON.parse(await readFile(markerPath, "utf8")) as { kind: string; pid: number };
        expect(injected.kind).toBe(kind);
        const previous = before.find((identity) => identity.pid === injected.pid)!;
        expect(previous).toBeDefined();
        const replacement = await waitForReplacement(backendUrls, previous);
        knownWorkerPids.add(replacement.pid);
        expect(replacement.role).toBe(previous.role);
        expect(replacement.slot).toBe(previous.slot);
        expect(replacement.pid).not.toBe(previous.pid);
        expect(await currentIdentities()).toHaveLength(2);
      }

      primary.process.kill("SIGTERM");
      await withTimeout(primary.process.exited, "IPC-fault cluster shutdown", 20_000);
      await primary.output.done;
      await waitFor(() => [...knownWorkerPids].every((pid) => !isProcessAlive(pid)), "IPC-fault worker cleanup", 10_000);
    } finally {
      if (isProcessAlive(primary.process.pid)) {
        primary.process.kill("SIGKILL");
        await primary.process.exited;
      }
      for (const pid of knownWorkerPids) {
        if (isProcessAlive(pid)) {
          process.kill(pid, "SIGKILL");
        }
      }
      await withTimeout(primary.output.done, "IPC-fault output cleanup", 10_000).catch(() => {});
      await rm(root, { recursive: true, force: true });
    }
  },
  120_000,
);

it.serial(
  "recovers when the leader dies during migration, after commit, and after readiness",
  async () => {
    const root = await mkdtemp(join(tmpdir(), "pocketbun-cluster-migration-faults-"));
    const dataDir = join(root, "pb_data");
    const hooksDir = join(root, "pb_hooks");
    const migrationsDir = join(root, "pb_migrations");
    const migrationMarker = join(root, "migration-entered");
    const committedMarker = join(root, "migration-committed");
    const readyMarker = join(root, "leader-ready");
    const migrationFile = "9999999999_cluster_migration_fault.js";
    const sourceData = resolve(fileURLToPath(new URL("../../tests/data", import.meta.url)));
    await cp(sourceData, dataDir, { recursive: true });
    await mkdir(hooksDir, { recursive: true });
    await mkdir(migrationsDir, { recursive: true });
    await writeFile(
      join(migrationsDir, migrationFile),
      `const fs = require("node:fs");
const marker = ${JSON.stringify(migrationMarker)};

migrate((app) => {
  app.db().newQuery("CREATE TABLE cluster_migration_fault (id TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)").execute();
  app.db().newQuery("INSERT INTO cluster_migration_fault (id, value) VALUES ('committed', 'yes')").execute();
  if (!fs.existsSync(marker)) {
    fs.writeFileSync(marker, String(process.pid));
    process.exit(91);
  }
});
`,
    );
    await writeFile(
      join(hooksDir, "migration-faults.pb.js"),
      `const fs = require("node:fs");
const committedMarker = ${JSON.stringify(committedMarker)};
const readyMarker = ${JSON.stringify(readyMarker)};
const migrationFile = ${JSON.stringify(migrationFile)};

$app.onServe().bind({
  id: "cluster-migration-after-commit-fault",
  priority: -1000,
  func: (event) => {
    if (process.env.POCKETBUN_CLUSTER_ROLE === "leader" && !fs.existsSync(committedMarker)) {
      fs.writeFileSync(committedMarker, String(process.pid));
      process.exit(92);
    }
    return event.next();
  },
});

routerAdd("GET", "/__pocketbun_cluster_test", (event) => {
  const role = process.env.POCKETBUN_CLUSTER_ROLE;
  if (role === "leader" && !fs.existsSync(readyMarker)) {
    fs.writeFileSync(readyMarker, String(process.pid));
  }
  const state = {};
  $app.db().newQuery(
    "SELECT (SELECT COUNT(*) FROM cluster_migration_fault) AS records, " +
    "(SELECT COUNT(*) FROM _migrations WHERE file = {:file}) AS history"
  ).bind({ file: migrationFile }).one(state);
  return event.json(200, {
    pid: process.pid,
    role,
    slot: Number(process.env.POCKETBUN_CLUSTER_SLOT),
    workerId: Number(process.env.POCKETBUN_CLUSTER_WORKER_ID),
    records: Number(state.records),
    history: Number(state.history),
  });
});
`,
    );

    const ports = await findConsecutivePorts(2);
    const address = `127.0.0.1:${ports[0]}`;
    const primary = spawnPocketBun([
      "bin/pocketbun",
      "--dir",
      dataDir,
      "--hooksDir",
      hooksDir,
      "--migrationsDir",
      migrationsDir,
      "--hooksWatch=false",
      "--hooksPool=1",
      "--workers=2",
      "serve",
      "--http",
      address,
    ]);
    const backendUrls = process.platform === "linux" ? [`http://${address}`] : ports.map((port) => `http://127.0.0.1:${port}`);

    try {
      await withTimeout(primary.output.waitFor("[cluster] 2 workers"), "migration-fault cluster startup", 60_000);
      const identities =
        process.platform === "linux"
          ? await collectIdentities(backendUrls[0]!, 2)
          : await Promise.all(backendUrls.map((url) => fetchIdentity(url)));
      const leader = identities.find((identity) => identity.role === "leader")!;
      const failedInMigration = Number(await readFile(migrationMarker, "utf8"));
      const failedAfterCommit = Number(await readFile(committedMarker, "utf8"));
      const reachedReady = Number(await readFile(readyMarker, "utf8"));

      expect(new Set([failedInMigration, failedAfterCommit, reachedReady]).size).toBe(3);
      expect(leader.pid).toBe(reachedReady);
      expect(primary.output.stdout).toContain("code=91");
      expect(primary.output.stdout).toContain("code=92");
      const readyLeaderPids = [...primary.output.stdout.matchAll(/\[cluster\] ready leader .* pid=(\d+)/g)].map((match) =>
        Number(match[1]),
      );
      expect(readyLeaderPids).not.toContain(failedInMigration);
      expect(readyLeaderPids).not.toContain(failedAfterCommit);
      expect(primary.output.stdout.indexOf("[cluster] ready leader")).toBeLessThan(
        primary.output.stdout.indexOf("[cluster] ready follower"),
      );

      process.kill(leader.pid, "SIGKILL");
      const replacement = await waitForReplacement(backendUrls, leader);
      expect(replacement.role).toBe("leader");
      expect(replacement.pid).not.toBe(reachedReady);

      const stateResponse = await fetch(`${backendUrls[0]!}/__pocketbun_cluster_test?state=${crypto.randomUUID()}`, {
        headers: { Connection: "close" },
      });
      const state = (await stateResponse.json()) as Identity & { records: number; history: number };
      expect(state.records).toBe(1);
      expect(state.history).toBe(1);

      primary.process.kill("SIGTERM");
      await withTimeout(primary.process.exited, "migration-fault cluster shutdown", 20_000);
      await primary.output.done;
      const workerPids = [...primary.output.stdout.matchAll(/pid=(\d+)/g)].map((match) => Number(match[1]));
      await waitFor(() => workerPids.every((pid) => !isProcessAlive(pid)), "migration-fault worker cleanup", 10_000);
    } finally {
      if (isProcessAlive(primary.process.pid)) {
        primary.process.kill("SIGKILL");
        await primary.process.exited;
      }
      await withTimeout(primary.output.done, "migration-fault output cleanup", 10_000).catch(() => {});
      const workerPids = [...primary.output.stdout.matchAll(/pid=(\d+)/g)].map((match) => Number(match[1]));
      for (const pid of workerPids) {
        if (isProcessAlive(pid)) {
          process.kill(pid, "SIGKILL");
        }
      }
      await rm(root, { recursive: true, force: true });
    }
  },
  120_000,
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
  "recovers when the primary dies during coordinated operations",
  async () => {
    const root = await mkdtemp(join(tmpdir(), "pocketbun-cluster-primary-faults-"));
    const dataDir = join(root, "pb_data");
    const hooksDir = join(root, "pb_hooks");
    const armPath = join(root, "coordinator-arm");
    const responsePath = join(root, "coordinator-response");
    const guardPath = join(dataDir, LocalClusterGuardFileName);
    const sourceData = resolve(fileURLToPath(new URL("../../tests/data", import.meta.url)));
    const clusterWorkerModule = new URL("./worker.ts", import.meta.url).href;
    const realtimeModule = new URL("../../apis/realtime.ts", import.meta.url).href;
    await cp(sourceData, dataDir, { recursive: true });
    await mkdir(hooksDir, { recursive: true });
    await writeFile(
      join(hooksDir, "primary-faults.pb.js"),
      `const fs = require("node:fs");
const armPath = ${JSON.stringify(armPath)};
const responsePath = ${JSON.stringify(responsePath)};
const clusterWorkerModule = ${JSON.stringify(clusterWorkerModule)};
const realtimeModule = ${JSON.stringify(realtimeModule)};
const pendingKinds = new Map();
const originalSend = process.send;

process.send = function (...args) {
  const message = args[0];
  if (message && message.kind === "coordinator.request") {
    pendingKinds.set(message.requestId, message.operation.kind);
  }
  return originalSend.apply(process, args);
};

const messageListeners = process.listeners("message");
process.removeAllListeners("message");
process.on("message", (message, ...args) => {
  if (message && message.kind === "coordinator.response") {
    const kind = pendingKinds.get(message.requestId);
    pendingKinds.delete(message.requestId);
    if (kind && fs.existsSync(armPath) && fs.readFileSync(armPath, "utf8") === kind) {
      fs.writeFileSync(responsePath, JSON.stringify({ kind, pid: process.pid, requestId: message.requestId }));
      return;
    }
  }
  for (const listener of messageListeners) {
    listener.call(process, message, ...args);
  }
});

async function runOperation(kind) {
  const cluster = await import(clusterWorkerModule);
  if (kind === "rate-limit.consume") {
    await cluster.consumeClusterRateLimit("primary-fault", "client", 2, 60);
    return;
  }
  if (kind === "realtime.prepare") {
    const realtime = await import(realtimeModule);
    const record = $app.findRecordById("demo1", "imy661ixudk5izi");
    const eventId = crypto.randomUUID();
    await cluster.prepareClusterRealtimeDelete(
      eventId,
      record.collection().id,
      realtime.encodeClusterRealtimeRecord(record),
    );
    await cluster.broadcastClusterRealtimeEvent({ kind: "delete.abort", eventId });
    return;
  }
  if (kind === "oauth2.deliver") {
    await cluster.deliverClusterOAuth2Redirect("missing-client", "127.0.0.1", "{}");
    return;
  }
  if (kind === "backup.acquire") {
    const lease = await cluster.acquireClusterBackupLease("primary-fault.zip");
    if (!lease) throw new Error("backup lease was not acquired");
    await cluster.releaseClusterBackupLease(lease);
    return;
  }
  if (kind === "restore.begin") {
    const lease = await cluster.acquireClusterBackupLease("primary-fault-restore.zip");
    if (!lease) throw new Error("restore lease was not acquired");
    await cluster.beginClusterRestore(lease);
    return;
  }
  throw new Error("unknown operation " + kind);
}

routerAdd("GET", "/__pocketbun_cluster_test", (event) => event.json(200, {
  pid: process.pid,
  role: process.env.POCKETBUN_CLUSTER_ROLE,
  slot: Number(process.env.POCKETBUN_CLUSTER_SLOT),
  workerId: Number(process.env.POCKETBUN_CLUSTER_WORKER_ID),
}));

routerAdd("POST", "/__pocketbun_cluster_operation/{kind}", async (event) => {
  try {
    await runOperation(event.request.pathValue("kind"));
    return event.noContent(204);
  } catch (error) {
    return event.json(500, { error: String(error) });
  }
});
`,
    );

    const operations = ["rate-limit.consume", "realtime.prepare", "oauth2.deliver", "backup.acquire", "restore.begin"] as const;
    const ports = await findConsecutivePorts(2);
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
      "--workers=2",
      "serve",
      "--http",
      address,
    ];
    const backendUrls = process.platform === "linux" ? [`http://${address}`] : ports.map((port) => `http://127.0.0.1:${port}`);
    const startPrimary = async (label: string) => {
      const child = spawnPocketBun(args);
      try {
        await withTimeout(child.output.waitFor("[cluster] 2 workers"), label, 60_000);
        return child;
      } catch (error) {
        throw new Error(
          `${error instanceof Error ? error.message : String(error)}\nstdout:\n${child.output.stdout}\nstderr:\n${child.output.stderr}`,
        );
      }
    };
    const currentIdentities = () =>
      process.platform === "linux"
        ? collectIdentities(backendUrls[0]!, 2)
        : Promise.all(backendUrls.map((url) => fetchIdentity(url)));
    let primary = await startPrimary("primary-fault cluster startup");
    const knownWorkerPids = new Set<number>();

    try {
      for (const operation of operations) {
        const identities = await currentIdentities();
        identities.forEach((identity) => knownWorkerPids.add(identity.pid));
        await rm(responsePath, { force: true });
        await writeFile(armPath, operation);
        const pendingRequest = fetch(`${backendUrls[0]!}/__pocketbun_cluster_operation/${operation}`, {
          method: "POST",
          headers: { Connection: "close" },
        }).catch((error) => error as Error);

        await waitFor(() => Bun.file(responsePath).exists(), `${operation} intercepted response`, 10_000);
        const intercepted = JSON.parse(await readFile(responsePath, "utf8")) as {
          kind: string;
          pid: number;
          requestId: string;
        };
        expect(intercepted.kind).toBe(operation);
        expect(identities.some((identity) => identity.pid === intercepted.pid)).toBeTrue();
        expect(intercepted.requestId).not.toBe("");

        const oldPrimaryPid = primary.process.pid;
        const guardOwner = JSON.parse(await readFile(guardPath, "utf8")) as { pid: number };
        expect(guardOwner.pid).toBe(oldPrimaryPid);
        primary.process.kill("SIGKILL");
        await withTimeout(primary.process.exited, `${operation} primary death`, 5_000);
        await withTimeout(primary.output.done, `${operation} descendant cleanup`, 10_000);
        expect(await withTimeout(pendingRequest, `${operation} request disconnect`, 5_000)).toBeInstanceOf(Error);
        await waitFor(
          () => identities.every((identity) => !isProcessAlive(identity.pid)),
          `${operation} worker cleanup`,
          5_000,
        );

        await rm(armPath, { force: true });
        await rm(responsePath, { force: true });
        primary = await startPrimary(`${operation} stale-guard recovery`);
        const recoveredOwner = JSON.parse(await readFile(guardPath, "utf8")) as { pid: number };
        expect(recoveredOwner.pid).toBe(primary.process.pid);
        expect(recoveredOwner.pid).not.toBe(oldPrimaryPid);
        const recovered = await currentIdentities();
        recovered.forEach((identity) => knownWorkerPids.add(identity.pid));
        expect(recovered).toHaveLength(2);

        const recoveryOperation = operation === "restore.begin" ? "backup.acquire" : operation;
        const recoveryResponse = await fetch(`${backendUrls[0]!}/__pocketbun_cluster_operation/${recoveryOperation}`, {
          method: "POST",
          headers: { Connection: "close" },
        });
        expect(recoveryResponse.status).toBe(204);
      }

      // Bun.spawn().kill() force-terminates Windows children without dispatching
      // their JavaScript signal handlers, so this remains a primary-death case
      // there. POSIX can additionally exercise the graceful final shutdown.
      primary.process.kill(process.platform === "win32" ? "SIGKILL" : "SIGINT");
      await withTimeout(primary.process.exited, "primary-fault cluster shutdown", 20_000);
      await primary.output.done;
      await waitFor(
        () => [...knownWorkerPids].every((pid) => !isProcessAlive(pid)),
        "primary-fault final worker cleanup",
        10_000,
      );
      if (process.platform === "win32") {
        const staleOwner = JSON.parse(await readFile(guardPath, "utf8")) as { pid: number };
        expect(staleOwner.pid).toBe(primary.process.pid);
        expect(isProcessAlive(staleOwner.pid)).toBeFalse();
      } else {
        expect(await Bun.file(guardPath).exists()).toBeFalse();
      }
    } finally {
      if (isProcessAlive(primary.process.pid)) {
        primary.process.kill("SIGKILL");
        await primary.process.exited;
      }
      for (const pid of knownWorkerPids) {
        if (isProcessAlive(pid)) {
          process.kill(pid, "SIGKILL");
        }
      }
      await withTimeout(primary.output.done, "primary-fault output cleanup", 10_000).catch(() => {});
      await rm(root, { recursive: true, force: true });
    }
  },
  180_000,
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
        expect(exitCode).toBe(0);
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
