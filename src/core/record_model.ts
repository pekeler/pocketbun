// Ported from pocketbase/core/record_model.go

import type { DriverValuer, Field, GetterFinder, RecordInterceptor, SetterFinder } from "./field.ts";
import type { FileField } from "./field_file.ts";
import { toBoolValue, toNumberValue, toStringValue } from "../internal/compat/cast.ts";
import { toUniqueStringSlice } from "../tools/list/list.ts";
import { Store } from "../tools/store/store.ts";
import { GeoPoint, ParseDateTime } from "../tools/types/index.ts";
import { Collection, CollectionNameSuperusers } from "./collection_model.ts";
import { attachRecordAuthMethods } from "./record_model_auth.ts";

export type RecordData = { [key: string]: unknown };

export type RecordExportOptions = {
  includeHidden?: boolean;
  ignoreEmailVisibility?: boolean;
};

export const FieldNameId = "id";
export const FieldNamePassword = "password";
export const FieldNameTokenKey = "tokenKey";
export const FieldNameEmailVisibility = "emailVisibility";
export const FieldNameEmail = "email";
export const FieldNameVerified = "verified";
export const FieldNameCollectionId = "collectionId";
export const FieldNameCollectionName = "collectionName";
export const FieldNameExpand = "expand";
export const RecordModelTypeHookTag = "__pb_record_model__";

export const internalCustomFieldKeyPrefix = "@pbInternal";

export class Record {
  id: string;
  #collection: Collection;
  #data: RecordData;
  #originalData: RecordData;
  #isNew: boolean;
  #exportCustomData = false;
  #ignoreEmailVisibility = false;
  #ignoreUnchangedFields = false;
  #customVisibility = new Store<string, boolean>();
  #expand: Store<string, unknown> | null = null;
  #hookTags: string[] | null = null;
  #fieldInterceptors: RecordInterceptor[] | null = null;

  static fromRow(collection: Collection, row: RecordData): Record {
    const record = new Record(collection, {}, false);
    record.#data = {};
    record.#originalData = {};

    for (const field of collection.Fields) {
      const name = field.GetName();
      const raw = Object.prototype.hasOwnProperty.call(row, name) ? normalizeRowValue(row[name]) : null;
      const prepared = field.PrepareValue(record, raw);
      record.#originalData[name] = prepared;
      if (name === FieldNameId) {
        record.id = toStringValue(prepared);
      }
    }

    return record;
  }

  constructor(collection: Collection, data: RecordData = {}, isNew = false) {
    this.#collection = collection;
    this.#data = {};
    this.#originalData = {};
    this.id = "";
    this.#isNew = isNew;

    if (isNew) {
      for (const field of collection.Fields) {
        const name = field.GetName();
        if (name === FieldNameId) {
          continue;
        }
        const prepared = field.PrepareValue(this, null);
        this.#originalData[name] = prepared;
        // Deviation: mirror defaults into #data to emulate Go's store.GetOk fallback behavior.
        this.#data[name] = prepared;
      }

      this.Load(data);
      return;
    }

    this.#data = { ...data };
    this.#originalData = { ...data };
    this.id = typeof data.id === "string" ? data.id : "";
  }

  collection(): Collection {
    return this.#collection;
  }

  get Id(): string {
    return this.id;
  }

  set Id(value: string) {
    this.id = toStringValue(value);
    this.#data.id = this.id;
  }

  getRawDataValue(field: string): unknown {
    return this.#data[field];
  }

