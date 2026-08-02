// Ported from pocketbase/core/migrations_runner_test.go.

import { describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { App } from "./app.ts";
import { newTestApp } from "../tests/app.ts";
import { BaseApp } from "./base.ts";
import { MigrationsList } from "./migrations_list.ts";
import { DefaultMigrationsTable, MigrationsRunner } from "./migrations_runner.ts";

function insertMigration(app: App, file: string, applied: number): void {
  app.db().query(`insert into ${DefaultMigrationsTable} (file, applied) values (?, ?)`).run(file, applied);
}

function isMigrationApplied(app: App, file: string): boolean {
  const row = app.db().query(`select 1 as found from ${DefaultMigrationsTable} where file = ? limit 1`).get(file) as
    | { found?: number }
    | undefined;
  return Boolean(row?.found);
}

describe("MigrationsRunner", () => {
  it.serial("dev logs name the migration before its SQL and avoids no-op transactions", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "pocketbun-migration-logs-"));
    const app = new BaseApp({ dataDir, isDev: true });
    const originalWrite = Reflect.get(process.stderr, "write") as typeof process.stderr.write;
    let stderr = "";
    let firstRunStderr = "";
    let secondRunStderr = "";
    let downRunStderr = "";

    try {
      app.bootstrap();
      process.stderr.write = ((chunk: string | Uint8Array) => {
        stderr += typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk);
        return true;
      }) as typeof process.stderr.write;

      const list = new MigrationsList();
      list.register(
        (txApp) => txApp.db().run("create table migration_log_test (id text primary key)"),
        (txApp) => txApp.db().run("drop table migration_log_test"),
        "1234_migration_log_test.js",
      );

      new MigrationsRunner(app, list).up();
      firstRunStderr = stderr;
      stderr = "";
      new MigrationsRunner(app, list).up();
      secondRunStderr = stderr;
      stderr = "";
      new MigrationsRunner(app, list).down(1);
      downRunStderr = stderr;
    } finally {
      process.stderr.write = originalWrite;
      app.resetBootstrapState();
      await rm(dataDir, { recursive: true, force: true });
    }

    const marker = "Applying migration 1234_migration_log_test.js";
    const migrationSQL = "create table migration_log_test (id text primary key)";
    expect(firstRunStderr.indexOf(marker)).toBeLessThan(firstRunStderr.indexOf(migrationSQL));
    expect(firstRunStderr).toContain("select file from _migrations");
    expect(firstRunStderr).toContain("insert into _migrations");
    expect(firstRunStderr).toContain("] BEGIN");
    expect(firstRunStderr).toContain("] COMMIT");
    expect(secondRunStderr).toContain("select file from _migrations");
    expect(secondRunStderr).not.toContain(marker);
    expect(secondRunStderr).not.toContain("] BEGIN");
    expect(secondRunStderr).not.toContain("] COMMIT");
    const revertMarker = "Reverting migration 1234_migration_log_test.js";
    const downSQL = "drop table migration_log_test";
    expect(downRunStderr.indexOf(revertMarker)).toBeLessThan(downRunStderr.indexOf(downSQL));
    expect(downRunStderr.match(/select file from _migrations/g)).toHaveLength(1);
    expect(downRunStderr).toContain("delete from _migrations");
  });

  it("up and down", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const callsOrder: string[] = [];

      const list = new MigrationsList();
      list.Register(
        () => {
          callsOrder.push("up2");
        },
        () => {
          callsOrder.push("down2");
        },
        "2_test",
      );
      list.Register(
        () => {
          callsOrder.push("up3");
        },
        () => {
          callsOrder.push("down3");
        },
        "3_test",
      );
      list.Register(
        () => {
          callsOrder.push("up1");
        },
        () => {
          callsOrder.push("down1");
        },
        "1_test",
      );
      list.Register(
        () => {
          callsOrder.push("up4");
        },
        () => {
          callsOrder.push("down4");
        },
        "4_test",
      );
      list.Add({
        file: "5_test",
        up: () => {
          callsOrder.push("up5");
        },
        down: () => {
          callsOrder.push("down5");
        },
        reapplyCondition: () => true,
      });

      const runner = new MigrationsRunner(app, list);

      const now = Date.now() * 1000;
      insertMigration(app, "4_test", now - 2);
      insertMigration(app, "5_test", now - 1);
      insertMigration(app, "2_test", now);

      runner.up();

      expect(callsOrder).toEqual(["up1", "up3", "up5"]);

      callsOrder.length = 0;

      list.Register(
        undefined,
        () => {
          callsOrder.push("down6");
        },
        "6_test",
      );

      insertMigration(app, "from_different_list", Date.now() * 1000);

      runner.down(2);

      expect(callsOrder).toEqual(["down5", "down3"]);
    } finally {
      await cleanup();
    }
  });

  it("removes missing applied migrations", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const now = Date.now() * 1000;
      insertMigration(app, "1_test", now - 2);
      insertMigration(app, "2_test", now - 1);
      insertMigration(app, "3_test", now);

      expect(isMigrationApplied(app, "2_test")).toBe(true);

      const list = new MigrationsList();
      list.Register(
        () => {},
        () => {},
        "1_test",
      );
      list.Register(
        () => {},
        () => {},
        "3_test",
      );

      const runner = new MigrationsRunner(app, list);
      runner.removeMissingAppliedMigrations();

      expect(isMigrationApplied(app, "2_test")).toBe(false);
    } finally {
      await cleanup();
    }
  });
});
