// PocketBun-only: verifies built-in application state across real Bun cluster workers.

import { Database } from "bun:sqlite";
import { expect, it } from "bun:test";
import { cp, mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { ExtractAsync } from "../../tools/archive/index.ts";

type ClusterState = {
  pid: number;
  role: "leader" | "follower";
  slot: number;
  cronStarted: boolean;
  appName: string;
  dynamic: "missing" | "created" | "updated";
  effects: Record<string, number>;
};

type SSEReader = {
  reader: {
    read(): Promise<{ done: false; value: Uint8Array } | { done: true; value?: undefined }>;
    cancel(reason?: unknown): Promise<void>;
  };
  buffer: string;
};

type SSEEvent = {
  name: string;
  data: string;
};

type PressureSummary = {
  opCount: number;
  rowCount: number;
  checksum: number;
  partialOps: number;
};

const migrationSource = `migrate((app) => {
  const migrationApp = app.forMigrations();

  const effects = newBaseCollection("cluster_effects");
  effects.fields.add(new TextField({ name: "kind", required: true }));
  effects.fields.add(new TextField({ name: "worker", required: true }));
  migrationApp.save(effects);

  const items = newBaseCollection("cluster_items");
  items.listRule = "";
  items.viewRule = "";
  items.createRule = "";
  items.updateRule = "";
  items.deleteRule = "";
  items.fields.add(new TextField({ name: "value" }));
  migrationApp.save(items);

  migrationApp.db().newQuery(
    "CREATE TABLE cluster_pressure (op INTEGER NOT NULL, part INTEGER NOT NULL, value INTEGER NOT NULL, PRIMARY KEY (op, part), CHECK (part IN (1, 2)), CHECK (value = op * 100 + part))",
  ).execute();

  const settings = migrationApp.settings();
  settings.meta.appName = "cluster-before";
  settings.rateLimits.enabled = true;
  settings.rateLimits.rules = [{ label: "GET /__cluster_rate", maxRequests: 2, duration: 60 }];
  settings.backups.cron = "0 0 1 1 *";
  settings.backups.cronMaxKeep = 2;
  migrationApp.save(settings);

  migrationApp.db().newQuery("DELETE FROM _superusers").execute();

  const effect = new Record(effects);
  effect.set("kind", "migration");
  effect.set("worker", String(process.pid));
  migrationApp.save(effect);
});
`;

const hooksSource = `const fs = require("node:fs");
const path = require("node:path");
const transactionCrashMarker = path.join($app.dataDir(), ".cluster-transaction-crash");
const coordinatorDeliveryMarker = path.join($app.dataDir(), ".cluster-coordinator-delivery");
const coordinatorReleaseMarker = path.join($app.dataDir(), ".cluster-coordinator-release");
const coordinatorCompletionMarker = path.join($app.dataDir(), ".cluster-coordinator-completion");
const pressureCrashMarker = path.join($app.dataDir(), ".cluster-pressure-crash");
const autoBackupMarker = path.join($app.dataDir(), ".cluster-auto-backup");

function recordEffect(kind, app = $app) {
  const effect = new Record(app.findCollectionByNameOrId("cluster_effects"));
  effect.set("kind", kind);
  effect.set("worker", String(process.pid));
  app.save(effect);
}

function collectionState() {
  try {
    const collection = $app.findCachedCollectionByNameOrId("cluster_dynamic");
    return collection.listRule === "id != ''" ? "updated" : "created";
  } catch (_) {
    return "missing";
  }
}

function effectCount(kind) {
  return $app.countRecords("cluster_effects", $dbx.hashExp({ kind }));
}

cronAdd("cluster-probe", "0 0 1 1 *", () => recordEffect("cron"));

$app.onServe().bind({
  id: "cluster-state-singletons",
  priority: 1000,
  func: (event) => {
    event.installerFunc = () => {
      recordEffect("installer");
      return null;
    };
    if ($app.cron().HasStarted()) {
      const job = $app.cron().Jobs().find((item) => item.Id() === "cluster-probe");
      if (job) job.Run();
    }
    return event.next();
  },
});

routerUse(new Middleware((event) => {
  event.response.header().set("X-PocketBun-Worker-Pid", String(process.pid));
  const excluded = (event.request.header.get("X-Exclude-Worker-Pids") || "")
    .split(",")
    .map((value) => Number(value.trim()));
  if (excluded.includes(process.pid)) {
    return event.json(409, { pid: process.pid });
  }
  return event.next();
}, -2000, "cluster-state-affinity"));

onMailerRecordPasswordResetSend(() => {
  recordEffect("password-reset");
  return null;
}, "users");

onMailerRecordVerificationSend(() => {
  recordEffect("verification");
  return null;
}, "users");

onBackupCreate(async (event) => {
  if (event.name === "held.zip") await new Promise((resolve) => setTimeout(resolve, 500));
  if (event.name === "crash.zip") await new Promise((resolve) => setTimeout(resolve, 15000));
  let result = null;
  let thrown = null;
  try {
    result = await event.next();
    if (event.name === "held.zip" && result) {
      console.error("[cluster-test] held backup error", result.stack || result.message || String(result));
    }
    return result;
  } catch (error) {
    thrown = error;
    if (event.name === "held.zip") {
      console.error("[cluster-test] held backup threw", error.stack || error.message || String(error));
    }
    throw error;
  } finally {
    if (event.name.startsWith("@auto_pb_backup_")) {
      const error = thrown || result;
      fs.writeFileSync(autoBackupMarker, JSON.stringify({
        name: event.name,
        error: error ? error.stack || error.message || String(error) : "",
      }));
    }
  }
});

onRealtimeSubscribeRequest(async (event) => {
  if (event.subscriptions.includes("cluster_pending") && !fs.existsSync(coordinatorReleaseMarker)) {
    fs.writeFileSync(coordinatorDeliveryMarker, String(process.pid));
    while (!fs.existsSync(coordinatorReleaseMarker)) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }
  const response = await event.next();
  if (event.subscriptions.includes("cluster_pending")) {
    fs.writeFileSync(coordinatorCompletionMarker, String(process.pid));
  }
  return response;
});

routerAdd("GET", "/__cluster_state", (event) => event.json(200, {
  pid: process.pid,
  role: process.env.POCKETBUN_CLUSTER_ROLE,
  slot: Number(process.env.POCKETBUN_CLUSTER_SLOT),
  cronStarted: $app.cron().HasStarted(),
  appName: $app.settings().meta.appName,
  dynamic: collectionState(),
  effects: {
    migration: effectCount("migration"),
    installer: effectCount("installer"),
    cron: effectCount("cron"),
    passwordReset: effectCount("password-reset"),
    verification: effectCount("verification"),
    transactionCrash: effectCount("transaction-crash"),
    transactionCommit: effectCount("transaction-commit"),
  },
}));

routerAdd("GET", "/__cluster_rate", (event) => event.json(200, { pid: process.pid }));

routerAdd("POST", "/__cluster_transaction_crash", (event) => {
  if (fs.existsSync(transactionCrashMarker)) {
    return event.json(409, { error: "transaction crash already injected" });
  }
  $app.runInTransaction((txApp) => {
    recordEffect("transaction-crash", txApp);
    fs.writeFileSync(transactionCrashMarker, String(process.pid));
    process.exit(93);
  });
  return event.json(500, { error: "transaction crash did not exit" });
});

routerAdd("POST", "/__cluster_transaction_commit", (event) => {
  const error = $app.runInTransaction((txApp) => recordEffect("transaction-commit", txApp));
  return event.json(error ? 500 : 200, { error: error ? error.message : "" });
});

routerAdd("POST", "/__cluster_pressure/write", (event) => {
  const op = Number(event.request.url.query().get("op"));
  if (!Number.isSafeInteger(op) || op < 1) {
    return event.json(400, { error: "invalid pressure operation" });
  }
  const error = $app.runInTransaction((txApp) => {
    for (const part of [1, 2]) {
      txApp.db().newQuery(
        "INSERT INTO cluster_pressure (op, part, value) VALUES ({:op}, {:part}, {:value})",
      ).bind({ op, part, value: op * 100 + part }).execute();
    }
  });
  return event.json(error ? 500 : 200, { error: error ? error.message : "", op, pid: process.pid });
});

routerAdd("POST", "/__cluster_pressure/crash", (event) => {
  const op = Number(event.request.url.query().get("op"));
  $app.runInTransaction((txApp) => {
    txApp.db().newQuery(
      "INSERT INTO cluster_pressure (op, part, value) VALUES ({:op}, 1, {:value})",
    ).bind({ op, value: op * 100 + 1 }).execute();
    fs.writeFileSync(pressureCrashMarker, String(process.pid));
    process.exit(94);
  });
  return event.json(500, { error: "pressure crash did not exit" });
});

routerAdd("GET", "/__cluster_pressure/summary", (event) => {
  const result = {};
  $app.db().newQuery(
    "SELECT COUNT(*) AS opCount, COALESCE(SUM(row_count), 0) AS rowCount, COALESCE(SUM(checksum), 0) AS checksum, COALESCE(SUM(CASE WHEN row_count = 2 AND part1 = 1 AND part2 = 1 THEN 0 ELSE 1 END), 0) AS partialOps FROM (SELECT op, COUNT(*) AS row_count, SUM(value) AS checksum, SUM(CASE WHEN part = 1 THEN 1 ELSE 0 END) AS part1, SUM(CASE WHEN part = 2 THEN 1 ELSE 0 END) AS part2 FROM cluster_pressure GROUP BY op)",
  ).one(result);
  return event.json(200, { ...result, pid: process.pid });
});

routerAdd("POST", "/__cluster_pressure/checkpoint", (event) => {
  try {
    const result = {};
    $app.db().newQuery("PRAGMA wal_checkpoint(TRUNCATE)").one(result);
    return event.json(200, { ...result, error: "", pid: process.pid });
  } catch (error) {
    return event.json(200, { error: error.stack || error.message || String(error), pid: process.pid });
  }
});

routerAdd("POST", "/__cluster_pressure/autobackup", (event) => {
  const job = $app.cron().Jobs().find((item) => item.Id() === "__pbAutoBackup__");
  if (!job) return event.json(500, { error: "autobackup job is missing" });
  job.Run();
  return event.noContent(204);
});

routerAdd("GET", "/__cluster_superuser_token", (event) => {
  const superuser = $app.findAuthRecordByEmail("_superusers", "__pbinstaller@example.com");
  return event.json(200, { token: superuser.newAuthToken() });
});

routerAdd("POST", "/__cluster_restart", (event) => {
  setTimeout(() => $app.restart(), 50);
  return event.noContent(204);
});

routerAdd("POST", "/__cluster_restore_direct", async (event) => {
  const name = event.request.url.query().get("name");
  const error = await $app.restoreBackup(null, name);
  return event.json(error ? 400 : 200, { error: error ? error.message : "" });
});

routerAdd("POST", "/__cluster_settings", (event) => {
  const settings = $app.settings();
  settings.meta.appName = event.request.url.query().get("name");
  $app.save(settings);
  return event.json(200, { pid: process.pid });
});

routerAdd("POST", "/__cluster_collection/{action}", async (event) => {
  try {
    const action = event.request.pathValue("action");
    if (action === "create") {
      const collection = newBaseCollection("cluster_dynamic");
      collection.fields.add(new TextField({ name: "value" }));
      $app.save(collection);
    } else if (action === "update") {
      const collection = $app.findCollectionByNameOrId("cluster_dynamic");
      collection.listRule = "id != ''";
      $app.save(collection);
    } else if (action === "delete") {
      const error = await $app.Delete($app.findCollectionByNameOrId("cluster_dynamic"));
      if (error) throw error;
    }
    return event.json(200, { pid: process.pid, action });
  } catch (error) {
    return event.json(500, { error: String(error), stack: error && error.stack });
  }
});

routerAdd("POST", "/__cluster_record/{action}", async (event) => {
  try {
    const action = event.request.pathValue("action");
    const collection = $app.findCollectionByNameOrId("cluster_items");
    if (action === "create") {
      const record = new Record(collection);
      record.id = "clusteritem0001";
      record.set("value", "created");
      $app.save(record);
    } else {
      const record = $app.findRecordById(collection, "clusteritem0001");
      if (action === "update") {
        record.set("value", "updated");
        $app.save(record);
      } else if (action === "delete") {
        const error = await $app.Delete(record);
        if (error) throw error;
      }
    }
    return event.json(200, { pid: process.pid, action });
  } catch (error) {
    return event.json(500, { error: String(error), stack: error && error.stack });
  }
});

routerAdd("POST", "/__cluster_auth_invalidate", (event) => {
  const user = $app.findAuthRecordByEmail("users", "test@example.com");
  user.refreshTokenKey();
  $app.save(user);
  return event.json(200, { pid: process.pid });
});

routerAdd("GET", "/__cluster_auth_token", (event) => {
  const user = $app.findAuthRecordByEmail("users", "test@example.com");
  return event.json(200, { token: user.newAuthToken() });
});

routerAdd("GET", "/__cluster_client_auth", (event) => {
  try {
    const client = $app.SubscriptionsBroker().ClientById(event.request.url.query().get("clientId"));
    const auth = client.Get("auth");
    return event.json(200, { pid: process.pid, authId: auth ? auth.id : "" });
  } catch (_) {
    return event.json(404, { pid: process.pid, authId: "" });
  }
});
`;

it.serial(
  "coordinates singleton work, state, backups, restart, and restore across workers",
  async () => {
    const root = await mkdtemp(join(tmpdir(), "pocketbun-cluster-state-"));
    const dataDir = join(root, "pb_data");
    const hooksDir = join(root, "pb_hooks");
    const migrationsDir = join(root, "pb_migrations");
    const transactionCrashMarker = join(dataDir, ".cluster-transaction-crash");
    const coordinatorDeliveryMarker = join(dataDir, ".cluster-coordinator-delivery");
    const coordinatorReleaseMarker = join(dataDir, ".cluster-coordinator-release");
    const coordinatorCompletionMarker = join(dataDir, ".cluster-coordinator-completion");
    const pressureCrashMarker = join(dataDir, ".cluster-pressure-crash");
    const autoBackupMarker = join(dataDir, ".cluster-auto-backup");
    const sourceData = resolve(fileURLToPath(new URL("../../tests/data", import.meta.url)));
    await cp(sourceData, dataDir, { recursive: true });
    await mkdir(hooksDir, { recursive: true });
    await mkdir(migrationsDir, { recursive: true });
    await writeFile(join(hooksDir, "cluster-state.pb.js"), hooksSource);
    await writeFile(join(migrationsDir, "9999999999_cluster_state.js"), migrationSource);

    const ports = await findConsecutivePorts(3);
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
      "--workers=3",
      "serve",
      "--http",
      address,
    ]);
    const backendUrls = process.platform === "linux" ? [`http://${address}`] : ports.map((port) => `http://127.0.0.1:${port}`);
    const requester = new ClusterRequester(backendUrls);
    const readers: SSEReader[] = [];
    let workerPids: number[] = [];

    try {
      try {
        await withTimeout(
          Promise.race([
            primary.output.waitFor("[cluster] 3 workers"),
            primary.process.exited.then((code) => {
              throw new Error(`cluster state primary exited with code ${code}`);
            }),
          ]),
          "cluster state startup",
          60_000,
        );
      } catch (error) {
        throw new Error(
          `${error instanceof Error ? error.message : String(error)}\nstdout:\n${primary.output.stdout}\nstderr:\n${primary.output.stderr}`,
        );
      }
      let states = await waitForStates(requester, (items) =>
        items.every((state) => state.effects.cron === 1 && state.effects.installer === 1),
      );
      workerPids = states.map((state) => state.pid);
      expect(states.filter((state) => state.role === "leader")).toHaveLength(1);
      expect(states.filter((state) => state.cronStarted)).toHaveLength(1);
      expect(states.every((state) => state.effects.migration === 1)).toBeTrue();
      expect(states.every((state) => state.effects.installer === 1)).toBeTrue();
      expect(states.every((state) => state.effects.cron === 1)).toBeTrue();

      const transactionWorker = states.find((state) => state.slot === 1)!;
      const transactionRequest = requester
        .fetch(
          "/__cluster_transaction_crash",
          { method: "POST" },
          states.filter((state) => state.pid !== transactionWorker.pid).map((state) => state.pid),
        )
        .then(() => null)
        .catch((error) => error as Error);
      await waitFor(() => Bun.file(transactionCrashMarker).exists(), "transaction crash marker", 5_000);
      expect(Number(await Bun.file(transactionCrashMarker).text())).toBe(transactionWorker.pid);
      expect(await withTimeout(transactionRequest, "transaction worker disconnect", 5_000)).toBeInstanceOf(Error);
      states = await waitForStates(requester, (items) =>
        items.every((state) => state.pid !== transactionWorker.pid && state.effects.transactionCrash === 0),
      );
      const transactionReplacement = states.find((state) => state.slot === transactionWorker.slot)!;
      const committedTransaction = await requester.fetch(
        "/__cluster_transaction_commit",
        { method: "POST" },
        states.filter((state) => state.pid !== transactionReplacement.pid).map((state) => state.pid),
      );
      expect(committedTransaction.response.status).toBe(200);
      states = await waitForStates(requester, (items) =>
        items.every((state) => state.effects.transactionCrash === 0 && state.effects.transactionCommit === 1),
      );

      const coordinatorLeader = states.find((state) => state.role === "leader")!;
      const coordinatorStream = await openSSE(
        requester,
        {},
        states.filter((state) => state.pid !== coordinatorLeader.pid).map((state) => state.pid),
      );
      readers.push(coordinatorStream.reader);
      const coordinatorConnect = await readSSE(coordinatorStream.reader, 5_000);
      const coordinatorClientId = (JSON.parse(coordinatorConnect.data) as { clientId: string }).clientId;
      const coordinatorSource = states.find((state) => state.slot === 2)!;
      const pendingCoordinatorRequest = requester
        .fetch(
          "/api/realtime",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ clientId: coordinatorClientId, subscriptions: ["cluster_pending"] }),
          },
          states.filter((state) => state.pid !== coordinatorSource.pid).map((state) => state.pid),
        )
        .then(() => null)
        .catch((error) => error as Error);
      await waitFor(() => Bun.file(coordinatorDeliveryMarker).exists(), "pending coordinator delivery", 5_000);
      expect(Number(await Bun.file(coordinatorDeliveryMarker).text())).toBe(coordinatorLeader.pid);
      process.kill(coordinatorSource.pid, "SIGKILL");
      await waitFor(() => !isProcessAlive(coordinatorSource.pid), "pending coordinator source exit", 2_000);
      await writeFile(coordinatorReleaseMarker, "release");
      expect(await withTimeout(pendingCoordinatorRequest, "pending coordinator source disconnect", 5_000)).toBeInstanceOf(
        Error,
      );
      await waitFor(() => Bun.file(coordinatorCompletionMarker).exists(), "coordinator completion marker", 5_000);
      expect(Number(await Bun.file(coordinatorCompletionMarker).text())).toBe(coordinatorLeader.pid);
      states = await waitForStates(requester, (items) => items.every((state) => state.pid !== coordinatorSource.pid));
      const coordinatorReplacement = states.find((state) => state.slot === coordinatorSource.slot)!;
      const repeatedCoordinatorRequest = await requester.fetch(
        "/api/realtime",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientId: coordinatorClientId, subscriptions: ["cluster_pending"] }),
        },
        states.filter((state) => state.pid !== coordinatorReplacement.pid).map((state) => state.pid),
      );
      expect(repeatedCoordinatorRequest.response.status).toBe(204);
      await coordinatorStream.reader.reader.cancel();
      readers.splice(readers.indexOf(coordinatorStream.reader), 1);
      workerPids = states.map((state) => state.pid);
      await Promise.all(
        [transactionCrashMarker, coordinatorDeliveryMarker, coordinatorReleaseMarker, coordinatorCompletionMarker].map((path) =>
          rm(path, { force: true }),
        ),
      );

      expect((await requester.fetch("/__cluster_settings?name=cluster-after", { method: "POST" })).response.status).toBe(200);
      states = await waitForStates(requester, (items) => items.every((state) => state.appName === "cluster-after"));
      expect(states).toHaveLength(3);

      for (const [action, expected] of [
        ["create", "created"],
        ["update", "updated"],
        ["delete", "missing"],
      ] as const) {
        const result = await requester.fetch(`/__cluster_collection/${action}`, { method: "POST" });
        if (result.response.status !== 200) {
          throw new Error(`cluster collection ${action} failed: ${result.response.status} ${await result.response.text()}`);
        }
        await waitForStates(requester, (items) => items.every((state) => state.dynamic === expected));
      }

      const rateStatuses: number[] = [];
      const rateWorkers: number[] = [];
      for (let index = 0; index < 3; index += 1) {
        const result = await requester.fetch("/__cluster_rate", {}, rateWorkers);
        rateStatuses.push(result.response.status);
        rateWorkers.push(result.pid);
      }
      expect(new Set(rateWorkers).size).toBe(3);
      expect(rateStatuses).toEqual([200, 200, 429]);

      const reset1 = await requester.fetch("/api/collections/users/request-password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "test@example.com" }),
      });
      expect(reset1.response.status).toBe(204);
      const reset2 = await requester.fetch(
        "/api/collections/users/request-password-reset",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "test@example.com" }),
        },
        [reset1.pid],
      );
      expect(reset2.response.status).toBe(204);
      expect(reset2.pid).not.toBe(reset1.pid);

      const verification1 = await requester.fetch("/api/collections/users/request-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "test@example.com" }),
      });
      expect(verification1.response.status).toBe(204);
      const verification2 = await requester.fetch(
        "/api/collections/users/request-verification",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "test@example.com" }),
        },
        [verification1.pid],
      );
      expect(verification2.response.status).toBe(204);
      expect(verification2.pid).not.toBe(verification1.pid);
      await waitForStates(requester, (items) =>
        items.every((state) => state.effects.passwordReset === 1 && state.effects.verification === 1),
      );

      const tokenResult = await requester.fetch("/__cluster_auth_token");
      const token = ((await tokenResult.response.json()) as { token: string }).token;
      const recordStream = await openSSE(requester, { Authorization: token });
      readers.push(recordStream.reader);
      const recordConnect = await readSSE(recordStream.reader, 5_000);
      expect(recordConnect.name).toBe("PB_CONNECT");
      const recordClientId = (JSON.parse(recordConnect.data) as { clientId: string }).clientId;
      const recordSubscribe = await requester.fetch(
        "/api/realtime",
        {
          method: "POST",
          headers: { Authorization: token, "Content-Type": "application/json" },
          body: JSON.stringify({ clientId: recordClientId, subscriptions: ["cluster_items/*"] }),
        },
        [recordStream.pid],
      );
      expect(recordSubscribe.response.status).toBe(204);
      expect(recordSubscribe.pid).not.toBe(recordStream.pid);

      for (const action of ["create", "update", "delete"] as const) {
        const mutation = await requester.fetch(`/__cluster_record/${action}`, { method: "POST" }, [recordStream.pid]);
        if (mutation.response.status !== 200) {
          throw new Error(`cluster record ${action} failed: ${mutation.response.status} ${await mutation.response.text()}`);
        }
        expect(mutation.pid).not.toBe(recordStream.pid);
        const event = await readSSE(recordStream.reader, 5_000);
        const data = JSON.parse(event.data) as { action: string; record: { value?: string } };
        expect(data.action).toBe(action);
        if (action !== "delete") {
          expect(data.record.value).toBe(action === "create" ? "created" : "updated");
        }
      }
      await expectNoSSEEvent(recordStream.reader, 150);

      const invalidate = await requester.fetch("/__cluster_auth_invalidate", { method: "POST" }, [recordStream.pid]);
      expect(invalidate.pid).not.toBe(recordStream.pid);
      await waitFor(
        async () => {
          const excluded = workerPids.filter((pid) => pid !== recordStream.pid);
          const result = await requester.fetch(
            `/__cluster_client_auth?clientId=${encodeURIComponent(recordClientId)}`,
            {},
            excluded,
          );
          if (result.response.status !== 200) {
            return false;
          }
          return ((await result.response.json()) as { authId: string }).authId === "";
        },
        "cross-worker auth invalidation",
        10_000,
      );

      const oauthStream = await openSSE(requester);
      readers.push(oauthStream.reader);
      const oauthConnect = await readSSE(oauthStream.reader, 5_000);
      const oauthClientId = (JSON.parse(oauthConnect.data) as { clientId: string }).clientId;
      const oauthSubscribe = await requester.fetch(
        "/api/realtime",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientId: oauthClientId, subscriptions: ["@oauth2"] }),
        },
        [oauthStream.pid],
      );
      expect(oauthSubscribe.response.status).toBe(204);
      expect(oauthSubscribe.pid).not.toBe(oauthStream.pid);

      const oauthBody = new URLSearchParams({
        state: oauthClientId,
        code: "cluster-apple-code",
        user: JSON.stringify({ name: { firstName: "Cluster", lastName: "User" } }),
      });
      const redirect = await requester.fetch(
        "/api/oauth2-redirect",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: oauthBody,
          redirect: "manual",
        },
        [oauthStream.pid],
      );
      expect(redirect.pid).not.toBe(oauthStream.pid);
      expect(redirect.response.status).toBe(303);
      expect(redirect.response.headers.get("Location")).toContain("oauth2-redirect-success");
      const oauthEvent = await readSSE(oauthStream.reader, 5_000);
      expect(oauthEvent.name).toBe("@oauth2");
      expect(JSON.parse(oauthEvent.data)).toMatchObject({ state: oauthClientId, code: "cluster-apple-code" });
      await expectNoSSEEvent(oauthStream.reader, 150);

      for (const stream of readers) {
        await stream.reader.cancel();
      }
      readers.length = 0;
      states = await waitForStates(requester, (items) =>
        items.every(
          (state) =>
            state.effects.migration === 1 &&
            state.effects.installer === 1 &&
            state.effects.cron === 1 &&
            state.effects.passwordReset === 1 &&
            state.effects.verification === 1,
        ),
      );
      expect(states).toHaveLength(3);

      const interruptedStream = await openNodeSSE(backendUrls[0]!);
      readers.push(interruptedStream.reader);
      const interruptedConnect = await readSSE(interruptedStream.reader, 5_000);
      const interruptedClientId = (JSON.parse(interruptedConnect.data) as { clientId: string }).clientId;
      expect(
        (
          await requester.fetch(
            "/api/realtime",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ clientId: interruptedClientId, subscriptions: ["cluster_items/*"] }),
            },
            [interruptedStream.pid],
          )
        ).response.status,
      ).toBe(204);
      process.kill(interruptedStream.pid, "SIGKILL");
      await expectSSEDisconnect(interruptedStream.reader, 10_000);
      states = await waitForStates(requester, (items) => items.every((state) => state.pid !== interruptedStream.pid));

      const reconnectedStream = await openNodeSSE(backendUrls[0]!);
      readers.push(reconnectedStream.reader);
      expect(reconnectedStream.pid).not.toBe(interruptedStream.pid);
      const reconnectedConnect = await readSSE(reconnectedStream.reader, 5_000);
      const reconnectedClientId = (JSON.parse(reconnectedConnect.data) as { clientId: string }).clientId;
      expect(
        (
          await requester.fetch(
            "/api/realtime",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ clientId: reconnectedClientId, subscriptions: ["cluster_items/*"] }),
            },
            [reconnectedStream.pid],
          )
        ).response.status,
      ).toBe(204);
      const reconnectedMutation = await requester.fetch("/__cluster_record/create", { method: "POST" }, [
        reconnectedStream.pid,
      ]);
      expect(reconnectedMutation.response.status).toBe(200);
      expect(reconnectedMutation.pid).not.toBe(reconnectedStream.pid);
      const reconnectedEvent = await readSSE(reconnectedStream.reader, 5_000);
      expect(JSON.parse(reconnectedEvent.data)).toMatchObject({
        action: "create",
        record: { value: "created" },
      });
      await reconnectedStream.reader.reader.cancel();
      readers.splice(readers.indexOf(reconnectedStream.reader), 1);

      const superuserTokenResult = await requester.fetch("/__cluster_superuser_token");
      const superuserToken = ((await superuserTokenResult.response.json()) as { token: string }).token;
      const superuserHeaders = { Authorization: superuserToken, "Content-Type": "application/json" };

      const collectionUpdateWorker = states.find((state) => state.role === "follower")!;
      const collectionUpdate = await requester.fetch(
        "/api/collections/cluster_items",
        {
          method: "PATCH",
          headers: superuserHeaders,
          body: JSON.stringify({ listRule: "id != ''", indexes: [] }),
        },
        states.filter((state) => state.pid !== collectionUpdateWorker.pid).map((state) => state.pid),
      );
      if (collectionUpdate.response.status !== 200) {
        throw new Error(
          `public collection update returned ${collectionUpdate.response.status}: ${await collectionUpdate.response.text()}`,
        );
      }
      await waitFor(
        async () => {
          for (const state of states) {
            const result = await requester.fetch(
              "/api/collections/cluster_items",
              { headers: { Authorization: superuserToken } },
              states.filter((candidate) => candidate.pid !== state.pid).map((candidate) => candidate.pid),
            );
            if (result.response.status !== 200) {
              return false;
            }
            const collection = (await result.response.json()) as { listRule?: unknown };
            if (collection.listRule !== "id != ''") {
              return false;
            }
          }
          return true;
        },
        "public collection update convergence",
        5_000,
      );

      const backupWorker = states[0]!.pid;
      const heldBackup = requester.fetch(
        "/api/backups",
        {
          method: "POST",
          headers: superuserHeaders,
          body: JSON.stringify({ name: "held.zip" }),
        },
        states.filter((state) => state.pid !== backupWorker).map((state) => state.pid),
      );
      await waitFor(
        async () => {
          const health = await requester.fetch("/api/health", { headers: { Authorization: superuserToken } }, [backupWorker]);
          const body = (await health.response.json()) as { data: { canBackup: boolean } };
          return body.data.canBackup === false;
        },
        "cluster backup lease visibility",
        5_000,
      );

      const pressureSequence = { next: 1 };
      const committedPressure = new Set<number>();
      const pressureCheckpointErrors: string[] = [];
      const heldBackupResult = await withTimeout(
        runWithPressure(requester, states, pressureSequence, committedPressure, pressureCheckpointErrors, async () => {
          const overlappingBackup = await requester.fetch(
            "/api/backups",
            {
              method: "POST",
              headers: superuserHeaders,
              body: JSON.stringify({ name: "overlap.zip" }),
            },
            [backupWorker],
          );
          expect(overlappingBackup.response.status).toBe(400);
          const activeDelete = await requester.fetch(
            "/api/backups/held.zip",
            { method: "DELETE", headers: { Authorization: superuserToken } },
            [backupWorker],
          );
          expect(activeDelete.response.status).toBe(400);
          expect(
            (await requester.fetch("/__cluster_settings?name=backup-write", { method: "POST" }, [backupWorker])).response
              .status,
          ).toBe(200);
          return heldBackup;
        }),
        "manual backup under SQLite pressure",
        30_000,
      );
      if (heldBackupResult.response.status !== 204) {
        throw new Error(
          `held backup returned ${heldBackupResult.response.status}: ${await heldBackupResult.response.text()}\nstdout:\n${primary.output.stdout}\nstderr:\n${primary.output.stderr}`,
        );
      }

      await waitFor(
        async () => {
          const health = await requester.fetch("/api/health", { headers: { Authorization: superuserToken } });
          const body = (await health.response.json()) as { data: { canBackup: boolean } };
          return body.data.canBackup === true;
        },
        "cluster backup lease release",
        5_000,
      );

      const heldSnapshot = await inspectPressureBackup(join(dataDir, "backups", "held.zip"), join(root, "held-extracted"));
      expect(heldSnapshot.opCount).toBeGreaterThan(0);
      expect(heldSnapshot.opCount).toBeLessThanOrEqual(committedPressure.size);
      expect(heldSnapshot.partialOps).toBe(0);
      expect(heldSnapshot.rowCount).toBe(heldSnapshot.opCount * 2);

      await rm(autoBackupMarker, { force: true });
      const autoBackup = await withTimeout(
        runWithPressure(requester, states, pressureSequence, committedPressure, pressureCheckpointErrors, async () => {
          const leader = states.find((state) => state.role === "leader")!;
          const trigger = await requester.fetch(
            "/__cluster_pressure/autobackup",
            { method: "POST" },
            states.filter((state) => state.pid !== leader.pid).map((state) => state.pid),
          );
          expect(trigger.response.status).toBe(204);
          await waitFor(() => Bun.file(autoBackupMarker).exists(), "autobackup completion", 20_000);
          return JSON.parse(await Bun.file(autoBackupMarker).text()) as { name: string; error: string };
        }),
        "autobackup under SQLite pressure",
        30_000,
      );
      expect(autoBackup.error).toBe("");
      expect((await readdir(join(dataDir, "backups"))).includes(autoBackup.name)).toBeTrue();
      const autoSnapshot = await inspectPressureBackup(join(dataDir, "backups", autoBackup.name), join(root, "auto-extracted"));
      expect(autoSnapshot.opCount).toBeGreaterThan(0);
      expect(autoSnapshot.opCount).toBeLessThanOrEqual(committedPressure.size);
      expect(autoSnapshot.partialOps).toBe(0);
      expect(autoSnapshot.rowCount).toBe(autoSnapshot.opCount * 2);

      states = await waitForStates(requester, () => true);
      const pressureCrashWorker = states.find((state) => state.role === "leader")!;
      const pressureCrashOp = 9_000_000;
      const pressureCrash = requester
        .fetch(
          `/__cluster_pressure/crash?op=${pressureCrashOp}`,
          { method: "POST" },
          states.filter((state) => state.pid !== pressureCrashWorker.pid).map((state) => state.pid),
        )
        .then(() => null)
        .catch((error) => error as Error);
      await waitFor(() => Bun.file(pressureCrashMarker).exists(), "pressure transaction crash", 5_000);
      expect(Number(await Bun.file(pressureCrashMarker).text())).toBe(pressureCrashWorker.pid);
      expect(await withTimeout(pressureCrash, "pressure writer disconnect", 5_000)).toBeInstanceOf(Error);
      states = await waitForStates(requester, (items) => items.every((state) => state.pid !== pressureCrashWorker.pid));
      for (const state of states) {
        const op = pressureSequence.next++;
        const write = await requester.fetch(
          `/__cluster_pressure/write?op=${op}`,
          { method: "POST" },
          states.filter((candidate) => candidate.pid !== state.pid).map((candidate) => candidate.pid),
        );
        expect(write.response.status).toBe(200);
        expect(write.pid).toBe(state.pid);
        committedPressure.add(op);
      }
      for (const state of states) {
        const checkpoint = await requester.fetch(
          "/__cluster_pressure/checkpoint",
          { method: "POST" },
          states.filter((candidate) => candidate.pid !== state.pid).map((candidate) => candidate.pid),
        );
        expect(checkpoint.response.status).toBe(200);
        const body = (await checkpoint.response.json()) as { error?: string };
        expect(body.error ?? "").toBe("");
      }
      const expectedPressure = expectedPressureSummary(committedPressure);
      for (const state of states) {
        const summary = await readPressureSummary(
          requester,
          states.filter((candidate) => candidate.pid !== state.pid).map((candidate) => candidate.pid),
        );
        expect(summary.pid).toBe(state.pid);
        expect(summary.value).toEqual(expectedPressure);
      }

      const leaseOwner = states.find((state) => state.role === "follower")!;
      const crashedBackup = requester
        .fetch(
          "/api/backups",
          {
            method: "POST",
            headers: superuserHeaders,
            body: JSON.stringify({ name: "crash.zip" }),
          },
          states.filter((state) => state.pid !== leaseOwner.pid).map((state) => state.pid),
        )
        .catch(() => null);
      await waitFor(
        async () => {
          const health = await requester.fetch("/api/health", { headers: { Authorization: superuserToken } }, [leaseOwner.pid]);
          const body = (await health.response.json()) as { data: { canBackup: boolean } };
          return body.data.canBackup === false;
        },
        "crashed worker backup lease",
        10_000,
      );
      process.kill(leaseOwner.pid, "SIGKILL");
      await crashedBackup;
      states = await waitForStates(requester, (items) => items.every((state) => state.pid !== leaseOwner.pid));
      await waitFor(
        async () => {
          for (const target of states) {
            const health = await requester.fetch(
              "/api/health",
              { headers: { Authorization: superuserToken } },
              states.filter((state) => state.pid !== target.pid).map((state) => state.pid),
            );
            const body = (await health.response.json()) as { data: { canBackup: boolean } };
            if (health.pid !== target.pid || !body.data.canBackup) {
              return false;
            }
          }
          return true;
        },
        "crashed worker backup state convergence",
        5_000,
      );

      expect((await requester.fetch("/__cluster_settings?name=backup-snapshot", { method: "POST" })).response.status).toBe(200);
      await waitForStates(requester, (items) => items.every((state) => state.appName === "backup-snapshot"));
      const backupTarget = states.find((state) => state.role === "leader")!;
      const excludedBackupPids = states.filter((state) => state.pid !== backupTarget.pid).map((state) => state.pid);
      const backupDeadline = Date.now() + 10_000;
      let knownBackupFailure = "";
      while (Date.now() < backupDeadline) {
        const knownBackup = await requester.fetch(
          "/api/backups",
          {
            method: "POST",
            headers: superuserHeaders,
            body: JSON.stringify({ name: "known.zip" }),
          },
          excludedBackupPids,
        );
        if (knownBackup.response.status === 204) {
          knownBackupFailure = "";
          break;
        }
        knownBackupFailure = `${knownBackup.response.status} ${await knownBackup.response.text()}`;
        await Bun.sleep(100);
      }
      if (knownBackupFailure !== "") {
        throw new Error(`known backup did not recover after worker death: ${knownBackupFailure}`);
      }

      await writeFile(join(dataDir, "backups", "invalid.zip"), "not a zip archive");
      const failedRestore = await requester.fetch("/__cluster_restore_direct?name=invalid.zip", { method: "POST" });
      expect(failedRestore.response.status).toBe(400);
      expect((await waitForStates(requester, () => true)).map((state) => state.pid).sort((a, b) => a - b)).toEqual(
        states.map((state) => state.pid).sort((a, b) => a - b),
      );

      expect((await requester.fetch("/__cluster_settings?name=after-backup", { method: "POST" })).response.status).toBe(200);
      states = await waitForStates(requester, (items) => items.every((state) => state.appName === "after-backup"));
      const beforeRestart = new Set(states.map((state) => state.pid));
      expect((await requester.fetch("/__cluster_restart", { method: "POST" })).response.status).toBe(204);
      states = await waitForStates(requester, (items) => items.every((state) => !beforeRestart.has(state.pid)));
      expect(states.every((state) => state.appName === "after-backup")).toBeTrue();
      expect((await requester.fetch("/__cluster_rate")).response.status).toBe(200);

      const beforeRestore = new Set(states.map((state) => state.pid));
      if (process.platform === "win32") {
        const unsupported = await requester.fetch("/__cluster_restore_direct?name=known.zip", { method: "POST" });
        expect(unsupported.response.status).toBe(400);
        states = await waitForStates(requester, (items) => items.every((state) => beforeRestore.has(state.pid)));
        expect(states.every((state) => state.appName === "after-backup")).toBeTrue();
      } else {
        const restore = await requester.fetch("/api/backups/known.zip/restore", {
          method: "POST",
          headers: { Authorization: superuserToken },
        });
        expect(restore.response.status).toBe(204);
        states = await waitForStates(requester, (items) =>
          items.every((state) => !beforeRestore.has(state.pid) && state.appName === "backup-snapshot"),
        );
      }
      expect(states).toHaveLength(3);
      for (const state of states) {
        const summary = await readPressureSummary(
          requester,
          states.filter((candidate) => candidate.pid !== state.pid).map((candidate) => candidate.pid),
        );
        expect(summary.pid).toBe(state.pid);
        expect(summary.value).toEqual(expectedPressure);
      }

      primary.process.kill("SIGTERM");
      const exitCode = await withTimeout(primary.process.exited, "cluster state shutdown", 20_000);
      await primary.output.done;
      if (process.platform !== "win32") {
        expect(exitCode).toBe(0);
      }
      expect(`${primary.output.stdout}\n${primary.output.stderr}`).not.toMatch(
        /SQLITE_(?:BUSY|LOCKED)|database is (?:busy|locked)|Failed to (?:write log|run periodic PRAGMA wal_checkpoint)/i,
      );
    } finally {
      for (const stream of readers) {
        await stream.reader.cancel().catch(() => {});
      }
      if (isProcessAlive(primary.process.pid)) {
        primary.process.kill("SIGKILL");
        await primary.process.exited;
      }
      await withTimeout(primary.output.done, "cluster state output shutdown", 20_000);
      await rm(root, { recursive: true, force: true });
    }
  },
  120_000,
);

