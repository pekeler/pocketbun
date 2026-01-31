// Ported from pocketbase/core/app.go

import type { Database, SQLQueryBindings } from "bun:sqlite";
import type { Settings } from "./settings.ts";
import type { Store } from "./store.ts";
import type { Record as RecordModel } from "./record.ts";
import type { Collection } from "./collection.ts";
import type { SqlExpr } from "../tools/search/types.ts";
import type { System } from "../tools/filesystem/filesystem.ts";

export type Logger = {
  Warn: (message: string, ...args: unknown[]) => void;
};

export interface App {
  dataDir(): string;
  encryptionEnv(): string;
  settings(): Settings;
  store(): Store<string, unknown>;
  isBootstrapped(): boolean;
  bootstrap(): void;
  resetBootstrapState(): void;
  db(): Database;
  auxDb(): Database;
  auxHasTable(name: string): boolean;
  reloadSettings(): void;
  runSystemMigrations(): void;
  runAppMigrations(): void;
  runAllMigrations(): void;
  NewFilesystem(): System;
  Save(record: RecordModel): Error | null;
  RunInTransaction(fn: (txApp: App) => Error | null): Error | null;
  IsTransactional(): boolean;
  Logger(): Logger;
  findAuthRecordByToken(token: string, validTypes?: string[]): RecordModel;
  findCollectionById(id: string): Collection | null;
  findCollectionByNameOrId(identifier: string): Collection | null;
  findRecordById(collection: Collection, id: string, rule?: SqlExpr | null): RecordModel | null;
  findFirstRecordByFilter(
    collectionOrIdentifier: Collection | string,
    filter: string,
    ...params: SQLQueryBindings[]
  ): RecordModel | null;
}
