// PocketBun-only: verifies installer initialization wiring in the Bun serve path.

import { describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BaseApp } from "../core/base.ts";
import { CollectionNameSuperusers } from "../core/collection_model.ts";
import { SystemMigrations } from "../core/migrations_runner.ts";
import { newTestApp } from "../tests/app.ts";
import { retryServerStart } from "../tests/helpers.ts";
import { findOrCreateInstallerSuperuserAsync } from "./installer.ts";
import { buildServeHandler, serveAsync } from "./serve.ts";

describe("serve installer", () => {
  it.serial("serveAsync does not rerun system migrations after bootstrap", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "pocketbun-serve-migrations-"));
    const app = new BaseApp({ dataDir, isDev: true });
    const originalWrite = Reflect.get(process.stderr, "write") as typeof process.stderr.write;
    let stderr = "";

    app.OnServe().Bind({
      Id: "__pbTestSkipInstaller__",
      Priority: 9999,
      Func: (event) => {
        event.InstallerFunc = null;
        return event.Next();
      },
    });

    process.stderr.write = ((chunk: string | Uint8Array) => {
      stderr += typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk);
      return true;
    }) as typeof process.stderr.write;

    try {
      const server = await retryServerStart(() => serveAsync(app, { httpAddr: "127.0.0.1:0", showStartBanner: false }));
      await server.stop();
    } finally {
      process.stderr.write = originalWrite;
      app.resetBootstrapState();
      await rm(dataDir, { recursive: true, force: true });
    }

    const appliedChecks = stderr.match(/select 1 as found from _migrations where file = \? limit 1/g) ?? [];
    expect(appliedChecks.length).toBe(SystemMigrations.Items().length);
  });

  it("supports async OnServe hooks in serveAsync", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      app.onServe().bind({
        id: "__pbTestAsyncOnServeHook__",
        func: async (event) => {
          await Bun.sleep(1);
          event.installerFunc = null;
          event.router.get("/__pb_async_on_serve", (reqEvent) => reqEvent.string(200, "ok"));
          return event.next();
        },
      });

      const server = await retryServerStart(() => serveAsync(app, { httpAddr: "127.0.0.1:0" }));
      try {
        const res = await fetch(`http://${server.hostname}:${server.port}/__pb_async_on_serve`);
        expect(res.status).toBe(200);
        expect(await res.text()).toBe("ok");
      } finally {
        await server.stop();
      }
    } finally {
      await cleanup();
    }
  });

  it("keeps buildServeHandler sync-only for async OnServe hooks", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      app.OnServe().Bind({
        Id: "__pbTestBuildServeHandlerAsyncOnServe__",
        Func: async (event) => {
          await Bun.sleep(1);
          return event.Next();
        },
      });

      expect(() => buildServeHandler(app)).toThrow("Async OnServe hooks are not supported in buildServeHandler.");
    } finally {
      await cleanup();
    }
  });

  it("runs the configured ServeEvent installer func in serveAsync", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const installer = await findOrCreateInstallerSuperuserAsync(app);
      const allSuperusers = app.FindAllRecords(CollectionNameSuperusers);
      for (const superuser of allSuperusers) {
        if (superuser.id === installer.id) {
          continue;
        }
        const deleteErr = await app.Delete(superuser);
        if (deleteErr) {
          throw deleteErr;
        }
      }

      let installerCalls = 0;
      app.OnServe().Bind({
        Id: "__pbTestServeInstaller__",
        Priority: 9999,
        Func: (event) => {
          event.InstallerFunc = async (_app, systemSuperuser, baseURL) => {
            installerCalls += 1;
            expect(systemSuperuser.id).toBe(installer.id);
            expect(baseURL.startsWith("http://127.0.0.1:")).toBeTrue();
            return null;
          };
          return event.Next();
        },
      });

      const server = await retryServerStart(() => serveAsync(app, { httpAddr: "127.0.0.1:0" }));
      try {
        await waitFor(() => installerCalls > 0, 3000);
        expect(installerCalls).toBe(1);
      } finally {
        await server.stop();
      }
    } finally {
      await cleanup();
    }
  });
});

async function waitFor(predicate: () => boolean, timeoutMs: number): Promise<void> {
  const startedAt = Date.now();
  while (!predicate()) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error("timed out waiting for condition");
    }
    await Bun.sleep(25);
  }
}
