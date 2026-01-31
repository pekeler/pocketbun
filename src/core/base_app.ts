// Ported from pocketbase/core/base_app.go

import "../migrations/index.ts";
import "./fields_register.ts";

import type { Database, SQLQueryBindings } from "bun:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { App, Logger } from "./app.ts";
import { Collection, parseCollectionFields } from "./collection.ts";
import { FieldsList } from "./fields_list.ts";
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
import type { SqlExpr } from "../tools/search/types.ts";
import { Settings } from "./settings.ts";
import { Store } from "./store.ts";
import { parseJWT, parseUnverifiedJWT } from "../tools/security/jwt.ts";
import { DbxDatabase } from "../tools/dbx/database.ts";
import {
  InterceptorActionAfterDelete,
  InterceptorActionAfterDeleteError,
  InterceptorActionAfterCreate,
  InterceptorActionAfterCreateError,
  InterceptorActionAfterUpdate,
  InterceptorActionAfterUpdateError,
  InterceptorActionDelete,
  InterceptorActionDeleteExecute,
  InterceptorActionCreate,
  InterceptorActionCreateExecute,
  InterceptorActionUpdate,
  InterceptorActionUpdateExecute,
  InterceptorActionValidate,
} from "./field.ts";
import { ValidationErrors } from "../internal/compat/validation.ts";
import { DateTime, GeoPoint, JSONRaw } from "../tools/types/index.ts";
import { NewLocal } from "../tools/filesystem/filesystem.ts";

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
  #logger: Logger;
  #txInfo: TxAppInfo | null = null;

  constructor(config: BaseAppConfig = {}) {
    this.#dataDir = config.dataDir ?? "pb_data";
    this.#encryptionEnv = config.encryptionEnv ?? "";
    this.#settings = new Settings();
    this.#store = new Store();
    this.#logger = {
      Warn: (message: string, ...args: unknown[]) => {
        console.warn(message, ...args);
      },
    };
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

  Logger(): Logger {
    return this.#logger;
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

  IsTransactional(): boolean {
    return this.#txInfo !== null;
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
        "select id, name, system, type, fields, indexes, listRule, viewRule, createRule, updateRule, deleteRule, options from _collections where id = ?",
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
        "select id, name, system, type, fields, indexes, listRule, viewRule, createRule, updateRule, deleteRule, options from _collections where id = ? or name = ?",
      )
      .get(identifier, identifier) as CollectionRow | undefined;

    if (!row) {
      return null;
    }

    return collectionFromRow(row);
  }

  findRecordById(
    collection: Collection,
    id: string,
    rule: SqlExpr | null = null,
  ): RecordModel | null {
    const table = collection.name;
    if (!isSafeIdentifier(table)) {
      throw new Error(`unsafe table name ${table}`);
    }

    let sql = `select * from "${table}" where id = ?`;
    const params: SQLQueryBindings[] = [id];
    if (rule?.sql) {
      sql = appendWhere(sql, rule.sql);
      params.push(...(rule.params as SQLQueryBindings[]));
    }

    const row = this.db()
      .query(sql)
      .get(...params);
    if (!row || typeof row !== "object") {
      return null;
    }

    return RecordModel.fromRow(collection, row as RecordData);
  }

  findFirstRecordByFilter(
    collectionOrIdentifier: Collection | string,
    filter: string,
    ...params: SQLQueryBindings[]
  ): RecordModel | null {
    const collection =
      typeof collectionOrIdentifier === "string"
        ? this.findCollectionByNameOrId(collectionOrIdentifier)
        : collectionOrIdentifier;
    if (!collection) {
      return null;
    }

    let sql = `select * from {{${collection.name}}}`;
    if (filter) {
      sql = appendWhere(sql, filter);
    }

    const row = this.db()
      .query(sql)
      .get(...params);
    if (!row || typeof row !== "object") {
      return null;
    }
    return RecordModel.fromRow(collection, row as RecordData);
  }

  NewFilesystem() {
    return NewLocal(join(this.#dataDir, "storage"));
  }

  Save(record: RecordModel): Error | null {
    const action = record.IsNew() ? InterceptorActionCreate : InterceptorActionUpdate;
    const executeAction = record.IsNew()
      ? InterceptorActionCreateExecute
      : InterceptorActionUpdateExecute;
    const afterSuccess = record.IsNew() ? InterceptorActionAfterCreate : InterceptorActionAfterUpdate;
    const afterError = record.IsNew()
      ? InterceptorActionAfterCreateError
      : InterceptorActionAfterUpdateError;

    const saveErr = record.callFieldInterceptors(null, this, action, () => {
      const validateErr = record.callFieldInterceptors(null, this, InterceptorActionValidate, () =>
        this.validateRecord(record),
      );
      if (validateErr) {
        return validateErr;
      }

      return record.callFieldInterceptors(null, this, executeAction, () =>
        this.persistRecord(record),
      );
    });

    if (saveErr) {
      const afterErr = record.callFieldInterceptors(null, this, afterError, () => saveErr);
      return afterErr ?? saveErr;
    }

    if (this.#txInfo) {
      this.#txInfo.OnComplete((txErr) => {
        if (txErr) {
          if (action === InterceptorActionCreate) {
            record.markNew(true);
          }
          return record.callFieldInterceptors(null, this, afterError, () => txErr);
        }
        return record.callFieldInterceptors(null, this, afterSuccess, () => null);
      });
      return null;
    }

    const afterErr = record.callFieldInterceptors(null, this, afterSuccess, () => null);
    return afterErr ?? null;
  }

  Delete(record: RecordModel): Error | null {
    const action = InterceptorActionDelete;
    const executeAction = InterceptorActionDeleteExecute;
    const afterSuccess = InterceptorActionAfterDelete;
    const afterError = InterceptorActionAfterDeleteError;

    const deleteErr = record.callFieldInterceptors(null, this, action, () =>
      record.callFieldInterceptors(null, this, executeAction, () => this.deleteRecord(record)),
    );

    if (deleteErr) {
      const afterErr = record.callFieldInterceptors(null, this, afterError, () => deleteErr);
      return afterErr ?? deleteErr;
    }

    if (this.#txInfo) {
      this.#txInfo.OnComplete((txErr) => {
        if (txErr) {
          return record.callFieldInterceptors(null, this, afterError, () => txErr);
        }
        return record.callFieldInterceptors(null, this, afterSuccess, () => null);
      });
      return null;
    }

    const afterErr = record.callFieldInterceptors(null, this, afterSuccess, () => null);
    return afterErr ?? null;
  }

  RunInTransaction(fn: (txApp: App) => Error | null): Error | null {
    if (this.#txInfo) {
      return fn(this);
    }

    this.#txInfo = new TxAppInfo();
    let txErr: Error | null = null;
    this.db().run("BEGIN");
    try {
      txErr = fn(this) ?? null;
    } catch (error) {
      txErr = error as Error;
    }

    if (txErr) {
      this.db().run("ROLLBACK");
    } else {
      this.db().run("COMMIT");
    }

    const txInfo = this.#txInfo;
    this.#txInfo = null;
    const afterErr = txInfo.runAfterFuncs(txErr);

    if (txErr && afterErr) {
      return new Error(`${txErr.message}; ${afterErr.message}`);
    }
    if (txErr) {
      return txErr;
    }
    if (afterErr) {
      return afterErr;
    }
    return null;
  }

  private validateRecord(record: RecordModel): Error | null {
    const errors: Record<string, Error> = {};
    for (const field of record.collection().Fields) {
      const err = field.ValidateValue(null, this, record);
      if (err) {
        errors[field.GetName()] = err;
      }
    }
    return Object.keys(errors).length > 0 ? new ValidationErrors(errors) : null;
  }

  private persistRecord(record: RecordModel): Error | null {
    let data: Record<string, unknown>;
    try {
      data = record.DBExport();
    } catch (error) {
      return error as Error;
    }

    if (!("id" in data) || !data.id) {
      data.id = record.Id;
    }
    if (!data.id) {
      return new Error("empty primary key is not allowed");
    }

    const keys = Object.keys(data);
    if (record.IsNew()) {
      const columns = keys.map((key) => `"${key}"`).join(", ");
      const placeholders = keys.map(() => "?").join(", ");
      const values = keys.map((key) => normalizeDbValue(data[key]));
      const sql = `insert into "${record.TableName()}" (${columns}) values (${placeholders})`;
      this.db().run(sql, values);
    } else {
      const columns = keys.filter((key) => key !== "id");
      if (columns.length > 0) {
        const assignments = columns.map((key) => `"${key}" = ?`).join(", ");
        const values = columns.map((key) => normalizeDbValue(data[key]));
        values.push(record.Id);
        const sql = `update "${record.TableName()}" set ${assignments} where id = ?`;
        this.db().run(sql, values);
      }
    }

    return record.PostScan();
  }

  private deleteRecord(record: RecordModel): Error | null {
    if (!record.Id) {
      return new Error("missing record id");
    }
    this.db().run(`delete from {{${record.TableName()}}} where id = ?`, [record.Id]);
    return null;
  }
}

