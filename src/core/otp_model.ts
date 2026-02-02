// Ported from pocketbase/core/otp_model.go.

import type { DateTime } from "../tools/types/index.ts";
import type { App } from "./app.ts";
import { NewBaseCollection } from "./collection.ts";
import { NewRecord, Record as RecordModel } from "./record.ts";
import { BaseRecordProxy } from "./record_proxy.ts";

export const CollectionNameOTPs = "_otps";

// OTP defines a Record proxy for working with the otps collection.
export class OTP extends BaseRecordProxy {
  constructor(record: RecordModel | null = null) {
    super();
    if (record) {
      this.Record = record;
    }
  }

  // PreValidate implements the [PreValidator] interface and checks
  // whether the proxy is properly loaded.
  PreValidate(_ctx: unknown, _app: App): Error | null {
    if (!this.Record || this.Record.collection().name !== CollectionNameOTPs) {
      return new Error("missing or invalid otp ProxyRecord");
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

  // SentTo returns the "sentTo" record field value.
  //
  // It could be any string value (email, phone, message app id, etc.)
  // and usually is used as part of the auth flow to update the verified
  // user state in case for example the sentTo value matches with the user record email.
  SentTo(): string {
    return this.ProxyRecord().GetString("sentTo");
  }

  // SetSentTo updates the "sentTo" record field value.
  SetSentTo(value: string): void {
    this.ProxyRecord().Set("sentTo", value);
  }

  // Created returns the "created" record field value.
  Created(): DateTime {
    return this.ProxyRecord().GetDateTime("created");
  }

  // Updated returns the "updated" record field value.
  Updated(): DateTime {
    return this.ProxyRecord().GetDateTime("updated");
  }

  // HasExpired checks if the otp is expired, aka. whether it has been
  // more than maxElapsed time since its creation.
  HasExpired(maxElapsedMs: number): boolean {
    return Date.now() - this.Created().time().getTime() >= maxElapsedMs;
  }
}

// NewOTP instantiates and returns a new blank *OTP model.
//
// Example usage:
//
//	otp := core.NewOTP(app)
//	otp.SetRecordRef(user.Id)
//	otp.SetCollectionRef(user.Collection().Id)
//	otp.SetPassword(security.RandomStringWithAlphabet(6, "1234567890"))
//	app.Save(otp)
export function NewOTP(app: App): OTP {
  let collection = app.findCollectionByNameOrId(CollectionNameOTPs);

  if (!collection) {
    collection = NewBaseCollection("__invalid__");
  }

  return new OTP(NewRecord(collection));
}