class ClusterRequester {
  private next = 0;

  constructor(private readonly urls: string[]) {}

  async fetch(path: string, init: RequestInit = {}, excludedPids: number[] = []): Promise<{ response: Response; pid: number }> {
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      const base = this.urls[this.next++ % this.urls.length]!;
      const headers = new Headers(init.headers);
      headers.set("Connection", "close");
      if (excludedPids.length > 0) {
        headers.set("X-Exclude-Worker-Pids", excludedPids.join(","));
      }
      const response = await fetch(`${base}${path}`, { ...init, headers });
      const pid = Number(response.headers.get("X-PocketBun-Worker-Pid"));
      if (response.status !== 409) {
        return { response, pid };
      }
      await Bun.sleep(10);
    }
    throw new Error(`request ${path} could not reach a non-excluded worker`);
  }
}

async function runWithPressure<T>(
  requester: ClusterRequester,
  states: ClusterState[],
  sequence: { next: number },
  committed: Set<number>,
  checkpointErrors: string[],
  operation: () => Promise<T>,
): Promise<T> {
  const control = { stop: false };
  const target = (pid: number) => states.filter((state) => state.pid !== pid).map((state) => state.pid);
  const writers = states.map(async (state) => {
    while (!control.stop) {
      const op = sequence.next++;
      const result = await requester.fetch(`/__cluster_pressure/write?op=${op}`, { method: "POST" }, target(state.pid));
      if (result.response.status !== 200 || result.pid !== state.pid) {
        throw new Error(
          `pressure write ${op} failed on ${state.pid}: ${result.response.status} ${await result.response.text()}`,
        );
      }
      committed.add(op);
      await Bun.sleep(5);
    }
  });
  const reader = (async () => {
    let index = 0;
    while (!control.stop) {
      const state = states[index++ % states.length]!;
      const summary = await readPressureSummary(requester, target(state.pid));
      if (summary.pid !== state.pid || summary.value.partialOps !== 0 || summary.value.rowCount !== summary.value.opCount * 2) {
        throw new Error(`invalid pressure read from ${state.pid}: ${JSON.stringify(summary)}`);
      }
      await Bun.sleep(10);
    }
  })();
  const checkpointer = (async () => {
    let index = 0;
    while (!control.stop) {
      const state = states[index++ % states.length]!;
      const result = await requester.fetch("/__cluster_pressure/checkpoint", { method: "POST" }, target(state.pid));
      if (result.response.status !== 200 || result.pid !== state.pid) {
        throw new Error(
          `pressure checkpoint failed on ${state.pid}: ${result.response.status} ${await result.response.text()}`,
        );
      }
      const body = (await result.response.json()) as { error?: string };
      if (body.error) {
        if (!/locked|busy/i.test(body.error)) {
          throw new Error(`unexpected pressure checkpoint error on ${state.pid}: ${body.error}`);
        }
        checkpointErrors.push(body.error);
      }
      await Bun.sleep(50);
    }
  })();

  let backgroundError: unknown;
  const background = Promise.all([...writers, reader, checkpointer]).catch((error) => {
    backgroundError = error;
    control.stop = true;
  });
  await waitFor(() => committed.size >= states.length * 2 || backgroundError !== undefined, "pressure writers", 10_000);

  let result!: T;
  let operationError: unknown;
  let operationFailed = false;
  try {
    result = await operation();
  } catch (error) {
    operationError = error;
    operationFailed = true;
  }
  control.stop = true;
  await background;
  if (backgroundError) {
    throw backgroundError;
  }
  if (operationFailed) {
    throw operationError;
  }
  return result;
}

