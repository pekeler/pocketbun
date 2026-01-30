import type { Database } from "bun:sqlite";
import type { Settings } from "./settings.ts";
import type { Store } from "./store.ts";
import type { Record } from "./record.ts";

export interface App {
  dataDir(): string;
  settings(): Settings;
  store(): Store<string, unknown>;
  isBootstrapped(): boolean;
  bootstrap(): void;
  resetBootstrapState(): void;
  db(): Database;
  auxDb(): Database;
  runAllMigrations(): void;
  findAuthRecordByToken(token: string, validTypes?: string[]): Record;
}
