// PocketBun-only: verifies installer initialization wiring in the Bun serve path.

import { describe, expect, it } from "bun:test";
import { CollectionNameSuperusers } from "../core/collection_model.ts";
import { newTestApp } from "../tests/app.ts";
import { findOrCreateInstallerSuperuserAsync } from "./installer.ts";
import { serveAsync } from "./serve.ts";

describe("serve installer", () => {
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

      const server = await serveAsync(app, { httpAddr: "127.0.0.1:0" });
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
