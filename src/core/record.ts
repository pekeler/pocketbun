// Ported from pocketbase/core/record_model.go

import { Collection, CollectionNameSuperusers } from "./collection.ts";
import { toBoolValue, toStringValue } from "../internal/compat/cast.ts";
import type { GetterFinder, SetterFinder } from "./field.ts";

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

export class Record {
  id: string;
  #collection: Collection;
  #data: RecordData;
  #originalData: RecordData;
  #isNew: boolean;

  constructor(collection: Collection, data: RecordData = {}, isNew = false) {
    this.#collection = collection;
    this.#data = { ...data };
    this.#originalData = { ...data };
    this.id = typeof data.id === "string" ? data.id : "";
    this.#isNew = isNew;
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
    if (field === FieldNameId) {
      return this.id;
    }
    return this.#data[field];
  }

  SetRaw(field: string, value: unknown): void {
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
    this.#originalData = { ...this.#data };
    this.#isNew = false;
    return null;
  }

  Get(field: string): unknown {
    if (field === FieldNameExpand) {
      return this.get(field);
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

  Set(field: string, value: unknown): void {
    if (field === FieldNameExpand) {
      this.SetRaw(field, value);
      return;
    }

    for (const f of this.#collection.Fields) {
      const finder = f as unknown as SetterFinder;
      if (typeof finder.FindSetter !== "function") {
        continue;
      }
      const setter = finder.FindSetter(field);
      if (setter) {
        setter(this, value);
        return;
      }
    }

    this.SetRaw(field, value);
  }

  LastSavedPK(): string {
    const pk = this.#originalData.id;
    return typeof pk === "string" ? pk : "";
  }

  TableName(): string {
    return this.#collection.name;
  }

  tokenKey(): string {
    const tokenKey = this.#data.tokenKey;
    return typeof tokenKey === "string" ? tokenKey : "";
  }

  isSuperuser(): boolean {
    return this.#collection.name === CollectionNameSuperusers;
  }

  export(options: RecordExportOptions = {}): RecordData {
    const exportData: RecordData = {};
    const includeHidden = Boolean(options.includeHidden);
    const ignoreEmailVisibility = Boolean(options.ignoreEmailVisibility);

    const fields =
      this.#collection.Fields.length > 0 ? this.#collection.Fields : this.#collection.fields;
    for (const field of fields) {
      if (typeof (field as any)?.GetName === "function") {
        const typed = field as unknown as { GetName: () => string; GetHidden: () => boolean };
        if (typed.GetHidden() && !includeHidden) {
          continue;
        }
        const name = typed.GetName();
        exportData[name] = this.Get(name);
        continue;
      }
      const raw = field as { name?: string; hidden?: boolean };
      if (raw.hidden && !includeHidden) {
        continue;
      }
      if (raw.name) {
        exportData[raw.name] = this.get(raw.name);
      }
    }

    if (this.#collection.isAuth()) {
      delete exportData[FieldNamePassword];
      delete exportData[FieldNameTokenKey];

      if (!ignoreEmailVisibility && !this.GetBool(FieldNameEmailVisibility)) {
        delete exportData[FieldNameEmail];
      }
    }

    exportData[FieldNameCollectionId] = this.#collection.id;
    exportData[FieldNameCollectionName] = this.#collection.name;

    const expand = this.get(FieldNameExpand);
    if (expand && typeof expand === "object") {
      exportData[FieldNameExpand] = expand;
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
