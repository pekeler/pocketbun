// PocketBun-only: verifies built-in application state across real Bun cluster workers.

import { expect, it } from "bun:test";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

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

  const settings = migrationApp.settings();
  settings.meta.appName = "cluster-before";
  settings.rateLimits.enabled = true;
  settings.rateLimits.rules = [{ label: "GET /__cluster_rate", maxRequests: 2, duration: 60 }];
  migrationApp.save(settings);

  migrationApp.db().newQuery("DELETE FROM _superusers").execute();

  const effect = new Record(effects);
  effect.set("kind", "migration");
  effect.set("worker", String(process.pid));
  migrationApp.save(effect);
});
`;

const hooksSource = `function recordEffect(kind) {
  const effect = new Record($app.findCollectionByNameOrId("cluster_effects"));
  effect.set("kind", kind);
  effect.set("worker", String(process.pid));
  $app.save(effect);
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
  return event.next();
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
  },
}));

routerAdd("GET", "/__cluster_rate", (event) => event.json(200, { pid: process.pid }));

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
        (await requester.fetch("/__cluster_settings?name=backup-write", { method: "POST" }, [backupWorker])).response.status,
      ).toBe(200);
      expect((await heldBackup).response.status).toBe(204);

      await waitFor(
        async () => {
          const health = await requester.fetch("/api/health", { headers: { Authorization: superuserToken } });
          const body = (await health.response.json()) as { data: { canBackup: boolean } };
          return body.data.canBackup === true;
        },
        "cluster backup lease release",
        5_000,
      );

      states = await waitForStates(requester, () => true);
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
      const knownBackup = await requester.fetch("/api/backups", {
        method: "POST",
        headers: superuserHeaders,
        body: JSON.stringify({ name: "known.zip" }),
      });
      if (knownBackup.response.status !== 204) {
        throw new Error(`known backup failed: ${knownBackup.response.status} ${await knownBackup.response.text()}`);
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

      primary.process.kill("SIGTERM");
      const exitCode = await withTimeout(primary.process.exited, "cluster state shutdown", 20_000);
      if (process.platform !== "win32") {
        expect(exitCode).toBe(143);
      }
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

async function openSSE(
  requester: ClusterRequester,
  headers: Record<string, string> = {},
): Promise<{ reader: SSEReader; pid: number }> {
  const result = await requester.fetch("/api/realtime", { headers });
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
  const first = 20_000 + Math.floor(Math.random() * (40_000 - count));
  return Array.from({ length: count }, (_, offset) => first + offset);
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
