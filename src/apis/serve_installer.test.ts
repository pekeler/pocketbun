// PocketBun-only: verifies installer initialization wiring in the Bun serve path.

import { describe, expect, it } from "bun:test";
import { CollectionNameSuperusers } from "../core/collection_model.ts";
import { newTestApp } from "../tests/app.ts";
import { retryServerStart } from "../tests/helpers.ts";
import { findOrCreateInstallerSuperuserAsync } from "./installer.ts";
import { buildServeHandler, serveAsync } from "./serve.ts";

describe("serve installer", () => {
  it("supports async OnServe hooks in serveAsync", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      app.OnServe().Bind({
        Id: "__pbTestAsyncOnServeHook__",
        Func: async (event) => {
          await Bun.sleep(1);
          event.Router.get("/__pb_async_on_serve", (reqEvent) => reqEvent.String(200, "ok"));
          return event.Next();
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
