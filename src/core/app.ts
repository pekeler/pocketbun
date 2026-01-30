import type { Database } from "bun:sqlite";
import type { Settings } from "./settings.ts";
import type { Store } from "./store.ts";
import type { Record as RecordModel } from "./record.ts";

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
}
