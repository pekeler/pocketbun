// Ported from pocketbase/core/base_app.go @ v0.36.1 (9b036fb1)

import "../migrations/index.ts";

import type { Database } from "bun:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { App } from "./app.ts";
import { Collection, parseCollectionFields } from "./collection.ts";
import { AppMigrations, MigrationsRunner, SystemMigrations } from "./migrations_runner.ts";
import { MigrationsList } from "./migrations_list.ts";
import {
  TokenClaimCollectionId,
  TokenClaimId,
  TokenClaimType,
  TokenTypeAuth,
  TokenTypeEmailChange,
  TokenTypeFile,
  TokenTypePasswordReset,
  TokenTypeVerification,
} from "./record_tokens.ts";
import { Record as RecordModel, type RecordData } from "./record.ts";
import { Settings } from "./settings.ts";
import { Store } from "./store.ts";
import { parseJWT, parseUnverifiedJWT } from "../tools/security/jwt.ts";
import { DbxDatabase } from "../tools/dbx/database.ts";

export type BaseAppConfig = {
  dataDir?: string;
  encryptionEnv?: string;
};

export class BaseApp implements App {
  #dataDir: string;
  #encryptionEnv: string;
  #settings: Settings;
  #store: Store<string, unknown>;
  #bootstrapped = false;
  #db: DbxDatabase | null = null;
  #auxDb: DbxDatabase | null = null;

  constructor(config: BaseAppConfig = {}) {
    this.#dataDir = config.dataDir ?? "pb_data";
    this.#encryptionEnv = config.encryptionEnv ?? "";
    this.#settings = new Settings();
    this.#store = new Store();
  }

  dataDir(): string {
    return this.#dataDir;
  }

  encryptionEnv(): string {
    return this.#encryptionEnv;
  }

  settings(): Settings {
    return this.#settings;
  }

  store(): Store<string, unknown> {
    return this.#store;
  }

  isBootstrapped(): boolean {
    return this.#bootstrapped;
  }

