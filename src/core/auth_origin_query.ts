// Ported from pocketbase/core/auth_origin_query.go

import type { App } from "./app.ts";
import type { Collection } from "./collection.ts";
import type { Record as RecordModel } from "./record.ts";
import { CollectionNameAuthOrigins } from "./auth_origin_model.ts";
import { AuthOrigin } from "./auth_origin_model.ts";

export function FindAllAuthOriginsByRecord(app: App, authRecord: RecordModel): AuthOrigin[] {
  const result: AuthOrigin[] = [new AuthOrigin()];

  app
    .RecordQuery(CollectionNameAuthOrigins)
    .AndWhere({
      collectionRef: authRecord.collection().id,
      recordRef: authRecord.Id,
    })
    .OrderBy("created DESC")
    .All(result);

  return result;
}

export function FindAllAuthOriginsByCollection(app: App, collection: Collection): AuthOrigin[] {
  const result: AuthOrigin[] = [new AuthOrigin()];

  app.RecordQuery(CollectionNameAuthOrigins).AndWhere({ collectionRef: collection.id }).OrderBy("created DESC").All(result);

  return result;
}

export function FindAuthOriginById(app: App, id: string): AuthOrigin {
  const result = new AuthOrigin();

  app.RecordQuery(CollectionNameAuthOrigins).AndWhere({ id }).Limit(1).One(result);

  return result;
}

export function FindAuthOriginByRecordAndFingerprint(app: App, authRecord: RecordModel, fingerprint: string): AuthOrigin {
  const result = new AuthOrigin();

  app
    .RecordQuery(CollectionNameAuthOrigins)
    .AndWhere({
      collectionRef: authRecord.collection().id,
      recordRef: authRecord.Id,
      fingerprint,
    })
    .Limit(1)
    .One(result);

  return result;
}

export async function DeleteAllAuthOriginsByRecord(app: App, authRecord: RecordModel): Promise<Error | null> {
  let models: AuthOrigin[];
  try {
    models = FindAllAuthOriginsByRecord(app, authRecord);
  } catch (error) {
    return error as Error;
  }

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
