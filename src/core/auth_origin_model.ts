// Ported from pocketbase/core/auth_origin_model.go.

import type { DateTime } from "../tools/types/index.ts";
import type { App } from "./app.ts";
import { ValidationErrors, required } from "../internal/compat/validation.ts";
import { NewBaseCollection, type Collection } from "./collection_model.ts";
import { validateCollectionId, validateRecordId } from "./db.ts";
import { Record as RecordModel, NewRecord } from "./record_model.ts";
import { BaseRecordProxy } from "./record_proxy.ts";

export const CollectionNameAuthOrigins = "_authOrigins";

// AuthOrigin defines a Record proxy for working with the authOrigins collection.
export class AuthOrigin extends BaseRecordProxy {
  constructor(record: RecordModel | null = null) {
    super();
    if (record) {
      this.Record = record;
    }
  }

  // PreValidate implements the [PreValidator] interface and checks
  // whether the proxy is properly loaded.
  PreValidate(_ctx: unknown, _app: App): Error | null {
    if (!this.Record || this.Record.collection().name !== CollectionNameAuthOrigins) {
      return new Error("missing or invalid AuthOrigin ProxyRecord");
    }

    return null;
  }

  override get Id(): string {
    return this.ProxyRecord().Id;
  }

  override set Id(value: string) {
    this.ProxyRecord().Id = value;
  }

  // CollectionRef returns the "collectionRef" field value.
  CollectionRef(): string {
    return this.ProxyRecord().GetString("collectionRef");
  }

  // SetCollectionRef updates the "collectionRef" record field value.
  SetCollectionRef(collectionId: string): void {
    this.ProxyRecord().Set("collectionRef", collectionId);
  }

  // RecordRef returns the "recordRef" record field value.
  RecordRef(): string {
    return this.ProxyRecord().GetString("recordRef");
  }

  // SetRecordRef updates the "recordRef" record field value.
  SetRecordRef(recordId: string): void {
    this.ProxyRecord().Set("recordRef", recordId);
  }

  // Fingerprint returns the "fingerprint" record field value.
  Fingerprint(): string {
    return this.ProxyRecord().GetString("fingerprint");
  }

  // SetFingerprint updates the "fingerprint" record field value.
  SetFingerprint(fingerprint: string): void {
    this.ProxyRecord().Set("fingerprint", fingerprint);
  }

  // Created returns the "created" record field value.
  Created(): DateTime {
    return this.ProxyRecord().GetDateTime("created");
  }

  // Updated returns the "updated" record field value.
  Updated(): DateTime {
    return this.ProxyRecord().GetDateTime("updated");
  }
}

// NewAuthOrigin instantiates and returns a new blank *AuthOrigin model.
//
// Example usage:
//
//	origin := core.NewOrigin(app)
//	origin.SetRecordRef(user.Id)
//	origin.SetCollectionRef(user.Collection().Id)
//	origin.SetFingerprint("...")
//	app.Save(origin)
export function NewAuthOrigin(app: App): AuthOrigin {
  let collection: Collection | null = null;
  try {
    collection = app.FindCachedCollectionByNameOrId(CollectionNameAuthOrigins);
  } catch {
    collection = null;
  }

  if (!collection) {
    collection = NewBaseCollection("@___invalid___");
  }

  return new AuthOrigin(NewRecord(collection));
}

// -------------------------------------------------------------------

// recordRefHooks registers common hooks that are usually used with record proxies
// that have polymorphic record relations (aka. "collectionRef" and "recordRef" fields).
export function recordRefHooks(app: App, collectionName: string, ...optCollectionTypes: string[]): void {
  app.OnRecordValidate([collectionName]).Bind({
    Func: (e) => {
      if (!e.Record) {
        return e.Next();
      }

      const collectionId = e.Record.GetString("collectionRef");
      const collectionErr = required(collectionId) ?? validateCollectionId(e.App, ...optCollectionTypes)(collectionId);
      if (collectionErr) {
        return new ValidationErrors({ collectionRef: collectionErr });
      }

      const recordId = e.Record.GetString("recordRef");
      const recordErr = required(recordId) ?? validateRecordId(e.App, collectionId)(recordId);
      if (recordErr) {
        return new ValidationErrors({ recordRef: recordErr });
      }

      return e.Next();
    },
    Priority: 99,
  });

  // delete on collection ref delete
  app.OnCollectionDeleteExecute().Bind({
    Func: async (e) => {
      if (
        !e.Collection ||
        e.Collection.name === collectionName ||
        (optCollectionTypes.length > 0 && !optCollectionTypes.includes(e.Collection.type))
      ) {
        return await e.Next();
      }

      const collection = e.Collection;
      const originalApp = e.App;
      const txErr = await e.App.RunInTransaction(async (txApp) => {
        e.App = txApp;

        const err = (await e.Next()) as Error | null;
        if (err) {
          return err;
        }

        let rels: RecordModel[];
        try {
          rels = txApp.FindAllRecords(collectionName, { collectionRef: collection.id });
        } catch (error) {
          return error as Error;
        }

        for (const rel of rels) {
          const deleteErr = await txApp.Delete(rel);
          if (deleteErr) {
            return deleteErr;
          }
        }

        return null;
      });

      e.App = originalApp;

      return txErr;
    },
    Priority: 99,
  });

  // delete on record ref delete
  app.OnRecordDeleteExecute().Bind({
    Func: async (e) => {
      if (!e.Record) {
        return await e.Next();
      }

      const collection = e.Record.collection();
      if (
        collection.name === collectionName ||
        (optCollectionTypes.length > 0 && !optCollectionTypes.includes(collection.type))
      ) {
        return e.Next();
      }

      const originalApp = e.App;
      const txErr = await e.App.RunInTransaction(async (txApp) => {
        e.App = txApp;

        const err = (await e.Next()) as Error | null;
        if (err) {
          return err;
        }

        let rels: RecordModel[];
        try {
          rels = txApp.FindAllRecords(collectionName, {
            collectionRef: collection.id,
            recordRef: e.Record?.Id ?? "",
          });
        } catch (error) {
          return error as Error;
        }

        for (const rel of rels) {
          const deleteErr = await txApp.Delete(rel);
          if (deleteErr) {
            return deleteErr;
          }
        }

        return null;
      });

      e.App = originalApp;

      return txErr;
    },
    Priority: 99,
  });
}