  bootstrap(): void {
    if (this.#bootstrapped) {
      return;
    }

    if (!existsSync(this.#dataDir)) {
      mkdirSync(this.#dataDir, { recursive: true });
    }

    this.#db = new DbxDatabase(join(this.#dataDir, "data.db"));
    this.#auxDb = new DbxDatabase(join(this.#dataDir, "auxiliary.db"));
    this.reloadSettings();
    this.#bootstrapped = true;
  }

  resetBootstrapState(): void {
    if (this.#db) {
      this.#db.close();
      this.#db = null;
    }
    if (this.#auxDb) {
      this.#auxDb.close();
      this.#auxDb = null;
    }
    this.#bootstrapped = false;
  }

  db(): Database {
    if (!this.#db) {
      throw new Error("app is not bootstrapped");
    }
    return this.#db;
  }

  auxDb(): Database {
    if (!this.#auxDb) {
      throw new Error("app is not bootstrapped");
    }
    return this.#auxDb;
  }

  auxHasTable(name: string): boolean {
    const row = this.auxDb()
      .query("select name from sqlite_master where type='table' and name = ?")
      .get(name) as { name?: string } | undefined;
    return Boolean(row?.name);
  }

  runAllMigrations(): void {
    const list = new MigrationsList();
    list.copy(SystemMigrations);
    list.copy(AppMigrations);
    new MigrationsRunner(this, list).up();
  }

  runSystemMigrations(): void {
    new MigrationsRunner(this, SystemMigrations).up();
  }

  runAppMigrations(): void {
    new MigrationsRunner(this, AppMigrations).up();
  }

  reloadSettings(): void {
    try {
      const row = this.db().query("select value from _params where id = 'settings'").get() as
        | { value?: string }
        | undefined;
      if (!row?.value || typeof row.value !== "string") {
        return;
      }

      const parsed = JSON.parse(row.value) as Record<string, unknown>;
      this.#settings.loadFromJSON(parsed);
    } catch {
      // ignore missing settings table or invalid JSON
    }
  }

  findAuthRecordByToken(token: string, validTypes: string[] = []): RecordModel {
    if (token === "") {
      throw new Error("missing token");
    }

    const claims = parseUnverifiedJWT(token);
    const id = typeof claims[TokenClaimId] === "string" ? claims[TokenClaimId] : "";
    const collectionId =
      typeof claims[TokenClaimCollectionId] === "string" ? claims[TokenClaimCollectionId] : "";
    const tokenType = typeof claims[TokenClaimType] === "string" ? claims[TokenClaimType] : "";

    if (!id || !collectionId || !tokenType) {
      throw new Error("missing or invalid token claims");
    }

    if (validTypes.length > 0 && !validTypes.includes(tokenType)) {
      throw new Error(`invalid token type "${tokenType}"`);
    }

    const collection = this.findCollectionById(collectionId);
    if (!collection || !collection.isAuth()) {
      throw new Error("the token is not associated to an auth collection record");
    }

    const record = this.findRecordById(collection, id);
    if (!record) {
      throw new Error("record not found");
    }

    const baseTokenKey = resolveBaseTokenKey(collection, tokenType);
    if (!baseTokenKey) {
      throw new Error("missing or invalid signing key");
    }

    const secret = record.tokenKey() + baseTokenKey;
    parseJWT(token, secret);

    return record;
  }

  findCollectionById(id: string): Collection | null {
    const row = this.db()
      .query(
        "select id, name, system, type, fields, listRule, viewRule, createRule, updateRule, deleteRule, options from _collections where id = ?",
      )
      .get(id) as CollectionRow | undefined;

    if (!row) {
      return null;
    }

    return collectionFromRow(row);
  }

  findCollectionByNameOrId(identifier: string): Collection | null {
    const row = this.db()
      .query(
        "select id, name, system, type, fields, listRule, viewRule, createRule, updateRule, deleteRule, options from _collections where id = ? or name = ?",
      )
      .get(identifier, identifier) as CollectionRow | undefined;

    if (!row) {
      return null;
    }

    return collectionFromRow(row);
  }

  findRecordById(collection: Collection, id: string): RecordModel | null {
    const table = collection.name;
    if (!isSafeIdentifier(table)) {
      throw new Error(`unsafe table name ${table}`);
    }

    const row = this.db().query(`select * from "${table}" where id = ?`).get(id);
    if (!row || typeof row !== "object") {
      return null;
    }

    return new RecordModel(collection, row as RecordData);
  }
}

type CollectionRow = {
  id: string;
  name: string;
  system: number;
  type: string;
  fields: string;
  listRule: string | null;
  viewRule: string | null;
  createRule: string | null;
  updateRule: string | null;
  deleteRule: string | null;
  options: string;
};

function collectionFromRow(row: CollectionRow): Collection {
  let options: unknown = null;
  if (typeof row.options === "string") {
    try {
      options = JSON.parse(row.options);
    } catch {
      options = null;
    }
  }

  let fields: unknown = [];
  if (typeof row.fields === "string") {
    try {
      fields = JSON.parse(row.fields);
    } catch {
      fields = [];
    }
  }

  return new Collection({
    id: row.id,
    name: row.name,
    system: Boolean(row.system),
    type: row.type,
    fields: parseCollectionFields(fields),
    listRule: row.listRule ?? null,
    viewRule: row.viewRule ?? null,
    createRule: row.createRule ?? null,
    updateRule: row.updateRule ?? null,
    deleteRule: row.deleteRule ?? null,
    options: typeof options === "object" && options ? (options as Record<string, unknown>) : null,
  });
}

function resolveBaseTokenKey(collection: Collection, tokenType: string): string {
  switch (tokenType) {
    case TokenTypeAuth:
      return collection.options.authToken.secret;
    case TokenTypeFile:
      return collection.options.fileToken.secret;
    case TokenTypeVerification:
      return collection.options.verificationToken.secret;
    case TokenTypePasswordReset:
      return collection.options.passwordResetToken.secret;
    case TokenTypeEmailChange:
      return collection.options.emailChangeToken.secret;
    default:
      return "";
  }
}

function isSafeIdentifier(value: string): boolean {
  return /^[A-Za-z0-9_]+$/.test(value);
}