async function readPressureSummary(
  requester: ClusterRequester,
  excludedPids: number[] = [],
): Promise<{ pid: number; value: PressureSummary }> {
  const result = await requester.fetch("/__cluster_pressure/summary", {}, excludedPids);
  if (result.response.status !== 200) {
    throw new Error(`pressure summary failed: ${result.response.status} ${await result.response.text()}`);
  }
  const body = (await result.response.json()) as PressureSummary & { pid: number };
  return {
    pid: result.pid,
    value: {
      opCount: Number(body.opCount),
      rowCount: Number(body.rowCount),
      checksum: Number(body.checksum),
      partialOps: Number(body.partialOps),
    },
  };
}

function expectedPressureSummary(committed: Set<number>): PressureSummary {
  let checksum = 0;
  for (const op of committed) {
    checksum += op * 200 + 3;
  }
  return { opCount: committed.size, rowCount: committed.size * 2, checksum, partialOps: 0 };
}

async function inspectPressureBackup(archivePath: string, outputDir: string): Promise<PressureSummary> {
  await rm(outputDir, { recursive: true, force: true });
  await ExtractAsync(archivePath, outputDir);
  const db = new Database(join(outputDir, "data.db"));
  try {
    const integrity = db.query("PRAGMA integrity_check").get() as { integrity_check?: string } | null;
    expect(integrity?.integrity_check).toBe("ok");
    return normalizePressureSummary(
      db
        .query(
          "SELECT COUNT(*) AS opCount, COALESCE(SUM(row_count), 0) AS rowCount, COALESCE(SUM(checksum), 0) AS checksum, COALESCE(SUM(CASE WHEN row_count = 2 AND part1 = 1 AND part2 = 1 THEN 0 ELSE 1 END), 0) AS partialOps FROM (SELECT op, COUNT(*) AS row_count, SUM(value) AS checksum, SUM(CASE WHEN part = 1 THEN 1 ELSE 0 END) AS part1, SUM(CASE WHEN part = 2 THEN 1 ELSE 0 END) AS part2 FROM cluster_pressure GROUP BY op)",
        )
        .get() as PressureSummary,
    );
  } finally {
    db.close();
  }
}

