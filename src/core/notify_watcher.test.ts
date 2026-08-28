// Ported from pocketbase/core/notify_watcher_test.go.

import { describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BaseApp } from "./base.ts";
import { NewBaseCollection } from "./collection_model.ts";
import { TerminateEvent } from "./events.ts";
import { TextField } from "./field_text.ts";

describe("notify watcher", () => {
  it("SettingsUpdate", async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), "pb_notify_test"));
    const app1 = new BaseApp({ dataDir: tmpDir });
    const app2 = new BaseApp({ dataDir: tmpDir });
    let app1Reloads = 0;
    let app2Reloads = 0;

    try {
      app1.bootstrap();
      app2.bootstrap();

      app1.OnSettingsReload().BindFunc((event) => {
        app1Reloads++;
        return event.Next();
      });

      app2.OnSettingsReload().BindFunc((event) => {
        app2Reloads++;
        return event.Next();
      });

      // Updating app1 settings should trigger a reload in app2.
      app1.settings().superuserIPs = ["127.0.0.1"];
      const err = await app1.Save(app1.settings());
      expect(err).toBeNull();

      await waitFor(() => app2Reloads === 1 && app2.settings().superuserIPs[0] === "127.0.0.1");

      expect(app1Reloads).toBe(1);
      expect(app2Reloads).toBe(1);
    } finally {
      await terminateApp(app1);
      await terminateApp(app2);
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("CollectionsUpdate", async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), "pb_notify_test"));
    const app1 = new BaseApp({ dataDir: tmpDir });
    const app2 = new BaseApp({ dataDir: tmpDir });

    try {
      app1.bootstrap();
      app2.bootstrap();

      const dummyCollection = NewBaseCollection("test");
      let err = await app1.Save(dummyCollection);
      expect(err).toBeNull();

      await waitFor(() => {
        try {
          return app2.FindCachedCollectionByNameOrId("test").id === dummyCollection.id;
        } catch {
          return false;
        }
      });

      dummyCollection.Fields.Add(Object.assign(new TextField(), { Name: "test" }));
      err = await app1.Save(dummyCollection);
      expect(err).toBeNull();

      await waitFor(() => app2.FindCachedCollectionByNameOrId("test").Fields.GetByName("test") !== null);
    } finally {
      await terminateApp(app1);
      await terminateApp(app2);
      await rm(tmpDir, { recursive: true, force: true });
    }
  });
});

async function terminateApp(app: BaseApp): Promise<void> {
  if (!app.isBootstrapped()) {
    app.resetBootstrapState();
    return;
  }

  const event = new TerminateEvent(app);
  const result = app.OnTerminate().Trigger(event, (e) => {
    e.App.resetBootstrapState();
    return null;
  });

  const err = result instanceof Promise ? await result : result;
  if (err instanceof Error) {
    throw err;
  }
}

async function waitFor(predicate: () => boolean, timeoutMs = 5_000): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (predicate()) {
      return;
    }
    await Bun.sleep(25);
  }

  throw new Error("timed out waiting for notify watcher event");
}