function appendWhere(baseSql: string, clause: string): string {
  if (!clause) {
    return baseSql;
  }
  if (/\bwhere\b/i.test(baseSql)) {
    return `${baseSql} AND ${clause}`;
  }
  return `${baseSql} WHERE ${clause}`;
}

type CollectionRow = {
  id: string;
  name: string;
  system: number;
  type: string;
  fields: string;
  indexes: string;
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
  let fieldsList = new FieldsList();
  if (typeof row.fields === "string") {
    try {
      fields = JSON.parse(row.fields);
    } catch {
      fields = [];
    }
    try {
      fieldsList = FieldsList.fromJSON(row.fields);
    } catch {
      fieldsList = new FieldsList();
    }
  }

  let indexes: unknown = [];
  if (typeof row.indexes === "string") {
    try {
      indexes = JSON.parse(row.indexes);
    } catch {
      indexes = [];
    }
  }

  return new Collection({
    id: row.id,
    name: row.name,
    system: Boolean(row.system),
    type: row.type,
    fields: parseCollectionFields(fields),
    Fields: fieldsList,
    indexes: Array.isArray(indexes)
      ? (indexes.filter((value) => typeof value === "string") as string[])
      : [],
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

class TxAppInfo {
  #afterFuncs: Array<(txErr: Error | null) => Error | null> = [];

  OnComplete(fn: (txErr: Error | null) => Error | null) {
    this.#afterFuncs.push(fn);
  }

  runAfterFuncs(txErr: Error | null): Error | null {
    const errors: Error[] = [];
    for (const fn of this.#afterFuncs) {
      const err = fn(txErr);
      if (err) {
        errors.push(err);
      }
    }
    this.#afterFuncs = [];

    if (errors.length === 0) {
      return null;
    }
    if (errors.length === 1) {
      return errors[0] ?? null;
    }
    return new Error(errors.map((err) => err.message).join("; "));
  }
}

function normalizeDbValue(value: unknown): SQLQueryBindings {
  if (value == null) {
    return null;
  }
  if (value instanceof JSONRaw) {
    return value.toString();
  }
  if (value instanceof DateTime) {
    return value.toString();
  }
  if (value instanceof GeoPoint) {
    return value.toString();
  }
  if (value instanceof Uint8Array) {
    return value;
  }
  if (Array.isArray(value)) {
    return JSON.stringify(value);
  }
  if (typeof value === "object") {
    const hasToJSON = (value as { toJSON?: () => unknown }).toJSON;
    if (typeof hasToJSON === "function") {
      return JSON.stringify(hasToJSON.call(value));
    }
    return JSON.stringify(value);
  }
  return value as SQLQueryBindings;
}


function isSafeIdentifier(value: string): boolean {
  return /^[A-Za-z0-9_]+$/.test(value);
}