function normalizePressureSummary(value: PressureSummary): PressureSummary {
  return {
    opCount: Number(value.opCount),
    rowCount: Number(value.rowCount),
    checksum: Number(value.checksum),
    partialOps: Number(value.partialOps),
  };
}

async function openSSE(
  requester: ClusterRequester,
  headers: Record<string, string> = {},
  excludedPids: number[] = [],
): Promise<{ reader: SSEReader; pid: number }> {
  const result = await requester.fetch("/api/realtime", { headers }, excludedPids);
  if (!result.response.ok || !result.response.body) {
    throw new Error(`SSE connection failed with status ${result.response.status}`);
  }
  return {
    pid: result.pid,
    reader: { reader: result.response.body.getReader(), buffer: "" },
  };
}

function openNodeSSE(baseUrl: string): Promise<{ reader: SSEReader; pid: number }> {
  return new Promise((resolve, reject) => {
    const request = httpRequest(`${baseUrl}/api/realtime`, { headers: { Connection: "close" } }, (response) => {
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`SSE connection failed with status ${response.statusCode ?? 0}`));
        return;
      }

      resolve({
        pid: Number(response.headers["x-pocketbun-worker-pid"]),
        reader: {
          buffer: "",
          reader: Readable.toWeb(response).getReader() as SSEReader["reader"],
        },
      });
    });
    request.once("error", reject);
    request.end();
  });
}

