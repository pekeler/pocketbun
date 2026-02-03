// Ported from pocketbase/core/mfa_query.go

import type { App } from "./app.ts";
import type { Collection } from "./collection_model.ts";
import type { Record as RecordModel } from "./record_model.ts";
import { NewExp } from "../tools/dbx/expr.ts";
import { ParseDateTime } from "../tools/types/index.ts";
import { CollectionTypeAuth } from "./collection_model.ts";
import { CollectionNameMFAs, MFA } from "./mfa_model.ts";

export function FindAllMFAsByRecord(app: App, authRecord: RecordModel): MFA[] {
  const result: MFA[] = [new MFA()];

  app
    .RecordQuery(CollectionNameMFAs)
    .AndWhere({
      collectionRef: authRecord.collection().id,
      recordRef: authRecord.Id,
    })
    .OrderBy("created DESC")
    .All(result);

  return result;
}

export function FindAllMFAsByCollection(app: App, collection: Collection): MFA[] {
  const result: MFA[] = [new MFA()];

  app.RecordQuery(CollectionNameMFAs).AndWhere({ collectionRef: collection.id }).OrderBy("created DESC").All(result);

  return result;
}

export function FindMFAById(app: App, id: string): MFA {
  const result = new MFA();

  app.RecordQuery(CollectionNameMFAs).AndWhere({ id }).Limit(1).One(result);

  return result;
}

export async function DeleteAllMFAsByRecord(app: App, authRecord: RecordModel): Promise<Error | null> {
  const models = FindAllMFAsByRecord(app, authRecord);

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

export async function DeleteExpiredMFAs(app: App): Promise<Error | null> {
  const authCollections = app.FindAllCollections(CollectionTypeAuth);

  for (const collection of authCollections) {
    const durationMs = collection.MFA.DurationTime() * 1000;
    const minValidDate = ParseDateTime(new Date(Date.now() - durationMs)).toString();

    const items: RecordModel[] = [];
    app
      .RecordQuery(CollectionNameMFAs)
      .AndWhere({ collectionRef: collection.id })
      .AndWhere(NewExp("[[created]] < {:date}", { date: minValidDate }))
      .All(items);

    for (const item of items) {
      const err = await app.Delete(item);
      if (err) {
        return err;
      }
    }
  }

  return null;
}
