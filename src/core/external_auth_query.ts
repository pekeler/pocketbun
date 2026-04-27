// Ported from pocketbase/core/external_auth_query.go

import type { SqlExpr } from "../tools/search/types.ts";
import type { App } from "./app.ts";
import type { Collection } from "./collection_model.ts";
import type { Record as RecordModel } from "./record_model.ts";
import { HashExp, Not } from "../tools/dbx/expr.ts";
import { CollectionNameExternalAuths, ExternalAuth } from "./external_auth_model.ts";

export function FindAllExternalAuthsByRecord(app: App, authRecord: RecordModel): ExternalAuth[] {
  const result: ExternalAuth[] = [new ExternalAuth()];

  app
    .RecordQuery(CollectionNameExternalAuths)
    .AndWhere({
      collectionRef: authRecord.collection().id,
      recordRef: authRecord.Id,
    })
    .OrderBy("created DESC")
    .All(result);

  return result;
}

export function FindAllExternalAuthsByCollection(app: App, collection: Collection): ExternalAuth[] {
  const result: ExternalAuth[] = [new ExternalAuth()];

  app.RecordQuery(CollectionNameExternalAuths).AndWhere({ collectionRef: collection.id }).OrderBy("created DESC").All(result);

  return result;
}

export function FindFirstExternalAuthByExpr(app: App, expr: SqlExpr | Record<string, unknown>): ExternalAuth {
  const result = new ExternalAuth();

  app
    .RecordQuery(CollectionNameExternalAuths)
    .AndWhere(Not(HashExp({ providerId: "" })))
    .AndWhere(expr)
    .OrderBy("created DESC")
    .Limit(1)
    .One(result);

  return result;
}

// DeleteAllExternalAuthsByRecord deletes all ExternalAuth models associated with the provided record.
//
// Returns a combined error with the failed deletes.
export async function DeleteAllExternalAuthsByRecord(app: App, authRecord: RecordModel): Promise<Error | null> {
  const models = FindAllExternalAuthsByRecord(app, authRecord);

  const errors: Error[] = [];
  for (const model of models) {
    const err = await app.Delete(model);
    if (err) {
      errors.push(err);
    }
  }

  if (errors.length === 0) {
    return null;
  }

  if (errors.length === 1) {
    return errors[0]!;
  }

  return new Error(errors.map((err) => err.message ?? String(err)).join("\n"));
}
