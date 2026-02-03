// Ported from pocketbase/core/record_proxy_test.go

import { describe, it } from "bun:test";
import { NewBaseCollection } from "./collection_model.ts";
import { NewRecord } from "./record_model.ts";
import { BaseRecordProxy } from "./record_proxy.ts";

describe("record proxy", () => {
  it("BaseRecordProxy", () => {
    const proxy = new BaseRecordProxy();
    const record = NewRecord(NewBaseCollection("test"));
    record.Id = "test";

    proxy.SetProxyRecord(record);

    if (!proxy.ProxyRecord() || proxy.ProxyRecord().Id !== proxy.Record?.Id || proxy.Record?.Id !== "test") {
      throw new Error("Expected proxy record to be set");
    }
  });
});
