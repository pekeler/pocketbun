// Ported from pocketbase/core/external_auth_model.go.

import type { DateTime } from "../tools/types/index.ts";
import type { App } from "./app.ts";
import { NewBaseCollection } from "./collection.ts";
import { NewRecord, Record as RecordModel } from "./record.ts";
import { BaseRecordProxy } from "./record_proxy.ts";

export const CollectionNameExternalAuths = "_externalAuths";

export class ExternalAuth extends BaseRecordProxy {
  constructor(record: RecordModel | null = null) {
    super();
    if (record) {
      this.Record = record;
    }
  }

  PreValidate(_ctx: unknown, _app: App): Error | null {
    if (!this.Record || this.Record.collection().name !== CollectionNameExternalAuths) {
      return new Error("missing or invalid ExternalAuth ProxyRecord");
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

  Provider(): string {
    return this.ProxyRecord().GetString("provider");
  }

  SetProvider(provider: string): void {
    this.ProxyRecord().Set("provider", provider);
  }

  ProviderId(): string {
    return this.ProxyRecord().GetString("providerId");
  }

  SetProviderId(providerId: string): void {
    this.ProxyRecord().Set("providerId", providerId);
  }

  Created(): DateTime {
    return this.ProxyRecord().GetDateTime("created");
  }

  Updated(): DateTime {
    return this.ProxyRecord().GetDateTime("updated");
  }
}

export function NewExternalAuth(app: App): ExternalAuth {
  let collection = app.findCollectionByNameOrId(CollectionNameExternalAuths);

  if (!collection) {
    collection = NewBaseCollection("@__invalid__");
  }

  return new ExternalAuth(NewRecord(collection));
}
