// Ported from pocketbase/core/collection_query.go

import type { SQLQueryBindings } from "bun:sqlite";
import type { App } from "./app.ts";
import type { Field } from "./field.ts";
import type { Record as RecordModel } from "./record_model.ts";
import { SelectQuery } from "../tools/dbx/select_query.ts";
import { Collection, collectionFromRow, type CollectionRow } from "./collection_model.ts";
import { RelationField } from "./field_relation.ts";

export const StoreKeyCachedCollections = "pbAppCachedCollections";

// CollectionQuery returns a new Collection select query.
export function CollectionQuery(app: App): SelectQuery {
  return app.ModelQuery(new Collection());
}

// FindAllCollections finds all collections by the given type(s).
//
// If collectionTypes is not set, it returns all collections.
//
// Example:
//
//  app.FindAllCollections() // all collections
//  app.FindAllCollections("auth", "view") // only auth and view collections
export function FindAllCollections(app: App, ...collectionTypes: string[]): Collection[] {
  const types = Array.from(new Set(collectionTypes.filter((type) => type)));
  const params: SQLQueryBindings[] = [];
  let sql =
    "select id, name, system, type, fields, indexes, listRule, viewRule, createRule, updateRule, deleteRule, options, created, updated from _collections";

  if (types.length > 0) {
    const placeholders = types.map(() => "?").join(", ");
    sql += ` where type in (${placeholders})`;
    params.push(...types);
  }

  sql += " order by rowid asc";

  const rows = app
    .db()
    .query(sql)
    .all(...params);

  if (!Array.isArray(rows)) {
    return [];
  }

  return rows.map((row) => collectionFromRow(row as CollectionRow));
}

// ReloadCachedCollections fetches all collections and caches them into the app store.
export function ReloadCachedCollections(app: App): Error | null {
  try {
    const collections = FindAllCollections(app);
    app.store().set(StoreKeyCachedCollections, collections);
    return null;
  } catch (error) {
    return error as Error;
  }
}

// FindCollectionByNameOrId finds a single collection by its name (case insensitive) or id.
export function FindCollectionByNameOrId(app: App, nameOrId: string): Collection {
  const row = app
    .db()
    .query(
      "select id, name, system, type, fields, indexes, listRule, viewRule, createRule, updateRule, deleteRule, options, created, updated from _collections where id = ? or lower(name) = lower(?)",
    )
    .get(nameOrId, nameOrId) as CollectionRow | undefined;

  if (!row) {
    throw new Error("collection not found");
  }

  return collectionFromRow(row);
}

// FindCachedCollectionByNameOrId is similar to [FindCollectionByNameOrId]
// but retrieves the Collection from the app cache instead of making a db call.
//
// NB! This method is suitable for read-only Collection operations.
//
// Throws if no Collection is found for consistency
// with the FindCollectionByNameOrId behavior.
//
// If you plan making changes to the returned Collection model,
// use [FindCollectionByNameOrId] instead.
//
// Caveats:
//
//  - The returned Collection should be used only for read-only operations.
//    Avoid directly modifying the returned cached Collection as it will affect
//    the global cached value even if you don't persist the changes in the database!
//  - If you are updating a Collection in a transaction and then call this method before commit,
//    it'll return the cached Collection state and not the one from the uncommitted transaction.
//  - The cache is automatically updated on collections db change (create/update/delete).
//    To manually reload the cache you can call [ReloadCachedCollections].
export function FindCachedCollectionByNameOrId(app: App, nameOrId: string): Collection {
  const cached = app.store().get(StoreKeyCachedCollections) as Collection[] | undefined;
  if (!Array.isArray(cached) || cached.length === 0) {
    return FindCollectionByNameOrId(app, nameOrId);
  }

  const lowered = nameOrId.toLowerCase();
  for (const collection of cached) {
    if (collection.id === nameOrId || collection.name.toLowerCase() === lowered) {
      return collection;
    }
  }

  throw new Error("collection not found");
}

