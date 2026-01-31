// Ported from pocketbase/core/record_proxy.go

import type { Record } from "./record.ts";

export interface RecordProxy {
  ProxyRecord(): Record;
  SetProxyRecord(record: Record): void;
}

export class BaseRecordProxy implements RecordProxy {
  Record: Record | null = null;

  ProxyRecord(): Record {
    if (!this.Record) {
      throw new Error("missing proxy record");
    }
    return this.Record;
  }

  SetProxyRecord(record: Record): void {
    this.Record = record;
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

  MarkAsNew(): void {
    this.ProxyRecord().markNew(true);
  }

  MarkAsNotNew(): void {
    this.ProxyRecord().markNew(false);
  }
}
