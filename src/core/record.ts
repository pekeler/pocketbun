import { Collection, CollectionNameSuperusers } from "./collection.ts";

export class Record {
  id: string;
  #collection: Collection;
  #data: Record<string, unknown>;

  constructor(collection: Collection, data: Record<string, unknown>) {
    this.#collection = collection;
    this.#data = data;
    this.id = typeof data.id === "string" ? data.id : "";
  }

  collection(): Collection {
    return this.#collection;
  }

  tokenKey(): string {
    const tokenKey = this.#data.tokenKey;
    return typeof tokenKey === "string" ? tokenKey : "";
  }

  isSuperuser(): boolean {
    return this.#collection.name === CollectionNameSuperusers;
  }
}
