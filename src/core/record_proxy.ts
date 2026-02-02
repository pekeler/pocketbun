// Ported from pocketbase/core/record_proxy.go

import type { Model } from "./db_model.ts";
import type { Record } from "./record.ts";

// RecordProxy defines an interface for a Record proxy/project model,
// aka. custom model struct that acts on behalve the proxied Record to
// allow for example typed getter/setters for the Record fields.
//
// To implement the interface it is usually enough to embed the [BaseRecordProxy] struct.
export interface RecordProxy extends Model {
  ProxyRecord(): Record;
  SetProxyRecord(record: Record): void;
}

// BaseRecordProxy implements the [RecordProxy] interface and it is intended
// to be used as embed to custom user provided Record proxy structs.
export class BaseRecordProxy implements RecordProxy {
  Record: Record | null = null;

  // ProxyRecord returns the proxied Record model.
  ProxyRecord(): Record {
    if (!this.Record) {
      throw new Error("missing proxy record");
    }
    return this.Record;
  }

  // SetProxyRecord loads the specified record model into the current proxy.
  SetProxyRecord(record: Record): void {
    this.Record = record;
  }

  get Id(): string {
    return this.ProxyRecord().Id;
  }

  set Id(value: string) {
    this.ProxyRecord().Id = value;
  }

  TableName(): string {
    return this.ProxyRecord().TableName();
  }

  HookTags(): string[] {
    return this.ProxyRecord().HookTags();
  }

  IsNew(): boolean {
    return this.ProxyRecord().IsNew();
  }

  LastSavedPK(): string {
    return this.ProxyRecord().LastSavedPK();
  }

  PK(): string {
    return this.ProxyRecord().Id;
  }

  MarkAsNew(): void {
    this.ProxyRecord().markNew(true);
  }

  MarkAsNotNew(): void {
    this.ProxyRecord().markNew(false);
  }
}
