// Ported from pocketbase/core/base_app.go @ v0.36.1 (9b036fb1)

import { Database } from "bun:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { App } from "./app.ts";
import { Collection } from "./collection.ts";
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
import { Record } from "./record.ts";
import { Settings } from "./settings.ts";
import { Store } from "./store.ts";
import { parseJWT, parseUnverifiedJWT } from "../tools/security/jwt.ts";

export type BaseAppConfig = {
  dataDir?: string;
};

export class BaseApp implements App {
  #dataDir: string;
  #settings: Settings;
  #store: Store<string, unknown>;
  #bootstrapped = false;
  #db: Database | null = null;
  #auxDb: Database | null = null;

  constructor(config: BaseAppConfig = {}) {
    this.#dataDir = config.dataDir ?? "pb_data";
    this.#settings = new Settings();
    this.#store = new Store();
  }

  dataDir(): string {
    return this.#dataDir;
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

    this.#db = new Database(join(this.#dataDir, "data.db"));
    this.#auxDb = new Database(join(this.#dataDir, "auxiliary.db"));
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

  runAllMigrations(): void {
    // TODO: port migration runner; no-op for now.
  }

  reloadSettings(): void {
    try {
      const row = this.db()
        .query("select value from _params where id = 'settings'")
        .get() as { value?: string } | undefined;
      if (!row?.value || typeof row.value !== "string") {
        return;
      }

      const parsed = JSON.parse(row.value) as Record<string, unknown>;
      this.#settings.loadFromJSON(parsed);
    } catch {
      // ignore missing settings table or invalid JSON
    }
  }

  findAuthRecordByToken(token: string, validTypes: string[] = []): Record {
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
      throw new Error(`invalid token type \"${tokenType}\"`);
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

  private findCollectionById(id: string): Collection | null {
    const row = this.db()
      .query("select id, name, type, options from _collections where id = ?")
      .get(id) as { id: string; name: string; type: string; options: string } | undefined;

    if (!row) {
      return null;
    }

    let options: unknown = null;
    if (typeof row.options === "string") {
      try {
        options = JSON.parse(row.options);
      } catch {
        options = null;
      }
    }

    return new Collection({
      id: row.id,
      name: row.name,
      type: row.type,
      options: typeof options === "object" && options ? (options as Record<string, unknown>) : null,
    });
  }

  private findRecordById(collection: Collection, id: string): Record | null {
    const table = collection.name;
    if (!isSafeIdentifier(table)) {
      throw new Error(`unsafe table name ${table}`);
    }

    const row = this.db().query(`select * from "${table}" where id = ?`).get(id);
    if (!row || typeof row !== "object") {
      return null;
    }

    return new Record(collection, row as Record<string, unknown>);
  }
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