async function readSSE(stream: SSEReader, timeoutMs: number): Promise<SSEEvent> {
  const deadline = Date.now() + timeoutMs;
  const decoder = new TextDecoder();
  while (Date.now() < deadline) {
    const separator = stream.buffer.indexOf("\n\n");
    if (separator >= 0) {
      const block = stream.buffer.slice(0, separator);
      stream.buffer = stream.buffer.slice(separator + 2);
      const event = parseSSEBlock(block);
      if (event) {
        return event;
      }
      continue;
    }
    const remaining = deadline - Date.now();
    const result = await Promise.race([
      stream.reader.read(),
      Bun.sleep(remaining).then(() => {
        throw new Error(`SSE event timed out after ${timeoutMs}ms`);
      }),
    ]);
    if (result.done) {
      throw new Error("SSE stream closed before the expected event");
    }
    stream.buffer += decoder.decode(result.value, { stream: true }).replaceAll("\r\n", "\n");
  }
  throw new Error(`SSE event timed out after ${timeoutMs}ms`);
}

function parseSSEBlock(block: string): SSEEvent | null {
  let name = "";
  const data: string[] = [];
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) {
      name = line.slice("event:".length);
    } else if (line.startsWith("data:")) {
      data.push(line.slice("data:".length));
    }
  }
  return name ? { name, data: data.join("\n") } : null;
}

