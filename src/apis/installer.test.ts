// PocketBun-only: this test locks async installer helper behavior (no upstream async installer API exists).

import { describe, expect, it } from "bun:test";
import { CollectionNameSuperusers } from "../core/collection_model.ts";
import { DefaultInstallerEmail } from "../core/record_model_superusers.ts";
import { newTestApp } from "../tests/app.ts";
import { findOrCreateInstallerSuperuserAsync, loadInstallerAsync, needInstallerSuperuser } from "./installer.ts";

describe("installer helpers", () => {
  it("findOrCreateInstallerSuperuserAsync creates and then reuses the installer superuser", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      try {
        const existingInstaller = app.FindAuthRecordByEmail(CollectionNameSuperusers, DefaultInstallerEmail);
        const deleteErr = await app.Delete(existingInstaller);
        if (deleteErr) {
          throw deleteErr;
        }
      } catch (error) {
        if (!(error instanceof Error) || error.message !== "record not found") {
          throw error;
        }
      }

      const created = await findOrCreateInstallerSuperuserAsync(app);
      expect(created.Email()).toBe(DefaultInstallerEmail);

      const reused = await findOrCreateInstallerSuperuserAsync(app);
      expect(reused.id).toBe(created.id);
    } finally {
      await cleanup();
    }
  });

  it("loadInstallerAsync runs the installer callback when only the installer superuser remains", async () => {
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

      expect(needInstallerSuperuser(app)).toBeTrue();

      let callbackCalls = 0;
      const loadErr = await loadInstallerAsync(app, "http://127.0.0.1:8090", async (_app, systemSuperuser, baseURL) => {
        callbackCalls += 1;
        expect(systemSuperuser.id).toBe(installer.id);
        expect(baseURL).toBe("http://127.0.0.1:8090");
        return null;
      });

      expect(loadErr).toBeNull();
      expect(callbackCalls).toBe(1);
    } finally {
      await cleanup();
    }
  });
});
