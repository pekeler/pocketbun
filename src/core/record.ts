// Ported from pocketbase/core/record_model.go

import { Collection, CollectionNameSuperusers } from "./collection.ts";

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

  constructor(collection: Collection, data: RecordData) {
    this.#collection = collection;
    this.#data = data;
    this.id = typeof data.id === "string" ? data.id : "";
  }

  collection(): Collection {
    return this.#collection;
  }

  get(field: string): unknown {
    return this.#data[field];
  }

  getBool(field: string): boolean {
    return Boolean(this.#data[field]);
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

    for (const field of this.#collection.fields) {
      if (field.hidden && !includeHidden) {
        continue;
      }
      exportData[field.name] = this.get(field.name);
    }

    if (this.#collection.isAuth()) {
      delete exportData[FieldNamePassword];
      delete exportData[FieldNameTokenKey];

      if (!ignoreEmailVisibility && !this.getBool(FieldNameEmailVisibility)) {
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
