// Ported from pocketbase/core/migrations_runner.go

import type { App } from "./app.ts";
import { toNumberValue } from "../internal/compat/cast.ts";
import { green } from "../tools/cli/color.ts";
import { YesNoPrompt } from "../tools/osutils/cmd.ts";
import { MigrationsList } from "./migrations_list.ts";

export const DefaultMigrationsTable = "_migrations";

export const AppMigrations = new MigrationsList();
export const SystemMigrations = new MigrationsList();

// MigrationsRunner defines a simple struct for managing the execution of db migrations.
export class MigrationsRunner {
  #app: App;
  #migrationsList: MigrationsList;
  #tableName: string;
  #inited = false;

  constructor(app: App, migrationsList: MigrationsList) {
    this.#app = app;
    this.#migrationsList = migrationsList;
    this.#tableName = DefaultMigrationsTable;
  }

  // Run interactively executes the current runner with the provided args.
  //
  // Supported commands:
  // - up           - applies all migrations
  // - down [n]     - reverts the last n (default 1) applied migrations
  // - history-sync - syncs the migrations table with the runner's migrations list
  run(...args: string[]): Error | null {
    try {
      this.initMigrationsTable();
    } catch (err) {
      return err as Error;
    }

    const cmd = args.length > 0 ? (args[0] ?? "up") : "up";

    switch (cmd) {
      case "up": {
        let applied: string[] = [];
        try {
          applied = this.up();
        } catch (err) {
          return err as Error;
        }

        if (applied.length === 0) {
          green("No new migrations to apply.\n");
        } else {
          for (const file of applied) {
            green("Applied %s\n", file);
          }
        }
        return null;
      }
      case "down": {
        let toRevertCount = 1;
        if (args.length > 1) {
          const parsed = Math.trunc(toNumberValue(args[1]));
          toRevertCount = parsed < 0 ? this.#migrationsList.Items().length : parsed;
        }

        const names = this.lastAppliedMigrations(toRevertCount);
        const confirm = YesNoPrompt(
          `\n${names.join("\n")}\nDo you really want to revert the last ${toRevertCount} applied migration(s)?`,
          false,
        );
        if (!confirm) {
          console.log("The command has been cancelled");
          return null;
        }

        let reverted: string[] = [];
        try {
          reverted = this.down(toRevertCount);
        } catch (err) {
          return err as Error;
        }

        if (reverted.length === 0) {
          green("No migrations to revert.\n");
        } else {
          for (const file of reverted) {
            green("Reverted %s\n", file);
          }
        }
        return null;
      }
      case "history-sync": {
        try {
          this.removeMissingAppliedMigrations();
        } catch (err) {
          return err as Error;
        }

        green("The %s table was synced with the available migrations.\n", this.#tableName);
        return null;
      }
      default:
        return new Error(`unsupported command: ${JSON.stringify(cmd)}`);
    }
  }

  Run(...args: string[]): Error | null {
    return this.run(...args);
  }

  up(): string[] {
    this.initMigrationsTable();
    const applied: string[] = [];

    const tx = this.#app.db().transaction(() => {
      for (const migration of this.#migrationsList.items()) {
        const alreadyApplied = this.isMigrationApplied(migration.file);
        if (alreadyApplied) {
          if (!migration.reapplyCondition) {
            continue;
          }

          const shouldReapply = migration.reapplyCondition(this.#app, this, migration.file);
          if (!shouldReapply) {
            continue;
          }

          this.saveRevertedMigration(migration.file);
        }

        if (migration.up) {
          migration.up(this.#app);
        }

        this.saveAppliedMigration(migration.file);
        applied.push(migration.file);
      }
    });

    tx();
    return applied;
  }

  Up(): string[] {
    return this.up();
  }

  down(toRevertCount: number): string[] {
    this.initMigrationsTable();
    const names = this.lastAppliedMigrations(toRevertCount);
    const reverted: string[] = [];

    const tx = this.#app.db().transaction(() => {
      for (const name of names) {
        if (toRevertCount - reverted.length <= 0) {
          return;
        }

        const migration = this.#migrationsList.items().find((item) => item.file === name);
        if (!migration) {
          continue;
        }

        if (migration.down) {
          migration.down(this.#app);
        }

        this.saveRevertedMigration(migration.file);
        reverted.push(migration.file);
      }
    });

    tx();
    return reverted;
  }

  Down(toRevertCount: number): string[] {
    return this.down(toRevertCount);
  }

  removeMissingAppliedMigrations(): void {
    this.initMigrationsTable();

    const names = this.#migrationsList
      .items()
      .map((migration) => migration.file)
      .filter((name): name is string => Boolean(name));
    if (names.length === 0) {
      this.#app
        .db()
        .query(`delete from ${this.#tableName}`)
        .run();
      return;
    }

    const placeholders = names.map(() => "?").join(",");
    this.#app
      .db()
      .query(`delete from ${this.#tableName} where file not in (${placeholders})`)
      .run(...names);
  }

  RemoveMissingAppliedMigrations(): void {
    this.removeMissingAppliedMigrations();
  }

  private initMigrationsTable(): void {
    if (this.#inited) {
      return;
    }

    this.#app
      .db()
      .query(`create table if not exists ${this.#tableName} (file text primary key not null, applied integer not null)`)
      .run();
    this.#inited = true;
  }

  private isMigrationApplied(file: string): boolean {
    const row = this.#app
      .db()
      .query(`select 1 as found from ${this.#tableName} where file = ? limit 1`)
      .get(file) as { found?: number } | undefined;
    return Boolean(row?.found);
  }

  private saveAppliedMigration(file: string): void {
    const applied = Math.floor(Date.now() * 1000);
    this.#app
      .db()
      .query(`insert into ${this.#tableName} (file, applied) values (?, ?)`)
      .run(file, applied);
  }

  private saveRevertedMigration(file: string): void {
    this.#app
      .db()
      .query(`delete from ${this.#tableName} where file = ?`)
      .run(file);
  }

  private lastAppliedMigrations(limit: number): string[] {
    const files: string[] = [];
    const names = this.#migrationsList.items().map((migration) => migration.file);
    if (names.length === 0) {
      return files;
    }

    const placeholders = names.map(() => "?").join(",");
    const rows = this.#app
      .db()
      .query(
        `select file from ${this.#tableName} where applied is not null and file in (${placeholders}) order by substr(applied || '0000000000000000', 0, 17) desc, file desc limit ?`,
      )
      .all(...names, limit) as Array<{ file: string }>;

    for (const row of rows) {
      files.push(row.file);
    }

    return files;
  }
}

export function NewMigrationsRunner(app: App, migrationsList: MigrationsList): MigrationsRunner {
  return new MigrationsRunner(app, migrationsList);
}
