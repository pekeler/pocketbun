// Ported from pocketbase/core/migrations_runner_test.go.

import { describe, expect, it } from "bun:test";
import type { App } from "./app.ts";
import { newTestApp } from "../tests/app.ts";
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
