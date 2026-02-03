// Ported from pocketbase/core/collection_record_table_sync.go

import type { App } from "./app.ts";
import type { Collection } from "./collection_model.ts";
import { ValidationErrors, newError } from "../internal/compat/validation.ts";
import { parseIndex } from "../tools/dbutils/index.ts";
import { randomString } from "../tools/security/random.ts";
import { FieldsList } from "./fields_list.ts";

// SyncRecordTableSchema compares the two provided collections
// and applies the necessary related record table changes.
//
// If oldCollection is null, then only newCollection is used to create the record table.
//
// This method is automatically invoked as part of a collection create/update/delete operation.
export async function syncRecordTableSchema(
  app: App,
  newCollection: Collection,
  oldCollection: Collection | null,
): Promise<Error | null> {
  if (newCollection.isView()) {
    return null;
  }

  return await app.RunInTransaction((txApp) => {
    const db = txApp.db();
    const hasOldTable = oldCollection ? txApp.HasTable(oldCollection.name) : false;

    if (!hasOldTable) {
      const columns = newCollection.Fields.map((field) => `"${field.GetName()}" ${field.ColumnType(txApp)}`);
      db.run(`create table if not exists {{${newCollection.name}}} (${columns.join(", ")})`);
      return createCollectionIndexes(txApp, newCollection);
    }

    const oldTableName = oldCollection?.name ?? newCollection.name;
    const newTableName = newCollection.name;
    const needTableRename = oldTableName.toLowerCase() !== newTableName.toLowerCase();
    if (needTableRename) {
      db.run(`alter table {{${oldTableName}}} rename to {{${newTableName}}}`);
    }

    const oldFields = oldCollection?.Fields ?? new FieldsList();
    const newFields = newCollection.Fields;
    const oldIndexesJson = JSON.stringify(oldCollection?.indexes ?? []);
    const newIndexesJson = JSON.stringify(newCollection.indexes ?? []);
    const oldFieldsJson = JSON.stringify(oldFields.toJSON());
    const newFieldsJson = JSON.stringify(newFields.toJSON());
    const needIndexesUpdate = needTableRename || oldFieldsJson !== newFieldsJson || oldIndexesJson !== newIndexesJson;

    if (needIndexesUpdate && oldCollection) {
      const dropErr = dropCollectionIndexes(txApp, oldCollection);
      if (dropErr) {
        return dropErr;
      }
    }

    for (const oldField of oldFields) {
      if (!newFields.GetById(oldField.GetId())) {
        db.run(`alter table {{${newTableName}}} drop column "${oldField.GetName()}"`);
      }
    }

    const toRename: Record<string, string> = {};
    for (const field of newFields) {
      const oldField = oldFields.GetById(field.GetId());
      if (!oldField) {
        const tempName = `${field.GetName()}${randomString(5)}`;
        toRename[tempName] = field.GetName();
        db.run(`alter table {{${newTableName}}} add column "${tempName}" ${field.ColumnType(txApp)}`);
      } else if (oldField.GetName() !== field.GetName()) {
        const tempName = `${field.GetName()}${randomString(5)}`;
        toRename[tempName] = field.GetName();
        db.run(`alter table {{${newTableName}}} rename column "${oldField.GetName()}" to "${tempName}"`);
      }
    }

    for (const [tempName, actualName] of Object.entries(toRename)) {
      db.run(`alter table {{${newTableName}}} rename column "${tempName}" to "${actualName}"`);
    }

    // Deviation: single vs multiple field migration and view resave are not implemented yet.

    if (needIndexesUpdate) {
      return createCollectionIndexes(txApp, newCollection);
    }
    return null;
  });
}

