// Ported from pocketbase/core/record_model.go
// Note: includes Record auth helpers from pocketbase/core/record_model_auth.go.

import type { DriverValuer, Field, GetterFinder, RecordInterceptor, SetterFinder } from "./field.ts";
import type { FileField } from "./field_file.ts";
import { toBoolValue, toStringValue } from "../internal/compat/cast.ts";
import { toUniqueStringSlice } from "../tools/list/list.ts";
import { randomString } from "../tools/security/random.ts";
import { Store } from "../tools/store/store.ts";
import { GeoPoint, ParseDateTime } from "../tools/types/index.ts";
import { Collection, CollectionNameSuperusers } from "./collection.ts";
import { PasswordFieldValue } from "./field_password.ts";
import { autogenerateModifier } from "./field_text.ts";

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

export const internalCustomFieldKeyPrefix = "@pbInternal";

export class Record {
  id: string;
  #collection: Collection;
  #data: RecordData;
  #originalData: RecordData;
  #isNew: boolean;
  #exportCustomData = false;
  #ignoreEmailVisibility = false;
  #customVisibility = new Store<string, boolean>();
  #expand: Store<string, unknown> | null = null;

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
    this.#data = { ...data };
    this.#originalData = { ...data };
    this.id = typeof data.id === "string" ? data.id : "";
    this.#isNew = isNew;

    if (isNew) {
      for (const field of collection.Fields) {
        const name = field.GetName();
        if (name === FieldNameId) {
          continue;
        }
        const prepared = field.PrepareValue(this, null);
        if (!Object.prototype.hasOwnProperty.call(this.#originalData, name)) {
          this.#originalData[name] = prepared;
        }
        // Deviation: mirror defaults into #data to emulate Go's store.GetOk fallback behavior.
        if (!Object.prototype.hasOwnProperty.call(this.#data, name)) {
          this.#data[name] = prepared;
        }
      }
    }
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

  get(field: string): unknown {
    return this.#data[field];
  }

  getBool(field: string): boolean {
    return Boolean(this.#data[field]);
  }

  GetRaw(field: string): unknown {
    if (field === FieldNameExpand) {
      return this.Expand();
    }
    if (field === FieldNameId) {
      return this.id;
    }
    if (Object.prototype.hasOwnProperty.call(this.#data, field)) {
      const value = this.#data[field];
      if (value !== undefined) {
        return value;
      }
    }
    return this.#originalData[field];
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
    if (field === "id") {
      this.id = toStringValue(value);
    }
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

  GetBool(field: string): boolean {
    return toBoolValue(this.Get(field));
  }

  GetString(field: string): string {
    return toStringValue(this.Get(field));
  }

  GetDateTime(field: string) {
    return ParseDateTime(this.Get(field));
  }

  GetGeoPoint(field: string): GeoPoint {
    const point = new GeoPoint();
    void point.Scan(this.Get(field));
    return point;
  }

  GetStringSlice(field: string): string[] {
    return toUniqueStringSlice(this.Get(field));
  }

  Email(): string {
    return this.GetString(FieldNameEmail);
  }

  SetEmail(email: string): void {
    this.Set(FieldNameEmail, email);
  }

  EmailVisibility(): boolean {
    return this.GetBool(FieldNameEmailVisibility);
  }

  SetEmailVisibility(visible: boolean): void {
    this.Set(FieldNameEmailVisibility, visible);
  }

  Verified(): boolean {
    return this.GetBool(FieldNameVerified);
  }

  SetVerified(verified: boolean): void {
    this.Set(FieldNameVerified, verified);
  }

  TokenKey(): string {
    return this.GetString(FieldNameTokenKey);
  }

  SetTokenKey(key: string): void {
    this.Set(FieldNameTokenKey, key);
  }

  RefreshTokenKey(): void {
    this.Set(FieldNameTokenKey + autogenerateModifier, "");
  }

  SetPassword(password: string): void {
    this.Set(FieldNamePassword, password);
  }

  SetRandomPassword(): string {
    const pass = randomString(30);
    this.SetPassword(pass);
    this.RefreshTokenKey();

    const raw = this.GetRaw(FieldNamePassword);
    if (raw instanceof PasswordFieldValue) {
      raw.Plain = "";
    }

    return pass;
  }

  ValidatePassword(password: string): boolean {
    const raw = this.GetRaw(FieldNamePassword);
    if (!(raw instanceof PasswordFieldValue)) {
      return false;
    }
    return raw.Validate(password);
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
    const original = new Record(this.#collection, {}, true);
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
    if (Object.keys(data).length === 0) {
      return data;
    }

    const dataCopy: RecordData = { ...data };
    const recordCopy = this.Fresh();

    const sortedKeys = Object.keys(data)
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
    return [this.#collection.name, this.#collection.id];
  }

  BaseFilesPath(): string {
    const id = this.LastSavedPK() || this.id;
    return `${this.#collection.BaseFilesPath()}/${id}`;
  }

  callFieldInterceptors(ctx: unknown, app: unknown, actionName: string, actionFunc: () => Error | null): Error | null {
    let next = actionFunc;
    for (const field of this.#collection.Fields) {
      const interceptor = field as unknown as RecordInterceptor;
      if (typeof interceptor.Intercept === "function") {
        const prev = next;
        next = () => interceptor.Intercept(ctx, app, this, actionName, prev);
      }
    }
    return next();
  }

  DBExport(): RecordData {
    const result: RecordData = {};
    for (const field of this.#collection.Fields) {
      const name = field.GetName();
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
    const customVisibility = this.#customVisibility.getAll();

    for (const field of this.#collection.Fields) {
      const name = field.GetName();
      let isVisible = customVisibility.get(name);
      if (isVisible === undefined) {
        isVisible = !field.GetHidden();
      }
      if (!isVisible && includeHidden) {
        isVisible = true;
      }
      if (!isVisible) {
        continue;
      }
      exportData[name] = this.Get(name);
    }

    if (this.#exportCustomData) {
      for (const [key, value] of Object.entries(this.CustomData())) {
        const customFlag = customVisibility.get(key);
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

    const collectionIdVisible = customVisibility.get(FieldNameCollectionId);
    if (collectionIdVisible !== false) {
      exportData[FieldNameCollectionId] = this.#collection.id;
    }
    const collectionNameVisible = customVisibility.get(FieldNameCollectionName);
    if (collectionNameVisible !== false) {
      exportData[FieldNameCollectionName] = this.#collection.name;
    }

    const expandVisible = customVisibility.get(FieldNameExpand);
    if (expandVisible !== false && this.#expand) {
      exportData[FieldNameExpand] = Object.fromEntries(this.#expand.getAll());
    }

    return exportData;
  }

  publicExport(): RecordData {
    return this.export();
  }

  toJSON(): RecordData {
    return this.publicExport();
  }
}

export function NewRecord(collection: Collection, data: RecordData = {}): Record {
  return new Record(collection, data, true);
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
