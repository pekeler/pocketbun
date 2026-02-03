// Ported from pocketbase/core/otp_query.go

import type { App } from "./app.ts";
import type { Collection } from "./collection.ts";
import type { Record as RecordModel } from "./record.ts";
import { NewExp } from "../tools/dbx/expr.ts";
import { ParseDateTime } from "../tools/types/index.ts";
import { CollectionTypeAuth } from "./collection.ts";
import { CollectionNameOTPs, OTP } from "./otp_model.ts";

export function FindAllOTPsByRecord(app: App, authRecord: RecordModel): OTP[] {
  const result: OTP[] = [new OTP()];

  app
    .RecordQuery(CollectionNameOTPs)
    .AndWhere({
      collectionRef: authRecord.collection().id,
      recordRef: authRecord.Id,
    })
    .OrderBy("created DESC")
    .All(result);

  return result;
}

export function FindAllOTPsByCollection(app: App, collection: Collection): OTP[] {
  const result: OTP[] = [new OTP()];

  app.RecordQuery(CollectionNameOTPs).AndWhere({ collectionRef: collection.id }).OrderBy("created DESC").All(result);

  return result;
}

export function FindOTPById(app: App, id: string): OTP {
  const result = new OTP();

  app.RecordQuery(CollectionNameOTPs).AndWhere({ id }).Limit(1).One(result);

  return result;
}

export async function DeleteAllOTPsByRecord(app: App, authRecord: RecordModel): Promise<Error | null> {
  const models = FindAllOTPsByRecord(app, authRecord);

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

export async function DeleteExpiredOTPs(app: App): Promise<Error | null> {
  const authCollections = app.FindAllCollections(CollectionTypeAuth);

  for (const collection of authCollections) {
    const durationMs = collection.OTP.DurationTime() * 1000;
    const minValidDate = ParseDateTime(new Date(Date.now() - durationMs)).toString();

    const items: RecordModel[] = [];
    app
      .RecordQuery(CollectionNameOTPs)
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
