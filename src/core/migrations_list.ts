// Ported from pocketbase/core/migrations_list.go @ v0.36.1 (9b036fb1)

import type { App } from "./app.ts";
import type { MigrationsRunner } from "./migrations_runner.ts";

export type Migration = {
  up?: (txApp: App) => void;
  down?: (txApp: App) => void;
  file: string;
  reapplyCondition?: (txApp: App, runner: MigrationsRunner, fileName: string) => boolean;
};

export class MigrationsList {
  #list: Migration[] = [];

  item(index: number): Migration | undefined {
    return this.#list[index];
  }

  items(): Migration[] {
    return this.#list;
  }

  copy(list: MigrationsList): void {
    for (const item of list.items()) {
      this.register(item.up, item.down, item.file);
    }
  }

  add(migration: Migration): void {
    if (!migration.file) {
      throw new Error("migration file name is required");
    }

    this.#list.push(migration);
    this.sort();
  }

  register(
    up: ((txApp: App) => void) | undefined,
    down: ((txApp: App) => void) | undefined,
    file: string,
  ): void {
    if (!file) {
      throw new Error("migration file name is required");
    }

    this.#list.push({
      file,
      up,
      down,
    });
    this.sort();
  }

  private sort(): void {
    this.#list.sort((a, b) => a.file.localeCompare(b.file));
  }
}