async function expectNoSSEEvent(stream: SSEReader, timeoutMs: number): Promise<void> {
  try {
    const event = await readSSE(stream, timeoutMs);
    throw new Error(`Unexpected duplicate SSE event ${event.name}: ${event.data}`);
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("SSE event timed out")) {
      throw error;
    }
  }
}

async function expectSSEDisconnect(stream: SSEReader, timeoutMs: number): Promise<void> {
  await withTimeout(
    (async () => {
      try {
        for (;;) {
          if ((await stream.reader.read()).done) {
            return;
          }
        }
      } catch {
        // A killed worker may close cleanly or reset the socket.
      }
    })(),
    "SSE worker disconnect",
    timeoutMs,
  );
}

async function waitForStates(
  requester: ClusterRequester,
  predicate: (states: ClusterState[]) => boolean,
): Promise<ClusterState[]> {
  let latest: ClusterState[] = [];
  await waitFor(
    async () => {
      const states = new Map<number, ClusterState>();
      for (let attempt = 0; attempt < 30 && states.size < 3; attempt += 1) {
        try {
          const result = await requester.fetch(`/__cluster_state?request=${crypto.randomUUID()}`);
          if (result.response.ok) {
            const state = (await result.response.json()) as ClusterState;
            states.set(state.pid, state);
          }
        } catch {
          // A worker may be between startup and cache reload.
        }
      }
      latest = [...states.values()];
      return latest.length === 3 && predicate(latest);
    },
    "three converged cluster states",
    20_000,
  );
  return latest;
}

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
      return new Promise((resolve) => waiters.push({ text, resolve }));
    },
  };
}

async function findConsecutivePorts(count: number): Promise<number[]> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const first = 10_000 + Math.floor(Math.random() * (10_000 - count));
    const ports = Array.from({ length: count }, (_, offset) => first + offset);
    const probes: Array<ReturnType<typeof Bun.serve>> = [];
    try {
      for (const port of ports) {
        probes.push(Bun.serve({ hostname: "127.0.0.1", port, fetch: () => new Response(null, { status: 204 }) }));
      }
      return ports;
    } catch {
      // Try another range when a local service or platform reservation owns one of the ports.
    } finally {
      for (const probe of probes) {
        await probe.stop(true);
      }
    }
  }
  throw new Error(`could not reserve ${count} consecutive cluster test ports`);
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
