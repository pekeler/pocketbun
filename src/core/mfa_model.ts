// Ported from pocketbase/core/mfa_model.go.

import type { DateTime } from "../tools/types/index.ts";
import type { App } from "./app.ts";
import { NewBaseCollection } from "./collection.ts";
import { NewRecord, Record as RecordModel } from "./record.ts";
import { BaseRecordProxy } from "./record_proxy.ts";

export const MFAMethodPassword = "password";
export const MFAMethodOAuth2 = "oauth2";
export const MFAMethodOTP = "otp";

export const CollectionNameMFAs = "_mfas";

export class MFA extends BaseRecordProxy {
  constructor(record: RecordModel | null = null) {
    super();
    if (record) {
      this.Record = record;
    }
  }

  PreValidate(_ctx: unknown, _app: App): Error | null {
    if (!this.Record || this.Record.collection().name !== CollectionNameMFAs) {
      return new Error("missing or invalid mfa ProxyRecord");
    }

    return null;
  }

  get Id(): string {
    return this.ProxyRecord().Id;
  }

  set Id(value: string) {
    this.ProxyRecord().Id = value;
  }

  Collection(): ReturnType<RecordModel["collection"]> {
    return this.ProxyRecord().collection();
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

  Method(): string {
    return this.ProxyRecord().GetString("method");
  }

  SetMethod(method: string): void {
    this.ProxyRecord().Set("method", method);
  }

  Created(): DateTime {
    return this.ProxyRecord().GetDateTime("created");
  }

  Updated(): DateTime {
    return this.ProxyRecord().GetDateTime("updated");
  }

  HasExpired(maxElapsedMs: number): boolean {
    return Date.now() - this.Created().time().getTime() >= maxElapsedMs;
  }
}

export function NewMFA(app: App): MFA {
  let collection = app.findCollectionByNameOrId(CollectionNameMFAs);

  if (!collection) {
    collection = NewBaseCollection("@__invalid__");
  }

  return new MFA(NewRecord(collection));
}
