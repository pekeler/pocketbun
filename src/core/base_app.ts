// Ported from pocketbase/core/base_app.go

import "../migrations/index.ts";
import "./fields_register.ts";

import type { Database, SQLQueryBindings } from "bun:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { App, Logger } from "./app.ts";
import {
  Collection,
  NewAuthCollection,
  NewBaseCollection,
  NewViewCollection,
  parseCollectionFields,
} from "./collection.ts";
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
import { Hook } from "../tools/hook/hook.ts";
import { parseIndex } from "../tools/dbutils/index.ts";
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
import { ValidationErrors, newError, required } from "../internal/compat/validation.ts";
import { DateTime, GeoPoint, JSONRaw, NowDateTime } from "../tools/types/index.ts";
import { NewLocal } from "../tools/filesystem/filesystem.ts";
import { randomString } from "../tools/security/random.ts";
import type {
  CollectionRequestEvent,
  CollectionsImportRequestEvent,
  CollectionsListRequestEvent,
} from "./events.ts";

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
  #onCollectionsListRequest: Hook<CollectionsListRequestEvent>;
  #onCollectionViewRequest: Hook<CollectionRequestEvent>;
  #onCollectionCreateRequest: Hook<CollectionRequestEvent>;
  #onCollectionUpdateRequest: Hook<CollectionRequestEvent>;
  #onCollectionDeleteRequest: Hook<CollectionRequestEvent>;
  #onCollectionsImportRequest: Hook<CollectionsImportRequestEvent>;

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
    this.#onCollectionsListRequest = new Hook();
    this.#onCollectionViewRequest = new Hook();
    this.#onCollectionCreateRequest = new Hook();
    this.#onCollectionUpdateRequest = new Hook();
    this.#onCollectionDeleteRequest = new Hook();
    this.#onCollectionsImportRequest = new Hook();
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

  OnCollectionsListRequest(): Hook<CollectionsListRequestEvent> {
    return this.#onCollectionsListRequest;
  }

  OnCollectionViewRequest(): Hook<CollectionRequestEvent> {
    return this.#onCollectionViewRequest;
  }

  OnCollectionCreateRequest(): Hook<CollectionRequestEvent> {
    return this.#onCollectionCreateRequest;
  }

  OnCollectionUpdateRequest(): Hook<CollectionRequestEvent> {
    return this.#onCollectionUpdateRequest;
  }

  OnCollectionDeleteRequest(): Hook<CollectionRequestEvent> {
    return this.#onCollectionDeleteRequest;
  }

  OnCollectionsImportRequest(): Hook<CollectionsImportRequestEvent> {
    return this.#onCollectionsImportRequest;
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

  Save(model: RecordModel | Collection): Error | null {
    if (model instanceof RecordModel) {
      const action = model.IsNew() ? InterceptorActionCreate : InterceptorActionUpdate;
      const executeAction = model.IsNew()
        ? InterceptorActionCreateExecute
        : InterceptorActionUpdateExecute;
      const afterSuccess = model.IsNew() ? InterceptorActionAfterCreate : InterceptorActionAfterUpdate;
      const afterError = model.IsNew()
        ? InterceptorActionAfterCreateError
        : InterceptorActionAfterUpdateError;

      const saveErr = model.callFieldInterceptors(null, this, action, () => {
        const validateErr = model.callFieldInterceptors(null, this, InterceptorActionValidate, () =>
          this.validateRecord(model),
        );
        if (validateErr) {
          return validateErr;
        }

        return model.callFieldInterceptors(null, this, executeAction, () =>
          this.persistRecord(model),
        );
      });

      if (saveErr) {
        const afterErr = model.callFieldInterceptors(null, this, afterError, () => saveErr);
        return afterErr ?? saveErr;
      }

      if (this.#txInfo) {
        this.#txInfo.OnComplete((txErr) => {
          if (txErr) {
            if (action === InterceptorActionCreate) {
              model.markNew(true);
            }
            return model.callFieldInterceptors(null, this, afterError, () => txErr);
          }
          return model.callFieldInterceptors(null, this, afterSuccess, () => null);
        });
        return null;
      }

      const afterErr = model.callFieldInterceptors(null, this, afterSuccess, () => null);
      return afterErr ?? null;
    }

    return this.saveCollection(model);
  }

  Delete(model: RecordModel | Collection): Error | null {
    if (model instanceof RecordModel) {
      const action = InterceptorActionDelete;
      const executeAction = InterceptorActionDeleteExecute;
      const afterSuccess = InterceptorActionAfterDelete;
      const afterError = InterceptorActionAfterDeleteError;

      const deleteErr = model.callFieldInterceptors(null, this, action, () =>
        model.callFieldInterceptors(null, this, executeAction, () => this.deleteRecord(model)),
      );

      if (deleteErr) {
        const afterErr = model.callFieldInterceptors(null, this, afterError, () => deleteErr);
        return afterErr ?? deleteErr;
      }

      if (this.#txInfo) {
        this.#txInfo.OnComplete((txErr) => {
          if (txErr) {
            return model.callFieldInterceptors(null, this, afterError, () => txErr);
          }
          return model.callFieldInterceptors(null, this, afterSuccess, () => null);
        });
        return null;
      }

      const afterErr = model.callFieldInterceptors(null, this, afterSuccess, () => null);
      return afterErr ?? null;
    }

    return this.deleteCollection(model);
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

  TruncateCollection(collection: Collection): Error | null {
    if (collection.isView()) {
      return new Error("view collections cannot be truncated");
    }
    this.db().run(`delete from "{{${collection.name}}}"`);
    return null;
  }

  ImportCollections(toImport: Array<Record<string, unknown>>, deleteMissing: boolean): Error | null {
    return this.RunInTransaction((txApp) => {
      const names = new Set<string>();
      for (const data of toImport) {
        const imported = collectionFromData(data);
        names.add(imported.name);
        const err = txApp.Save(imported);
        if (err) {
          return err;
        }
      }

      if (deleteMissing) {
        const existing = this.db()
          .query("select id, name, system from _collections")
          .all() as Array<{ id: string; name: string; system: number }>;
        for (const row of existing) {
          if (row.system) {
            continue;
          }
          if (!names.has(row.name)) {
            const collection = this.findCollectionById(row.id);
            if (collection) {
              const err = txApp.Delete(collection);
              if (err) {
                return err;
              }
            }
          }
        }
      }

      return null;
    });
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

  private saveCollection(collection: Collection): Error | null {
    const original = collection.isNew() ? null : this.findCollectionById(collection.id);

    normalizeCollectionFields(collection);
    ensureDefaultCollectionFields(collection);

    const validationErr = this.validateCollection(collection, original);
    if (validationErr) {
      return validationErr;
    }

    if (collection.isNew()) {
      if (!collection.id) {
        collection.id = generateCollectionId(collection.type, collection.name);
      }
      collection.id = ensureUniqueCollectionId(this.db(), collection.id, collection.type, collection.name);
    }

    const fieldsJson = JSON.stringify(collection.Fields.toJSON());
    const indexesJson = JSON.stringify(collection.indexes ?? []);
    const optionsJson = JSON.stringify(collection.options ?? {});
    const now = NowDateTime().toString();

    if (collection.isNew()) {
      this.db().run(
        `insert into _collections
          (id, system, type, name, fields, indexes, listRule, viewRule, createRule, updateRule, deleteRule, options, created, updated)
         values
          (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          collection.id,
          collection.system ? 1 : 0,
          collection.type,
          collection.name,
          fieldsJson,
          indexesJson,
          collection.listRule ?? null,
          collection.viewRule ?? null,
          collection.createRule ?? null,
          collection.updateRule ?? null,
          collection.deleteRule ?? null,
          optionsJson,
          now,
          now,
        ],
      );
      collection.markNew(false);
    } else {
      this.db().run(
        `update _collections
          set system = ?, type = ?, name = ?, fields = ?, indexes = ?, listRule = ?, viewRule = ?, createRule = ?, updateRule = ?, deleteRule = ?, options = ?, updated = ?
         where id = ?`,
        [
          collection.system ? 1 : 0,
          collection.type,
          collection.name,
          fieldsJson,
          indexesJson,
          collection.listRule ?? null,
          collection.viewRule ?? null,
          collection.createRule ?? null,
          collection.updateRule ?? null,
          collection.deleteRule ?? null,
          optionsJson,
          now,
          collection.id,
        ],
      );
    }

    const syncErr = this.syncRecordTableSchema(collection, original);
    if (syncErr) {
      return syncErr;
    }

    return null;
  }

  private deleteCollection(collection: Collection): Error | null {
    if (collection.system) {
      return new Error("system collection cannot be deleted");
    }
    if (collection.id === "") {
      return new Error("missing collection id");
    }

    const dropErr = this.dropCollectionIndexes(collection);
    if (dropErr) {
      return dropErr;
    }

    if (!collection.isView()) {
      this.db().run(`drop table if exists "{{${collection.name}}}"`);
    }

    this.db().run("delete from _collections where id = ?", [collection.id]);
    return null;
  }

  private validateCollection(collection: Collection, original: Collection | null): Error | null {
    const errors: Record<string, Error> = {};

    if (required(collection.name)) {
      errors.name = required(collection.name) ?? newError("validation_required", "Cannot be blank.");
    } else if (!/^\w+$/.test(collection.name)) {
      errors.name = newError("validation_invalid_collection_name", "Invalid collection name.");
    } else if (!this.isCollectionNameUnique(collection.name, original?.id)) {
      errors.name = newError(
        "validation_collection_name_exists",
        "Collection name must be unique (case insensitive).",
      );
    }

    if (!collection.type || !["base", "auth", "view"].includes(collection.type)) {
      errors.type = newError("validation_invalid_collection_type", "Invalid collection type.");
    }

    const fieldErrors: Record<string, Error> = {};
    const seenIds = new Set<string>();
    const seenNames = new Set<string>();
    collection.Fields.forEach((field, index) => {
      const id = field.GetId();
      if (id && seenIds.has(id)) {
        fieldErrors[String(index)] = new ValidationErrors({
          id: newError(
            "validation_duplicated_field_id",
            `Duplicated or invalid field id "${id}"`,
          ),
        });
        return;
      }
      seenIds.add(id);

      const nameLower = field.GetName().toLowerCase();
      if (nameLower && seenNames.has(nameLower)) {
        const err = newError(
          "validation_duplicated_field_name",
          "Duplicated or invalid field name {{.fieldName}}",
        ).setParams({ fieldName: field.GetName() });
        fieldErrors[String(index)] = new ValidationErrors({ name: err });
        return;
      }
      seenNames.add(nameLower);

      const err = field.ValidateSettings(null, this, collection);
      if (err) {
        fieldErrors[String(index)] = err;
      }
    });

    if (Object.keys(fieldErrors).length > 0) {
      errors.fields = new ValidationErrors(fieldErrors);
    }

    return Object.keys(errors).length > 0 ? new ValidationErrors(errors) : null;
  }

  private syncRecordTableSchema(newCollection: Collection, oldCollection: Collection | null): Error | null {
    if (newCollection.isView()) {
      return null;
    }

    return this.RunInTransaction((txApp) => {
      const db = (txApp as BaseApp).db();
      const hasOldTable = oldCollection ? (txApp as BaseApp).hasTable(oldCollection.name) : false;

      if (!hasOldTable) {
        const columns = newCollection.Fields.map(
          (field) => `"${field.GetName()}" ${field.ColumnType(txApp)}`,
        );
        db.run(`create table if not exists "{{${newCollection.name}}}" (${columns.join(", ")})`);
        return (txApp as BaseApp).createCollectionIndexes(newCollection);
      }

      const oldTableName = oldCollection?.name ?? newCollection.name;
      const newTableName = newCollection.name;
      if (oldTableName !== newTableName) {
        db.run(`alter table "{{${oldTableName}}}" rename to "{{${newTableName}}}"`);
      }

      const oldFields = oldCollection?.Fields ?? new FieldsList();
      const newFields = newCollection.Fields;

      for (const oldField of oldFields) {
        if (!newFields.GetById(oldField.GetId())) {
          db.run(`alter table "{{${newTableName}}}" drop column "${oldField.GetName()}"`);
        }
      }

      const toRename: Record<string, string> = {};
      for (const field of newFields) {
        const oldField = oldFields.GetById(field.GetId());
        if (!oldField) {
          const tempName = `${field.GetName()}${randomString(5)}`;
          toRename[tempName] = field.GetName();
          db.run(
            `alter table "{{${newTableName}}}" add column "${tempName}" ${field.ColumnType(txApp)}`,
          );
        } else if (oldField.GetName() !== field.GetName()) {
          const tempName = `${field.GetName()}${randomString(5)}`;
          toRename[tempName] = field.GetName();
          db.run(
            `alter table "{{${newTableName}}}" rename column "${oldField.GetName()}" to "${tempName}"`,
          );
        }
      }

      for (const [tempName, actualName] of Object.entries(toRename)) {
        db.run(
          `alter table "{{${newTableName}}}" rename column "${tempName}" to "${actualName}"`,
        );
      }

      // Deviation: single vs multiple field migration and view resave are not implemented yet.

      return (txApp as BaseApp).createCollectionIndexes(newCollection);
    });
  }

  private createCollectionIndexes(collection: Collection): Error | null {
    for (const index of collection.indexes ?? []) {
      if (!index) {
        continue;
      }
      this.db().run(index);
    }
    return null;
  }

  private dropCollectionIndexes(collection: Collection): Error | null {
    for (const index of collection.indexes ?? []) {
      const parsed = parseIndex(index);
      if (!parsed.indexName) {
        continue;
      }
      this.db().run(`drop index if exists \`${parsed.indexName}\``);
    }
    return null;
  }

  private hasTable(name: string): boolean {
    const row = this.db()
      .query("select name from sqlite_master where type='table' and name = ?")
      .get(name) as { name?: string } | undefined;
    return Boolean(row?.name);
  }

  private isCollectionNameUnique(name: string, excludeId?: string): boolean {
    const row = this.db()
      .query("select id from _collections where lower(name) = lower(?)")
      .get(name) as { id?: string } | undefined;
    if (!row?.id) {
      return true;
    }
    if (excludeId && row.id === excludeId) {
      return true;
    }
    return false;
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

function normalizeCollectionFields(collection: Collection): void {
  if (collection.Fields.length === 0 && collection.fields.length > 0) {
    try {
      collection.Fields = FieldsList.fromJSON(JSON.stringify(collection.fields));
    } catch {
      collection.Fields = new FieldsList();
    }
  }

  if (collection.Fields.length > 0) {
    collection.fields = parseCollectionFields(collection.Fields.toJSON());
  }
}

function ensureDefaultCollectionFields(collection: Collection): void {
  let defaults: Collection;
  if (collection.isAuth()) {
    defaults = NewAuthCollection(collection.name, collection.id);
  } else if (collection.isView()) {
    defaults = NewViewCollection(collection.name, collection.id);
  } else {
    defaults = NewBaseCollection(collection.name, collection.id);
  }

  const merged = new FieldsList();
  merged.Add(...defaults.Fields);
  merged.Add(...collection.Fields);
  collection.Fields = merged;
  collection.fields = parseCollectionFields(collection.Fields.toJSON());
}

function collectionFromData(data: Record<string, unknown>): Collection {
  const name = typeof data.name === "string" ? data.name : "";
  const type = typeof data.type === "string" ? data.type : "base";

  let collection: Collection;
  if (type === "auth") {
    collection = NewAuthCollection(name);
  } else if (type === "view") {
    collection = NewViewCollection(name);
  } else {
    collection = NewBaseCollection(name);
  }

  if (typeof data.id === "string") {
    collection.id = data.id;
  }
  if (typeof data.system === "boolean") {
    collection.system = data.system;
  } else if (typeof data.system === "number") {
    collection.system = Boolean(data.system);
  }

  if (Array.isArray(data.fields)) {
    try {
      collection.Fields = FieldsList.fromJSON(JSON.stringify(data.fields));
    } catch {
      collection.Fields = new FieldsList();
    }
  }

  if (Array.isArray(data.indexes)) {
    collection.indexes = data.indexes.filter((item) => typeof item === "string") as string[];
  }

  collection.listRule = typeof data.listRule === "string" ? data.listRule : collection.listRule;
  collection.viewRule = typeof data.viewRule === "string" ? data.viewRule : collection.viewRule;
  collection.createRule =
    typeof data.createRule === "string" ? data.createRule : collection.createRule;
  collection.updateRule =
    typeof data.updateRule === "string" ? data.updateRule : collection.updateRule;
  collection.deleteRule =
    typeof data.deleteRule === "string" ? data.deleteRule : collection.deleteRule;

  const options = typeof data.options === "object" && data.options ? (data.options as Record<string, unknown>) : null;
  if (collection.isAuth() && options) {
    applyAuthTokenOptions(collection, options);
  }

  normalizeCollectionFields(collection);
  ensureDefaultCollectionFields(collection);

  return collection;
}

function applyAuthTokenOptions(collection: Collection, options: Record<string, unknown>): void {
  if (!collection.options) {
    return;
  }
  const authToken = options.authToken as { secret?: unknown; duration?: unknown } | undefined;
  if (authToken) {
    if (typeof authToken.secret === "string") {
      collection.options.authToken.secret = authToken.secret;
    }
    if (typeof authToken.duration === "number") {
      collection.options.authToken.duration = authToken.duration;
    }
  }
  const fileToken = options.fileToken as { secret?: unknown; duration?: unknown } | undefined;
  if (fileToken) {
    if (typeof fileToken.secret === "string") {
      collection.options.fileToken.secret = fileToken.secret;
    }
    if (typeof fileToken.duration === "number") {
      collection.options.fileToken.duration = fileToken.duration;
    }
  }
  const verificationToken = options.verificationToken as
    | { secret?: unknown; duration?: unknown }
    | undefined;
  if (verificationToken) {
    if (typeof verificationToken.secret === "string") {
      collection.options.verificationToken.secret = verificationToken.secret;
    }
    if (typeof verificationToken.duration === "number") {
      collection.options.verificationToken.duration = verificationToken.duration;
    }
  }
  const passwordResetToken = options.passwordResetToken as
    | { secret?: unknown; duration?: unknown }
    | undefined;
  if (passwordResetToken) {
    if (typeof passwordResetToken.secret === "string") {
      collection.options.passwordResetToken.secret = passwordResetToken.secret;
    }
    if (typeof passwordResetToken.duration === "number") {
      collection.options.passwordResetToken.duration = passwordResetToken.duration;
    }
  }
  const emailChangeToken = options.emailChangeToken as
    | { secret?: unknown; duration?: unknown }
    | undefined;
  if (emailChangeToken) {
    if (typeof emailChangeToken.secret === "string") {
      collection.options.emailChangeToken.secret = emailChangeToken.secret;
    }
    if (typeof emailChangeToken.duration === "number") {
      collection.options.emailChangeToken.duration = emailChangeToken.duration;
    }
  }
}

function generateCollectionId(type: string, name: string): string {
  return `pbc_${crc32(type + name)}`;
}

function ensureUniqueCollectionId(
  db: Database,
  id: string,
  type: string,
  name: string,
): string {
  let candidate = id;
  for (let i = 2; i < 1000; i += 1) {
    const row = db
      .query("select id from _collections where id = ?")
      .get(candidate) as { id?: string } | undefined;
    if (!row?.id) {
      break;
    }
    candidate = `${generateCollectionId(type, name)}${i}`;
  }
  return candidate;
}

function crc32(input: string): number {
  let crc = 0xffffffff;
  for (let i = 0; i < input.length; i += 1) {
    crc ^= input.charCodeAt(i);
    for (let j = 0; j < 8; j += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return ~crc >>> 0;
}
