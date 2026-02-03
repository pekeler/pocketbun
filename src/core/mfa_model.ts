// Ported from pocketbase/core/mfa_model.go.

import type { DateTime } from "../tools/types/index.ts";
import type { App } from "./app.ts";
import { NewBaseCollection } from "./collection_model.ts";
import { NewRecord, Record as RecordModel } from "./record_model.ts";
import { BaseRecordProxy } from "./record_proxy.ts";

export const MFAMethodPassword = "password";
export const MFAMethodOAuth2 = "oauth2";
export const MFAMethodOTP = "otp";

export const CollectionNameMFAs = "_mfas";

// MFA defines a Record proxy for working with the mfas collection.
export class MFA extends BaseRecordProxy {
  constructor(record: RecordModel | null = null) {
    super();
    if (record) {
      this.Record = record;
    }
  }

  // PreValidate implements the [PreValidator] interface and checks
  // whether the proxy is properly loaded.
  PreValidate(_ctx: unknown, _app: App): Error | null {
    if (!this.Record || this.Record.collection().name !== CollectionNameMFAs) {
      return new Error("missing or invalid mfa ProxyRecord");
    }

    return null;
  }

  override get Id(): string {
    return this.ProxyRecord().Id;
  }

  override set Id(value: string) {
    this.ProxyRecord().Id = value;
  }

  Collection(): ReturnType<RecordModel["collection"]> {
    return this.ProxyRecord().collection();
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

  // Method returns the "method" record field value.
  Method(): string {
    return this.ProxyRecord().GetString("method");
  }

  // SetMethod updates the "method" record field value.
  SetMethod(method: string): void {
    this.ProxyRecord().Set("method", method);
  }

  // Created returns the "created" record field value.
  Created(): DateTime {
    return this.ProxyRecord().GetDateTime("created");
  }

  // Updated returns the "updated" record field value.
  Updated(): DateTime {
    return this.ProxyRecord().GetDateTime("updated");
  }

  // HasExpired checks if the mfa is expired, aka. whether it has been
  // more than maxElapsed time since its creation.
  HasExpired(maxElapsedMs: number): boolean {
    return Date.now() - this.Created().time().getTime() >= maxElapsedMs;
  }
}

// NewMFA instantiates and returns a new blank *MFA model.
//
// Example usage:
//
//	mfa := core.NewMFA(app)
//	mfa.SetRecordRef(user.Id)
//	mfa.SetCollectionRef(user.Collection().Id)
//	mfa.SetMethod(core.MFAMethodPassword)
//	app.Save(mfa)
export function NewMFA(app: App): MFA {
  let collection = app.findCollectionByNameOrId(CollectionNameMFAs);

  if (!collection) {
    collection = NewBaseCollection("@__invalid__");
  }

  return new MFA(NewRecord(collection));
}