  getRawDataBool(field: string): boolean {
    return Boolean(this.#data[field]);
  }

  GetRaw(field: string): unknown {
    if (Object.prototype.hasOwnProperty.call(this.#data, field)) {
      const value = this.#data[field];
      if (value !== undefined) {
        return value;
      }
    }
    if (field === FieldNameId) {
      return this.id;
    }
    if (field === FieldNameExpand) {
      return this.Expand();
    }
    return this.#originalData[field];
  }

  getRaw(field: string): unknown {
    return this.GetRaw(field);
  }

  SetRaw(field: string, value: unknown): void {
    if (field === FieldNameExpand) {
      if (value && typeof value === "object") {
        this.SetExpand(value as RecordData);
      } else {
        this.SetExpand(null);
      }
      return;
    }
    this.#data[field] = value;
    if (field === FieldNameId) {
      this.id = toStringValue(value);
    }
  }

  setRaw(field: string, value: unknown): void {
    this.SetRaw(field, value);
  }

  IsNew(): boolean {
    return this.#isNew;
  }

  markNew(value = true): void {
    this.#isNew = value;
  }

  PostScan(): Error | null {
    if (!this.id) {
      return new Error("missing record primary key");
    }
    this.#originalData = { ...this.#originalData, ...this.#data };
    this.#data = {};
    this.#isNew = false;
    return null;
  }

  Get(field: string): unknown {
    if (field === FieldNameExpand) {
      return this.Expand();
    }

    for (const f of this.#collection.Fields) {
      const finder = f as unknown as GetterFinder;
      if (typeof finder.FindGetter !== "function") {
        continue;
      }
      const getter = finder.FindGetter(field);
      if (getter) {
        return getter(this);
      }
    }

    return this.GetRaw(field);
  }

  get(field: string): unknown {
    return this.Get(field);
  }

  GetBool(field: string): boolean {
    return toBoolValue(this.Get(field));
  }

  getBool(field: string): boolean {
    return this.GetBool(field);
  }

  GetString(field: string): string {
    return toStringValue(this.Get(field));
  }

  getString(field: string): string {
    return this.GetString(field);
  }

  GetInt(field: string): number {
    return Math.trunc(toNumberValue(this.Get(field)));
  }

  getInt(field: string): number {
    return this.GetInt(field);
  }

  // GetInt64 returns the data value for "field" as an int64.
  // JavaScript numbers cannot distinguish Go's int and int64 ranges, so this
  // compatibility helper intentionally has the same runtime result as GetInt.
  GetInt64(field: string): number {
    return this.GetInt(field);
  }

  getInt64(field: string): number {
    return this.GetInt64(field);
  }

  GetFloat(field: string): number {
    return toNumberValue(this.Get(field));
  }

  getFloat(field: string): number {
    return this.GetFloat(field);
  }

  GetDateTime(field: string) {
    return ParseDateTime(this.Get(field));
  }

  getDateTime(field: string) {
    return this.GetDateTime(field);
  }

  GetGeoPoint(field: string): GeoPoint {
    const point = new GeoPoint();
    void point.Scan(this.Get(field));
    return point;
  }

  getGeoPoint(field: string): GeoPoint {
    return this.GetGeoPoint(field);
  }

  GetStringSlice(field: string): string[] {
    return toUniqueStringSlice(this.Get(field));
  }

  getStringSlice(field: string): string[] {
    return this.GetStringSlice(field);
  }

  GetUnsavedFiles(key: string): unknown[] {
    const normalizedKey = key.endsWith(":unsaved") ? key : `${key}:unsaved`;
    const value = this.Get(normalizedKey);
    return Array.isArray(value) ? value : [];
  }

  getUnsavedFiles(key: string): unknown[] {
    return this.GetUnsavedFiles(key);
  }

  GetUploadedFiles(key: string): unknown[] {
    console.warn("Please replace GetUploadedFiles with GetUnsavedFiles");
    return this.GetUnsavedFiles(key);
  }

  getUploadedFiles(key: string): unknown[] {
    return this.GetUploadedFiles(key);
  }

  UnmarshalJSONField(key: string, result: unknown): Error | null {
    try {
      const parsed = JSON.parse(this.GetString(key));
      if (result && typeof result === "object" && parsed && typeof parsed === "object") {
        Object.assign(result as RecordData, parsed as RecordData);
      }
      return null;
    } catch (error) {
      return error as Error;
    }
  }

  unmarshalJSONField(key: string, result: unknown): void {
    const err = this.UnmarshalJSONField(key, result);
    if (err) {
      throw err;
    }
  }

  Set(field: string, value: unknown): void {
    if (field === FieldNameExpand) {
      this.SetRaw(field, value);
      return;
    }

    const found = this.SetIfFieldExists(field, value);
    if (!found) {
      this.SetRaw(field, value);
    }
  }

  set(field: string, value: unknown): void {
    this.Set(field, value);
  }

  Load(data: RecordData): void {
    for (const [key, value] of Object.entries(data)) {
      this.Set(key, value);
    }
  }

  LastSavedPK(): string {
    const pk = this.#originalData.id;
    return typeof pk === "string" ? pk : "";
  }

  PK(): string {
    return this.Id;
  }

  MarkAsNew(): void {
    this.markNew(true);
  }

  MarkAsNotNew(): void {
    this.markNew(false);
  }

  Original(): Record {
    // Deviation: Original() immediately overwrites the constructor-managed
    // record state, so avoid the heavier isNew=true field-default initialization.
    const original = new Record(this.#collection, {}, false);
    original.#data = {};
    original.#originalData = { ...this.#originalData };
    const savedId = typeof original.#originalData.id === "string" ? original.#originalData.id : "";
    if (savedId) {
      original.id = savedId;
      original.#isNew = false;
    } else {
      original.id = "";
      original.#isNew = true;
    }
    return original;
  }

  Fresh(): Record {
    const fresh = this.Original();

    for (const field of this.#collection.Fields) {
      const name = field.GetName();
      fresh.SetRaw(name, this.GetRaw(name));
    }

    return fresh;
  }

  Clone(): Record {
    const clone = this.Original();
    clone.#data = { ...this.#data };
    clone.#exportCustomData = this.#exportCustomData;
    clone.#ignoreEmailVisibility = this.#ignoreEmailVisibility;
    clone.#ignoreUnchangedFields = this.#ignoreUnchangedFields;
    clone.#customVisibility.reset(Object.fromEntries(this.#customVisibility.getAll()));
    if (this.#expand) {
      clone.SetExpand(Object.fromEntries(this.#expand.getAll()));
    }
    clone.Id = this.id;
    return clone;
  }

  FieldsData(): RecordData {
    const result: RecordData = {};
    for (const field of this.#collection.Fields) {
      const name = field.GetName();
      result[name] = this.Get(name);
    }
    return result;
  }

  CustomData(): RecordData {
    const result: RecordData = {};
    const knownFields = new Set<string>();
    for (const field of this.#collection.Fields) {
      knownFields.add(field.GetName());
    }

    const merged = { ...this.#originalData, ...this.#data };
    for (const [key, value] of Object.entries(merged)) {
      if (knownFields.has(key)) {
        continue;
      }
      if (key.startsWith(internalCustomFieldKeyPrefix)) {
        continue;
      }
      result[key] = value;
    }

    return result;
  }

  Expand(): RecordData {
    if (!this.#expand) {
      return {};
    }
    return Object.fromEntries(this.#expand.getAll());
  }

  HasExpand(): boolean {
    return this.#expand !== null;
  }

  SetExpand(expand: RecordData | null): void {
    if (!this.#expand) {
      this.#expand = new Store<string, unknown>();
    }
    this.#expand.reset(expand ?? {});
  }

  MergeExpand(expand: RecordData): void {
    if (!expand || Object.keys(expand).length === 0) {
      return;
    }

    if (!this.#expand) {
      this.#expand = new Store(expand);
      return;
    }

    const oldExpand = Object.fromEntries(this.#expand.getAll()) as RecordData;

    for (const [key, next] of Object.entries(expand)) {
      const old = oldExpand[key];
      if (!old) {
        oldExpand[key] = next;
        continue;
      }

      let wasOldSlice = false;
      let oldSlice: Record[] = [];
      if (old instanceof Record) {
        oldSlice = [old];
      } else if (Array.isArray(old)) {
        wasOldSlice = true;
        oldSlice = old.filter((item): item is Record => item instanceof Record);
      } else {
        oldExpand[key] = next;
        continue;
      }

      let wasNewSlice = false;
      let newSlice: Record[] = [];
      if (next instanceof Record) {
        newSlice = [next];
      } else if (Array.isArray(next)) {
        wasNewSlice = true;
        newSlice = next.filter((item): item is Record => item instanceof Record);
      } else {
        continue;
      }

      const oldIndexed = new Map<string, Record>();
      for (const oldRecord of oldSlice) {
        oldIndexed.set(oldRecord.Id, oldRecord);
      }

      for (const newRecord of newSlice) {
        const oldRecord = oldIndexed.get(newRecord.Id);
        if (oldRecord) {
          oldRecord.MergeExpand(newRecord.Expand());
        } else {
          oldSlice.push(newRecord);
        }
      }

      if (wasOldSlice || wasNewSlice || oldSlice.length === 0) {
        oldExpand[key] = oldSlice;
      } else {
        oldExpand[key] = oldSlice[0];
      }
    }

    this.#expand.reset(oldExpand);
  }

  ExpandedOne(relField: string): Record | null {
    const rel = this.#expand?.get(relField);
    if (rel instanceof Record) {
      return rel;
    }
    if (Array.isArray(rel)) {
      return rel.find((item): item is Record => item instanceof Record) ?? null;
    }
    return null;
  }

  expandedOne(relField: string): Record | null {
    return this.ExpandedOne(relField);
  }

  ExpandedAll(relField: string): Record[] {
    const rel = this.#expand?.get(relField);
    if (rel instanceof Record) {
      return [rel];
    }
    if (Array.isArray(rel)) {
      return rel.filter((item): item is Record => item instanceof Record);
    }
    return [];
  }

  expandedAll(relField: string): Record[] {
    return this.ExpandedAll(relField);
  }

  FindFileFieldByFile(filename: string): FileField | null {
    for (const field of this.#collection.Fields) {
      if (field.Type() !== "file") {
        continue;
      }

      const fileField = field as FileField;
      const filenames = this.GetStringSlice(fileField.GetName());
      if (filenames.includes(filename)) {
        return fileField;
      }
    }

    return null;
  }

  Hide(...fieldNames: string[]): this {
    for (const name of fieldNames) {
      this.#customVisibility.set(name, false);
    }
    return this;
  }

  Unhide(...fieldNames: string[]): this {
    for (const name of fieldNames) {
      this.#customVisibility.set(name, true);
    }
    return this;
  }

  WithCustomData(state: boolean): this {
    this.#exportCustomData = state;
    return this;
  }

  IgnoreEmailVisibility(state: boolean): this {
    this.#ignoreEmailVisibility = state;
    return this;
  }

  ignoreUnchangedFields(state: boolean): this {
    return this.IgnoreUnchangedFields(state);
  }

  IgnoreUnchangedFields(state: boolean): this {
    this.#ignoreUnchangedFields = state;
    return this;
  }

  SetIfFieldExists(key: string, value: unknown): Field | null {
    for (const field of this.#collection.Fields) {
      const finder = field as unknown as SetterFinder;
      if (typeof finder.FindSetter === "function") {
        const setter = finder.FindSetter(key);
        if (setter) {
          setter(this, value);
          return field;
        }
      }

      if (key === field.GetName()) {
        const prepared = field.PrepareValue(this, value);
        this.SetRaw(key, prepared);
        return field;
      }
    }

    return null;
  }

  ReplaceModifiers(data: RecordData): RecordData {
    const dataKeys = Object.keys(data);
    if (dataKeys.length === 0) {
      return data;
    }

    const dataCopy: RecordData = { ...data };
    const recordCopy = this.Fresh();

    if (dataKeys.length === 1) {
      const onlyKey = dataKeys[0];
      if (!onlyKey) {
        return dataCopy;
      }

      if (this.#collection.isAuth() && onlyKey === FieldNamePassword) {
        delete dataCopy[onlyKey];
        dataCopy[FieldNamePassword] = toStringValue(data[onlyKey]);
        return dataCopy;
      }

      const field = recordCopy.SetIfFieldExists(onlyKey, data[onlyKey]);
      if (field) {
        delete dataCopy[onlyKey];
        dataCopy[field.GetName()] = recordCopy.Get(field.GetName());
      }
      return dataCopy;
    }

    const sortedKeys = dataKeys
      .map((key, index) => ({ key, index }))
      .sort((a, b) => {
        const lenDiff = a.key.length - b.key.length;
        if (lenDiff !== 0) {
          return lenDiff;
        }
        return a.index - b.index;
      })
      .map((entry) => entry.key);

    for (const key of sortedKeys) {
      // PocketBun perf deviation (behavior-compatible): avoid duplicate bcrypt hashing
      // in the auth create/update flow.
      //
      // `ReplaceModifiers` is followed by form load, where `password` is hashed again.
      // For plain `password` keys the observable resolved value is the casted plain string,
      // so we can skip setter execution here and preserve the same exported body value.
      //
      // Keep in sync with RecordUpsert.LoadAsync (src/forms/record_upsert.ts), which is
      // the canonical hashing point for CRUD request bodies.
      if (this.#collection.isAuth() && key === FieldNamePassword) {
        delete dataCopy[key];
        dataCopy[FieldNamePassword] = toStringValue(data[key]);
        continue;
      }

      const field = recordCopy.SetIfFieldExists(key, data[key]);
      if (field) {
        delete dataCopy[key];
        dataCopy[field.GetName()] = recordCopy.Get(field.GetName());
      }
    }

    return dataCopy;
  }

  TableName(): string {
    return this.#collection.name;
  }

  HookTags(): string[] {
    const cached = this.#hookTags;
    if (cached && cached[0] === this.#collection.name && cached[1] === this.#collection.id) {
      return cached;
    }
    // Deviation: append a stable type tag so model-level system hooks can skip
    // non-record events without running conversion handlers.
    const tags = [this.#collection.name, this.#collection.id, RecordModelTypeHookTag];
    this.#hookTags = tags;
    return tags;
  }

  BaseFilesPath(): string {
    const id = this.LastSavedPK() || this.id;
    return `${this.#collection.BaseFilesPath()}/${id}`;
  }

  callFieldInterceptors(
    ctx: unknown,
    app: unknown,
    actionName: string,
    actionFunc: () => Error | null | Promise<Error | null>,
  ): Error | null | Promise<Error | null> {
    const interceptors = this.#resolveFieldInterceptors();
    if (interceptors.length === 0) {
      return actionFunc();
    }

    // Keep upstream execution order while skipping non-matching interceptors inline
    // instead of allocating action-filtered arrays per record instance.
    let index = interceptors.length - 1;
    const run = (): Error | null | Promise<Error | null> => {
      while (index >= 0) {
        const current = interceptors[index];
        index -= 1;
        if (!current) {
          continue;
        }
        if (current.CanInterceptAction?.(actionName) === false) {
          continue;
        }
        return current.Intercept(ctx, app, this, actionName, run);
      }
      return actionFunc();
    };

    return run();
  }

  callFieldInterceptorsSync(ctx: unknown, app: unknown, actionName: string, actionFunc: () => Error | null): Error | null {
    const result = this.callFieldInterceptors(ctx, app, actionName, actionFunc);
    if (result instanceof Promise) {
      return new Error("async field interceptors are not supported in sync save");
    }
    return result ?? null;
  }

  #resolveFieldInterceptors(): RecordInterceptor[] {
    if (this.#fieldInterceptors) {
      return this.#fieldInterceptors;
    }

    const interceptors: RecordInterceptor[] = [];
    for (const field of this.#collection.Fields) {
      const interceptor = field as unknown as RecordInterceptor;
      if (typeof interceptor.Intercept === "function") {
        interceptors.push(interceptor);
      }
    }

    this.#fieldInterceptors = interceptors;
    return interceptors;
  }

  DBExport(): RecordData {
    const result: RecordData = {};
    const original = this.#ignoreUnchangedFields && !this.IsNew() ? this.Original() : null;
    for (const field of this.#collection.Fields) {
      const name = field.GetName();
      if (original && valuesEqual(this.Get(name), original.Get(name))) {
        continue;
      }
      const driver = field as unknown as DriverValuer;
      if (typeof driver.DriverValue === "function") {
        const [value, err] = driver.DriverValue(this);
        if (err) {
          throw err;
        }
        result[name] = value;
      } else {
        result[name] = this.GetRaw(name);
      }
    }
    return result;
  }

  tokenKey(): string {
    return this.TokenKey();
  }

  isSuperuser(): boolean {
    return this.#collection.name === CollectionNameSuperusers;
  }

  IsSuperuser(): boolean {
    return this.isSuperuser();
  }

  export(options: RecordExportOptions = {}): RecordData {
    const exportData: RecordData = {};
    const includeHidden = Boolean(options.includeHidden);
    const ignoreEmailVisibility = Boolean(options.ignoreEmailVisibility) || this.#ignoreEmailVisibility;
    const hasCustomVisibility = this.#customVisibility.length() > 0;
    const customVisibility = hasCustomVisibility ? this.#customVisibility.getAll() : null;

    for (const field of this.#collection.Fields) {
      const name = field.GetName();
      const custom = customVisibility?.get(name);
      const isVisible = custom ?? (includeHidden ? true : !field.GetHidden());
      if (!isVisible) {
        continue;
      }
      exportData[name] = this.Get(name);
    }

    if (this.#exportCustomData) {
      for (const [key, value] of Object.entries(this.CustomData())) {
        const customFlag = customVisibility?.get(key);
        if (customFlag === false) {
          continue;
        }
        exportData[key] = value;
      }
    }

    if (!Object.prototype.hasOwnProperty.call(exportData, FieldNameId)) {
      exportData[FieldNameId] = this.id;
    }

    if (this.#collection.isAuth()) {
      delete exportData[FieldNamePassword];
      delete exportData[FieldNameTokenKey];

      if (!ignoreEmailVisibility && !this.GetBool(FieldNameEmailVisibility)) {
        delete exportData[FieldNameEmail];
      }
    }

    const collectionIdVisible = customVisibility?.get(FieldNameCollectionId);
    if (!hasCustomVisibility || collectionIdVisible !== false) {
      exportData[FieldNameCollectionId] = this.#collection.id;
    }
    const collectionNameVisible = customVisibility?.get(FieldNameCollectionName);
    if (!hasCustomVisibility || collectionNameVisible !== false) {
      exportData[FieldNameCollectionName] = this.#collection.name;
    }

    const expandVisible = customVisibility?.get(FieldNameExpand);
    if ((!hasCustomVisibility || expandVisible !== false) && this.#expand) {
      exportData[FieldNameExpand] = Object.fromEntries(this.#expand.getAll());
    }

    return exportData;
  }

  publicExport(): RecordData {
    return this.export();
  }

  PublicExport(): RecordData {
    return this.publicExport();
  }

  toJSON(): RecordData {
    return this.publicExport();
  }

  MarshalJSON(): string {
    return JSON.stringify(this.publicExport());
  }

  marshalJSON(): string {
    return this.MarshalJSON();
  }

  UnmarshalJSON(data: string | Uint8Array): Error | null {
    try {
      const text = typeof data === "string" ? data : new TextDecoder().decode(data);
      const parsed = text ? (JSON.parse(text) as RecordData) : {};
      this.Load(parsed);
      return null;
    } catch (error) {
      return error as Error;
    }
  }

  unmarshalJSON(data: string | Uint8Array): void {
    const err = this.UnmarshalJSON(data);
    if (err) {
      throw err;
    }
  }
}

attachRecordAuthMethods(Record);

export function NewRecord(collection: Collection, data: RecordData = {}): Record {
  return new Record(collection, data, true);
}

const recordMethodAliases = [
  ["isNew", "IsNew"],
  ["postScan", "PostScan"],
  ["load", "Load"],
  ["lastSavedPK", "LastSavedPK"],
  ["pk", "PK"],
  ["markAsNew", "MarkAsNew"],
  ["markAsNotNew", "MarkAsNotNew"],
  ["original", "Original"],
  ["fresh", "Fresh"],
  ["clone", "Clone"],
  ["fieldsData", "FieldsData"],
  ["customData", "CustomData"],
  ["expand", "Expand"],
  ["hasExpand", "HasExpand"],
  ["setExpand", "SetExpand"],
  ["mergeExpand", "MergeExpand"],
  ["findFileFieldByFile", "FindFileFieldByFile"],
  ["hide", "Hide"],
  ["unhide", "Unhide"],
  ["withCustomData", "WithCustomData"],
  ["ignoreEmailVisibility", "IgnoreEmailVisibility"],
  ["ignoreUnchangedFields", "IgnoreUnchangedFields"],
  ["setIfFieldExists", "SetIfFieldExists"],
  ["replaceModifiers", "ReplaceModifiers"],
  ["tableName", "TableName"],
  ["hookTags", "HookTags"],
  ["baseFilesPath", "BaseFilesPath"],
  ["dbExport", "DBExport"],
  ["isSuperuser", "IsSuperuser"],
  ["publicExport", "PublicExport"],
  ["email", "Email"],
  ["setEmail", "SetEmail"],
  ["emailVisibility", "EmailVisibility"],
  ["setEmailVisibility", "SetEmailVisibility"],
  ["verified", "Verified"],
  ["setVerified", "SetVerified"],
  ["tokenKey", "TokenKey"],
  ["setTokenKey", "SetTokenKey"],
  ["refreshTokenKey", "RefreshTokenKey"],
  ["setPassword", "SetPassword"],
  ["setPasswordAsync", "SetPasswordAsync"],
  ["setRandomPassword", "SetRandomPassword"],
  ["setRandomPasswordAsync", "SetRandomPasswordAsync"],
  ["validatePassword", "ValidatePassword"],
  ["validatePasswordAsync", "ValidatePasswordAsync"],
] as const;

installRecordJSVMAliases();

function installRecordJSVMAliases(): void {
  // PocketBun JSVM compatibility: expose PocketBase's lower-camel server-side
  // JavaScript names directly on Record instances instead of using bind facades.
  for (const [aliasName, sourceName] of recordMethodAliases) {
    defineRecordMethodAlias(aliasName, sourceName);
  }
}

function defineRecordMethodAlias(aliasName: string, sourceName: string): void {
  if (aliasName in Record.prototype) {
    return;
  }

  Object.defineProperty(Record.prototype, aliasName, {
    configurable: true,
    enumerable: false,
    writable: true,
    value(this: { [key: string]: unknown }, ...args: unknown[]) {
      const method = this[sourceName];
      if (typeof method !== "function") {
        throw new Error(`Record.${sourceName} is not available`);
      }
      const result = method.apply(this, args);
      if (result instanceof Error) {
        throw result;
      }
      return result;
    },
  });
}

const utf8Decoder = new TextDecoder();

function normalizeRowValue(value: unknown): unknown {
  if (value instanceof Uint8Array) {
    return utf8Decoder.decode(value);
  }
  if (value instanceof ArrayBuffer) {
    return utf8Decoder.decode(new Uint8Array(value));
  }
  if (ArrayBuffer.isView(value)) {
    return utf8Decoder.decode(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
  }
  return value;
}

function valuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) {
    return true;
  }

  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
}
