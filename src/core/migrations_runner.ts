// Ported from pocketbase/core/migrations_runner.go @ v0.36.1 (9b036fb1)

import type { App } from "./app.ts";
import { MigrationsList } from "./migrations_list.ts";

export const DefaultMigrationsTable = "_migrations";

export const AppMigrations = new MigrationsList();
export const SystemMigrations = new MigrationsList();

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

  removeMissingAppliedMigrations(): void {
    this.initMigrationsTable();

    const names = this.#migrationsList.items().map((migration) => migration.file);
    if (names.length === 0) {
      this.#app.db().query(`delete from ${this.#tableName}`).run();
      return;
    }

    const placeholders = names.map(() => "?").join(",");
    this.#app
      .db()
      .query(`delete from ${this.#tableName} where file not in (${placeholders})`)
      .run(...names);
  }

  private initMigrationsTable(): void {
    if (this.#inited) {
      return;
    }

    this.#app
      .db()
      .query(
        `create table if not exists ${this.#tableName} (file text primary key not null, applied integer not null)`,
      )
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
    this.#app.db().query(`delete from ${this.#tableName} where file = ?`).run(file);
  }

  private lastAppliedMigrations(limit: number): string[] {
    const files: string[] = [];
    const rows = this.#app
      .db()
      .query(
        `select file from ${this.#tableName} where applied is not null order by substr(applied || '0000000000000000', 0, 17) desc, file desc limit ?`,
      )
      .all(limit) as Array<{ file: string }>;

    for (const row of rows) {
      files.push(row.file);
    }

    return files;
  }
}