// FindCollectionReferences returns information for all relation fields
// referencing the provided collection.
//
// If the provided collection has reference to itself then it will be
// also included in the result. To exclude it, pass the collection id
// as the excludeIds argument.
export function FindCollectionReferences(app: App, collection: Collection, ...excludeIds: string[]): Map<Collection, Field[]> {
  const exclude = new Set(excludeIds.filter((value) => value));
  const result = new Map<Collection, Field[]>();
  const collections = FindAllCollections(app);

  for (const candidate of collections) {
    if (exclude.has(candidate.id)) {
      continue;
    }

    for (const field of candidate.Fields) {
      if (field instanceof RelationField && field.CollectionId === collection.id) {
        const current = result.get(candidate) ?? [];
        current.push(field);
        result.set(candidate, current);
      }
    }
  }

  return result;
}

// FindCachedCollectionReferences is similar to [FindCollectionReferences]
// but retrieves the Collection from the app cache instead of making a db call.
//
// NB! This method is suitable for read-only Collection operations.
//
// If you plan making changes to the returned Collection model,
// use [FindCollectionReferences] instead.
//
// Caveats:
//
//  - The returned Collection should be used only for read-only operations.
//    Avoid directly modifying the returned cached Collection as it will affect
//    the global cached value even if you don't persist the changes in the database!
//  - If you are updating a Collection in a transaction and then call this method before commit,
//    it'll return the cached Collection state and not the one from the uncommitted transaction.
//  - The cache is automatically updated on collections db change (create/update/delete).
//    To manually reload the cache you can call [ReloadCachedCollections].
export function FindCachedCollectionReferences(
  app: App,
  collection: Collection,
  ...excludeIds: string[]
): Map<Collection, Field[]> {
  const cached = app.store().get(StoreKeyCachedCollections) as Collection[] | undefined;
  if (!Array.isArray(cached) || cached.length === 0) {
    return FindCollectionReferences(app, collection, ...excludeIds);
  }

  const exclude = new Set(excludeIds.filter((value) => value));
  const result = new Map<Collection, Field[]>();

  for (const candidate of cached) {
    if (exclude.has(candidate.id)) {
      continue;
    }

    for (const field of candidate.Fields) {
      if (field instanceof RelationField && field.CollectionId === collection.id) {
        const current = result.get(candidate) ?? [];
        current.push(field);
        result.set(candidate, current);
      }
    }
  }

  return result;
}

// IsCollectionNameUnique checks that there is no existing collection
// with the provided name (case insensitive!).
//
// Note: case insensitive check because the name is used also as
// table name for the records.
export function IsCollectionNameUnique(app: App, name: string, excludeId?: string): boolean {
  if (!name) {
    return false;
  }

  const row = app.db().query("select id from _collections where lower(name) = lower(?)").get(name) as
    | { id?: string }
    | undefined;

  if (!row?.id) {
    return true;
  }
  if (excludeId && row.id === excludeId) {
    return true;
  }
  return false;
}

// TruncateCollection deletes all records associated with the provided collection.
//
// The truncate operation is executed in a single transaction,
// aka. either everything is deleted or none.
//
// Note that this method will also trigger the records related
// cascade and file delete actions.
export async function TruncateCollection(app: App, collection: Collection): Promise<Error | null> {
  if (collection.isView()) {
    return new Error("view collections cannot be truncated since they don't store their own records");
  }

  return app.RunInTransaction(async (txApp) => {
    const records: RecordModel[] = [];

    for (;;) {
      try {
        txApp.RecordQuery(collection).Limit(500).All(records);
      } catch (error) {
        return error as Error;
      }

      if (records.length === 0) {
        return null;
      }

      for (const record of records) {
        const err = await txApp.Delete(record);
        if (err) {
          return err;
        }
      }

      records.length = 0;
    }
  });
}
