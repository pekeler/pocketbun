// Ported from pocketbase/core/app.go

import type { Database } from "bun:sqlite";
import type { Settings } from "./settings.ts";
import type { Store } from "./store.ts";
import type { Record as RecordModel } from "./record.ts";
import type { Collection } from "./collection.ts";

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
  findAuthRecordByToken(token: string, validTypes?: string[]): RecordModel;
  findCollectionById(id: string): Collection | null;
  findCollectionByNameOrId(identifier: string): Collection | null;
  findRecordById(collection: Collection, id: string): RecordModel | null;
}
