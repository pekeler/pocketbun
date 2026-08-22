// Ported from pocketbase/core/base_backup_test.go.

import { Database } from "bun:sqlite";
import { describe, expect, it } from "bun:test";
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { newTestApp } from "../tests/app.ts";
import { ExtractAsync } from "../tools/archive/extract.ts";
import { existInSliceWithRegex } from "../tools/list/list.ts";
import { LocalBackupsDirName } from "./base.ts";
import { StoreKeyActiveBackup } from "./store.ts";

function getEntryNames(entries: Array<{ name: string }>): string[] {
  return entries.map((entry) => entry.name);
}

async function verifyBackupContent(path: string) {
  const dir = await mkdtemp(join(tmpdir(), "backup_test_"));
  try {
    await ExtractAsync(path, dir);

    // PocketBun archives disk-backed SQLite snapshots instead of live WAL/SHM sidecars.
    const expectedRootEntries = ["storage", "data.db", "auxiliary.db", ".gitignore"];

    const entries = await readdir(dir, { withFileTypes: true });
    if (entries.length !== expectedRootEntries.length) {
      const names = getEntryNames(entries);
      throw new Error(`Expected ${expectedRootEntries.length} backup files, got ${entries.length}:\n${names.join(", ")}`);
    }

    for (const entry of entries) {
      if (!existInSliceWithRegex(entry.name, expectedRootEntries)) {
        throw new Error(`Didn't expect ${entry.name} entry`);
      }
    }

    for (const name of ["data.db", "auxiliary.db"]) {
      using db = new Database(join(dir, name), { readonly: true });
      expect(db.query("PRAGMA integrity_check").get()).toEqual({ integrity_check: "ok" });
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

describe("backups", () => {
  it("CreateBackup", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      app.settings().meta.appName = `test @! ${"a".repeat(100)}`;

      const expectedAppNamePrefix = `test_${"a".repeat(45)}`;

      app.store().set(StoreKeyActiveBackup, "");
      const pendingErr = await app.CreateBackup({}, "test.zip");
      expect(pendingErr).not.toBeNull();
      app.store().remove(StoreKeyActiveBackup);

      const autoErr = await app.CreateBackup({}, "");
      expect(autoErr).toBeNull();

      const customErr = await app.CreateBackup({}, "custom");
      expect(customErr).toBeNull();

      const replaceErr = await app.CreateBackup({}, "custom");
      expect(replaceErr).toBeNull();

      const backupsDir = join(app.DataDir(), LocalBackupsDirName);
      const entries = await readdir(backupsDir, { withFileTypes: true });

      const expectedFiles = [
        `^pb_backup_${expectedAppNamePrefix}_\\w+\\.zip$`,
        `^pb_backup_${expectedAppNamePrefix}_\\w+\\.zip\\.attrs$`,
        "custom",
        "custom.attrs",
      ];

      if (entries.length !== expectedFiles.length) {
        const names = getEntryNames(entries);
        throw new Error(`Expected ${expectedFiles.length} backup files, got ${entries.length}:\n${names.join(", ")}`);
      }

      for (const entry of entries) {
        if (!existInSliceWithRegex(entry.name, expectedFiles)) {
          throw new Error(`Missing backup file ${entry.name}`);
        }

        if (entry.name.endsWith(".attrs")) {
          continue;
        }

        const path = join(backupsDir, entry.name);
        await verifyBackupContent(path);
      }
    } finally {
      await cleanup();
    }
  });

  it("RestoreBackup", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const initialErr = await app.CreateBackup({}, "initial");
      expect(initialErr).toBeNull();

      const testErr = await app.CreateBackup({}, "test");
      expect(testErr).toBeNull();

      app.store().set(StoreKeyActiveBackup, "");
      const pendingErr = await app.RestoreBackup({}, "test");
      expect(pendingErr).not.toBeNull();
      app.store().remove(StoreKeyActiveBackup);

      const missingErr = await app.RestoreBackup({}, "missing");
      expect(missingErr).not.toBeNull();
    } finally {
      await cleanup();
    }
  });

  it("restores a backup created by PocketBase", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      // Generated with the pinned PocketBase source's actual CreateBackup implementation.
      const backupsDir = join(app.DataDir(), LocalBackupsDirName);
      const name = "pocketbase-backup-fixture.zip";
      await mkdir(backupsDir, { recursive: true });
      await copyFile(new URL("./testdata/pocketbase-backup-fixture.zip", import.meta.url), join(backupsDir, name));

      // Keep this test process alive so it can reopen the restored databases.
      (app as unknown as { RestartAsync: () => Promise<Error | null> }).RestartAsync = async () => null;
      expect(await app.RestoreBackup({}, name)).toBeNull();
      app.resetBootstrapState();
      app.bootstrap();

      expect(app.db().query("select value from pb_backup_fixture").get()).toEqual({ value: "pocketbase-main" });
      expect(app.auxDb().query("select message from _logs where id = ?").get("pbfixturelog001")).toEqual({
        message: "pocketbase-auxiliary",
      });
      expect(await readFile(join(app.DataDir(), "storage", "pocketbase-fixture.txt"), "utf8")).toBe("pocketbase-file");
    } finally {
      await cleanup();
    }
  });
});
