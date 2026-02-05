// Ported from pocketbase/core/external_auth_model.go.

import type { DateTime } from "../tools/types/index.ts";
import type { App } from "./app.ts";
import { NewBaseCollection, type Collection } from "./collection_model.ts";
import { NewRecord, Record as RecordModel } from "./record_model.ts";
import { BaseRecordProxy } from "./record_proxy.ts";

export const CollectionNameExternalAuths = "_externalAuths";

// ExternalAuth defines a Record proxy for working with the externalAuths collection.
export class ExternalAuth extends BaseRecordProxy {
  constructor(record: RecordModel | null = null) {
    super();
    if (record) {
      this.Record = record;
    }
  }

  // PreValidate implements the [PreValidator] interface and checks
  // whether the proxy is properly loaded.
  PreValidate(_ctx: unknown, _app: App): Error | null {
    if (!this.Record || this.Record.collection().name !== CollectionNameExternalAuths) {
      return new Error("missing or invalid ExternalAuth ProxyRecord");
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

  // Provider returns the "provider" record field value.
  Provider(): string {
    return this.ProxyRecord().GetString("provider");
  }

  // SetProvider updates the "provider" record field value.
  SetProvider(provider: string): void {
    this.ProxyRecord().Set("provider", provider);
  }

  // Provider returns the "providerId" record field value.
  ProviderId(): string {
    return this.ProxyRecord().GetString("providerId");
  }

  // SetProvider updates the "providerId" record field value.
  SetProviderId(providerId: string): void {
    this.ProxyRecord().Set("providerId", providerId);
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

// NewExternalAuth instantiates and returns a new blank *ExternalAuth model.
//
// Example usage:
//
//	ea := core.NewExternalAuth(app)
//	ea.SetRecordRef(user.Id)
//	ea.SetCollectionRef(user.Collection().Id)
//	ea.SetProvider("google")
//	ea.SetProviderId("...")
//	app.Save(ea)
export function NewExternalAuth(app: App): ExternalAuth {
  let collection: Collection | null = null;
  try {
    collection = app.FindCachedCollectionByNameOrId(CollectionNameExternalAuths);
  } catch {
    collection = null;
  }

  if (!collection) {
    collection = NewBaseCollection("@__invalid__");
  }

  return new ExternalAuth(NewRecord(collection));
}
