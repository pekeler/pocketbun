// Ported from pocketbase/core/backup_test.go.

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

async function verifyPocketBaseBackupFixture(path: string) {
  const dir = await mkdtemp(join(tmpdir(), "pocketbase_backup_fixture_"));
  try {
    await ExtractAsync(path, dir);

    using db = new Database(join(dir, "data.db"), { readonly: true });
    expect(db.query("select value from pb_backup_fixture").get()).toEqual({ value: "pocketbase-main" });

    using auxDb = new Database(join(dir, "auxiliary.db"), { readonly: true });
    expect(auxDb.query("select message from _logs where id = ?").get("pbfixturelog001")).toEqual({
      message: "pocketbase-auxiliary",
    });
    expect(await readFile(join(dir, "storage", "pocketbase-fixture.txt"), "utf8")).toBe("pocketbase-file");
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

  it("preserves deleted files and excludes new files after the main database snapshot", async () => {
    const { app, cleanup } = await newTestApp();
    const extracted = await mkdtemp(join(tmpdir(), "backup_new_file_"));
    try {
      await using initialFsys = await app.NewFilesystemAsync();
      await initialFsys.Upload(new TextEncoder().encode("old"), "deleted-after-snapshot.txt");

      let created = false;
      app.OnBackupCreate().BindFunc(async (event) => {
        const backup = Promise.resolve(event.Next());
        while (app.onFilesystemNewWriter().Length() === 0) {
          await Bun.sleep(1);
        }
        await using fsys = await app.NewFilesystemAsync();
        await fsys.Delete("deleted-after-snapshot.txt");
        await fsys.Upload(new TextEncoder().encode("new"), "new-after-snapshot.txt");
        created = true;
        return backup;
      });

      expect(await app.CreateBackup({}, "consistent.zip")).toBeNull();
      expect(created).toBeTrue();
      const backupPath = join(app.DataDir(), LocalBackupsDirName, "consistent.zip");
      await ExtractAsync(backupPath, extracted);

      expect(await readFile(join(app.DataDir(), "storage", "new-after-snapshot.txt"), "utf8")).toBe("new");
      expect(await Bun.file(join(app.DataDir(), "storage", "deleted-after-snapshot.txt")).exists()).toBeFalse();
      expect(await Bun.file(join(extracted, "storage", "new-after-snapshot.txt")).exists()).toBeFalse();
      expect(await readFile(join(extracted, "storage", "deleted-after-snapshot.txt"), "utf8")).toBe("old");
      expect(await Bun.file(join(extracted, "storage", "deleted-after-snapshot.txt.attrs")).exists()).toBeTrue();
    } finally {
      await rm(extracted, { recursive: true, force: true });
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
      const backupPath = join(backupsDir, name);
      await copyFile(new URL("./testdata/pocketbase-backup-fixture.zip", import.meta.url), backupPath);
      await verifyPocketBaseBackupFixture(backupPath);

      if (process.platform === "win32") {
        const error = await app.RestoreBackup({}, name);
        expect(error?.message).toBe("restore is not supported on Windows");
        return;
      }

      // Keep this test process alive so it can reopen the restored databases.
      (app as unknown as { RestartAsync: () => Promise<Error | null> }).RestartAsync = async () => null;
      expect(await app.RestoreBackup({}, name)).toBeNull();
      app.resetBootstrapState();

      // Bootstrapping applies the restored PocketBase log-retention settings,
      // which can prune this fixture's old log entry.
      {
        using restoredAuxDb = new Database(join(app.DataDir(), "auxiliary.db"), { readonly: true });
        expect(restoredAuxDb.query("select message from _logs where id = ?").get("pbfixturelog001")).toEqual({
          message: "pocketbase-auxiliary",
        });
      }
      app.bootstrap();

      expect(app.db().query("select value from pb_backup_fixture").get()).toEqual({ value: "pocketbase-main" });
      expect(await readFile(join(app.DataDir(), "storage", "pocketbase-fixture.txt"), "utf8")).toBe("pocketbase-file");
    } finally {
      await cleanup();
    }
  });
});