export function syncRecordTableSchemaSync(app: App, newCollection: Collection, oldCollection: Collection | null): Error | null {
  if (newCollection.isView()) {
    return null;
  }

  return app.RunInTransactionSync((txApp) => {
    const db = txApp.db();
    const hasOldTable = oldCollection ? txApp.HasTable(oldCollection.name) : false;

    if (!hasOldTable) {
      const columns = newCollection.Fields.map((field) => `"${field.GetName()}" ${field.ColumnType(txApp)}`);
      db.run(`create table if not exists {{${newCollection.name}}} (${columns.join(", ")})`);
      return createCollectionIndexes(txApp, newCollection);
    }

    const oldTableName = oldCollection?.name ?? newCollection.name;
    const newTableName = newCollection.name;
    const needTableRename = oldTableName.toLowerCase() !== newTableName.toLowerCase();
    if (needTableRename) {
      db.run(`alter table {{${oldTableName}}} rename to {{${newTableName}}}`);
    }

    const oldFields = oldCollection?.Fields ?? new FieldsList();
    const newFields = newCollection.Fields;
    const oldIndexesJson = JSON.stringify(oldCollection?.indexes ?? []);
    const newIndexesJson = JSON.stringify(newCollection.indexes ?? []);
    const oldFieldsJson = JSON.stringify(oldFields.toJSON());
    const newFieldsJson = JSON.stringify(newFields.toJSON());
    const needIndexesUpdate = needTableRename || oldFieldsJson !== newFieldsJson || oldIndexesJson !== newIndexesJson;

    if (needIndexesUpdate && oldCollection) {
      const dropErr = dropCollectionIndexes(txApp, oldCollection);
      if (dropErr) {
        return dropErr;
      }
    }

    for (const oldField of oldFields) {
      if (!newFields.GetById(oldField.GetId())) {
        db.run(`alter table {{${newTableName}}} drop column "${oldField.GetName()}"`);
      }
    }

    const toRename: Record<string, string> = {};
    for (const field of newFields) {
      const oldField = oldFields.GetById(field.GetId());
      if (!oldField) {
        const tempName = `${field.GetName()}${randomString(5)}`;
        toRename[tempName] = field.GetName();
        db.run(`alter table {{${newTableName}}} add column "${tempName}" ${field.ColumnType(txApp)}`);
      } else if (oldField.GetName() !== field.GetName()) {
        const tempName = `${field.GetName()}${randomString(5)}`;
        toRename[tempName] = field.GetName();
        db.run(`alter table {{${newTableName}}} rename column "${oldField.GetName()}" to "${tempName}"`);
      }
    }

    for (const [tempName, actualName] of Object.entries(toRename)) {
      db.run(`alter table {{${newTableName}}} rename column "${tempName}" to "${actualName}"`);
    }

    // Deviation: single vs multiple field migration and view resave are not implemented yet.

    if (needIndexesUpdate) {
      return createCollectionIndexes(txApp, newCollection);
    }
    return null;
  });
}

export function dropCollectionIndexes(app: App, collection: Collection): Error | null {
  for (const index of collection.indexes ?? []) {
    const parsed = parseIndex(index);
    if (!parsed.indexName) {
      continue;
    }
    app.db().run(`drop index if exists \`${parsed.indexName}\``);
  }
  return null;
}

export function createCollectionIndexes(app: App, collection: Collection): Error | null {
  if (collection.isView()) {
    return null;
  }

  const errors: Record<string, Error> = {};
  const indexes = collection.indexes ?? [];

  for (let i = 0; i < indexes.length; i += 1) {
    const index = indexes[i];
    if (!index) {
      continue;
    }

    const parsed = parseIndex(index);
    parsed.tableName = collection.name;

    if (!parsed.isValid()) {
      errors[String(i)] = newError("validation_invalid_index_expression", "Invalid CREATE INDEX expression.");
      continue;
    }

    const sql = parsed.build();
    if (!sql) {
      errors[String(i)] = newError("validation_invalid_index_expression", "Invalid CREATE INDEX expression.");
      continue;
    }

    try {
      app.db().run(sql);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors[String(i)] = newError(
        "validation_invalid_index_expression",
        `Failed to create index ${parsed.indexName} - ${message}.`,
      );
    }
  }

  if (Object.keys(errors).length > 0) {
    return new ValidationErrors({ indexes: new ValidationErrors(errors) });
  }

  return null;
}
