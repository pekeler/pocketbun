// Ported from pocketbase/core/otp_model.go.

import type { DateTime } from "../tools/types/index.ts";
import type { App } from "./app.ts";
import { NewBaseCollection } from "./collection.ts";
import { NewRecord, Record as RecordModel } from "./record.ts";
import { BaseRecordProxy } from "./record_proxy.ts";

export const CollectionNameOTPs = "_otps";

export class OTP extends BaseRecordProxy {
  constructor(record: RecordModel | null = null) {
    super();
    if (record) {
      this.Record = record;
    }
  }

  PreValidate(_ctx: unknown, _app: App): Error | null {
    if (!this.Record || this.Record.collection().name !== CollectionNameOTPs) {
      return new Error("missing or invalid otp ProxyRecord");
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

  SentTo(): string {
    return this.ProxyRecord().GetString("sentTo");
  }

  SetSentTo(value: string): void {
    this.ProxyRecord().Set("sentTo", value);
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

export function NewOTP(app: App): OTP {
  let collection = app.findCollectionByNameOrId(CollectionNameOTPs);

  if (!collection) {
    collection = NewBaseCollection("__invalid__");
  }

  return new OTP(NewRecord(collection));
}
