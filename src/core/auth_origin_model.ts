// Ported from pocketbase/core/auth_origin_model.go.

import type { DateTime } from "../tools/types/index.ts";
import type { App } from "./app.ts";
import { ValidationErrors, required } from "../internal/compat/validation.ts";
import { NewBaseCollection } from "./collection.ts";
import { validateCollectionId, validateRecordId } from "./db.ts";
import { Record as RecordModel, NewRecord } from "./record.ts";
import { BaseRecordProxy } from "./record_proxy.ts";

export const CollectionNameAuthOrigins = "_authOrigins";

export class AuthOrigin extends BaseRecordProxy {
  constructor(record: RecordModel | null = null) {
    super();
    if (record) {
      this.Record = record;
    }
  }

  PreValidate(_ctx: unknown, _app: App): Error | null {
    if (!this.Record || this.Record.collection().name !== CollectionNameAuthOrigins) {
      return new Error("missing or invalid AuthOrigin ProxyRecord");
    }

    return null;
  }

  get Id(): string {
    return this.ProxyRecord().Id;
  }

  set Id(value: string) {
    this.ProxyRecord().Id = value;
  }

  CollectionRef(): string {
    return this.ProxyRecord().GetString("collectionRef");
  }

  SetCollectionRef(collectionId: string): void {
    this.ProxyRecord().Set("collectionRef", collectionId);
  }

  RecordRef(): string {
    return this.ProxyRecord().GetString("recordRef");
  }

  SetRecordRef(recordId: string): void {
    this.ProxyRecord().Set("recordRef", recordId);
  }

  Fingerprint(): string {
    return this.ProxyRecord().GetString("fingerprint");
  }

  SetFingerprint(fingerprint: string): void {
    this.ProxyRecord().Set("fingerprint", fingerprint);
  }

  Created(): DateTime {
    return this.ProxyRecord().GetDateTime("created");
  }

  Updated(): DateTime {
    return this.ProxyRecord().GetDateTime("updated");
  }
}

export function NewAuthOrigin(app: App): AuthOrigin {
  let collection = app.findCollectionByNameOrId(CollectionNameAuthOrigins);

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
    Func: (e) => {
      if (
        !e.Collection ||
        e.Collection.name === collectionName ||
        (optCollectionTypes.length > 0 && !optCollectionTypes.includes(e.Collection.type))
      ) {
        return e.Next();
      }

      const collection = e.Collection;
      const originalApp = e.App;
      const txErr = e.App.RunInTransaction((txApp) => {
        e.App = txApp;

        const err = e.Next() as Error | null;
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
          const deleteErr = txApp.Delete(rel);
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
    Func: (e) => {
      if (!e.Record) {
        return e.Next();
      }

      const collection = e.Record.collection();
      if (
        collection.name === collectionName ||
        (optCollectionTypes.length > 0 && !optCollectionTypes.includes(collection.type))
      ) {
        return e.Next();
      }

      const originalApp = e.App;
      const txErr = e.App.RunInTransaction((txApp) => {
        e.App = txApp;

        const err = e.Next() as Error | null;
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
          const deleteErr = txApp.Delete(rel);
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
