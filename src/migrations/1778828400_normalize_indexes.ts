// Ported from pocketbase/migrations/1778828400_normalize_indexes.go

import type { App } from "../core/app.ts";
import { SystemMigrations } from "../core/migrations_runner.ts";
import { FieldNameEmail, FieldNameTokenKey } from "../core/record_model.ts";
import { parseIndex, type Index } from "../tools/dbutils/index.ts";

const FILE_NAME = "1778828400_normalize_indexes.go";

// see https://github.com/pocketbase/pocketbase/issues/7689
SystemMigrations.register(up, undefined, FILE_NAME);

function up(app: App): void {
  const collections = app.FindAllCollections();

  for (const collection of collections) {
    // existing system collection indexes can't be modified and view don't have indexes
    if (collection.System || collection.IsView()) {
      continue;
    }

    const masterIndexes = app
      .db()
      .query<{ name: string; sql: string }, [string]>(
        "select name, sql from sqlite_master where type = 'index' and tbl_name = ? and sql is not null and name not like 'sqlite_autoindex_%'",
      )
      .all(collection.Name);

    // no indexes
    if (masterIndexes.length === 0 && collection.indexes.length === 0) {
      continue;
    }

    const missingParsedIndexes = new Map<string, Index>();
    let shouldSave = needsIndexNormalization(collection.Name, collection.indexes);

    // find missing master indexes
    masterLoop: for (const masterIndex of masterIndexes) {
      const mParsed = parseIndex(masterIndex.sql);
      mParsed.schemaName = "";
      mParsed.tableName = collection.Name;

      for (const raw of collection.indexes) {
        const cParsed = parseIndex(raw);

        // index already exists (if needed it will be normalized on resave)
        if (cParsed.indexName !== "" && cParsed.indexName.toLowerCase() === mParsed.indexName.toLowerCase()) {
          continue masterLoop;
        }
      }

      missingParsedIndexes.set(masterIndex.name, mParsed);
    }

    missingIndexesLoop: for (const missing of missingParsedIndexes.values()) {
      const missingSQL = missing.build();

      // it shouldn't be possible but for just in case if there is an edge case the regex doesn't cover
      if (missingSQL === "") {
        throw new Error(`failed to build sqlite_master index: ${JSON.stringify(missing)}`);
      }

      // drop the missing index to recreate later
      try {
        app.db().run(`drop index if exists \`${missing.indexName}\``);
      } catch (error) {
        throw new Error(`failed to drop index ${missing.indexName}: ${String(error)}`);
      }

      // no recreate: duplicated single unique tokenKey or email
      // (auth collections are guaranteed to have them)
      if (
        collection.IsAuth() &&
        missing.unique &&
        missing.columns.length === 1 &&
        (missing.columns[0]?.name.toLowerCase() === FieldNameTokenKey.toLowerCase() ||
          missing.columns[0]?.name.toLowerCase() === FieldNameEmail.toLowerCase())
      ) {
        continue missingIndexesLoop;
      }

      // no recreate: the same index definition alreay exists
      // in the collection but with different name
      for (const raw of collection.indexes) {
        const cParsed = parseIndex(raw);
        cParsed.indexName = missing.indexName;
        cParsed.schemaName = missing.schemaName;
        cParsed.tableName = missing.tableName;

        if (missingSQL === cParsed.build()) {
          continue missingIndexesLoop;
        }
      }

      // recreate: add the missing index to the collection list and
      // leave the user to decide whether they want to keep it or not
      // (the index could have been previously created externally, e.g. via the sqlite3 cli)
      collection.indexes.push(missingSQL);
      shouldSave = true;
    }

    // PocketBun behavior-compatible deviation: skip no-op resaves to avoid
    // slowing every fresh test/app bootstrap when indexes are already normalized.
    if (!shouldSave) {
      continue;
    }

    // resave to trigger indexes normalization
    const err = app.SaveSync(collection);
    if (err) {
      throw err;
    }
  }
}

function needsIndexNormalization(collectionName: string, indexes: string[]): boolean {
  for (const raw of indexes) {
    const parsed = parseIndex(raw);

    // no need to normalize
    if (parsed.tableName === collectionName) {
      continue;
    }

    parsed.tableName = collectionName;

    if (parsed.build() !== "") {
      return true;
    }
  }

  return false;
}
