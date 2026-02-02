// Ported from pocketbase/core/migrations_list.go

import { basename } from "node:path";
import type { App } from "./app.ts";
import type { MigrationsRunner } from "./migrations_runner.ts";

export type Migration = {
  up?: (txApp: App) => void;
  down?: (txApp: App) => void;
  file?: string;
  reapplyCondition?: (txApp: App, runner: MigrationsRunner, fileName: string) => boolean;
};

type ResolvedMigration = Omit<Migration, "file"> & { file: string };

// MigrationsList defines a list with migration definitions
export class MigrationsList {
  #list: ResolvedMigration[] = [];

  item(index: number): ResolvedMigration | undefined {
    return this.#list[index];
  }

  Item(index: number): ResolvedMigration | undefined {
    return this.item(index);
  }

  items(): ResolvedMigration[] {
    return this.#list;
  }

  Items(): ResolvedMigration[] {
    return this.items();
  }

  copy(list: MigrationsList): void {
    for (const item of list.items()) {
      this.register(item.up, item.down, item.file);
    }
  }

  Copy(list: MigrationsList): void {
    this.copy(list);
  }

  add(migration: Migration): void {
    let file = migration.file ?? "";
    if (!file) {
      file = detectCallerFileName();
    }

    if (!file) {
      throw new Error("migration file name is required");
    }

    this.#list.push({
      ...migration,
      file,
    });
    this.sort();
  }

  Add(migration: Migration): void {
    this.add(migration);
  }

  register(up: ((txApp: App) => void) | undefined, down: ((txApp: App) => void) | undefined, file?: string): void {
    let resolved = file ?? "";
    if (!resolved) {
      resolved = detectCallerFileName();
    }

    if (!resolved) {
      throw new Error("migration file name is required");
    }

    this.#list.push({
      file: resolved,
      up,
      down,
    });
    this.sort();
  }

  Register(up: ((txApp: App) => void) | undefined, down: ((txApp: App) => void) | undefined, file?: string): void {
    this.register(up, down, file);
  }

  private sort(): void {
    this.#list.sort((a, b) => (a.file ?? "").localeCompare(b.file ?? ""));
  }
}

function detectCallerFileName(): string {
  const stack = new Error().stack ?? "";
  const lines = stack.split("\n").slice(1);
  for (const line of lines) {
    const trimmed = line.trim();
    const match = trimmed.match(/\((.*):\d+:\d+\)$/) ?? trimmed.match(/at (.*):\d+:\d+$/);
    if (!match?.[1]) {
      continue;
    }
    const file = match[1];
    if (!file || file.includes("migrations_list.ts")) {
      continue;
    }
    return basename(file);
  }
  return "";
}
