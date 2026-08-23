// Ported from pocketbase/core/log_model_test.go

import { describe, expect, it } from "bun:test";
import { newTestApp } from "../tests/app.ts";
import { ParseDateTime } from "../tools/types/index.ts";
import { JSONMap } from "../tools/types/json_map.ts";
import { Log, LogsTableName } from "./log_model.ts";

describe("log model", () => {
  it("uses the logs table", () => {
    expect(new Log().TableName()).toBe(LogsTableName);
  });

  it("exports empty, regular, and exactly-at-limit logs like PocketBase", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const empty = new Log().DBExport(app);
      expect(empty.data).toBeInstanceOf(JSONMap);
      expect(JSON.parse(JSON.stringify(empty))).toEqual({
        id: "",
        created: "",
        level: 0,
        message: "",
        data: {},
      });

      const regular = new Log();
      regular.id = "test_id";
      regular.created = ParseDateTime("2026-08-18 10:20:30.456Z");
      regular.level = 123;
      regular.message = "test_message";
      regular.data = new JSONMap({ a: "test1", b: "test2" });
      expect(JSON.parse(JSON.stringify(regular.DBExport(app)))).toEqual({
        id: "test_id",
        created: "2026-08-18 10:20:30.456Z",
        level: 123,
        message: "test_message",
        data: { a: "test1", b: "test2" },
      });

      const limit = 16 << 10;
      regular.message = "a".repeat(8000);
      regular.data = new JSONMap({ a: "test1", b: "test2", c: "a".repeat(limit - 32) });
      const exact = regular.DBExport(app);
      expect(exact.message).toBe("a".repeat(8000));
      expect(JSON.parse(String(exact.data))).toEqual(regular.data.toJSON());
    } finally {
      await cleanup();
    }
  });

  it("truncates oversized messages and data before persistence", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      app.settings().logs.maxDataSize = 40;
      const log = new Log();
      log.id = "test_id";
      log.created = ParseDateTime("2026-08-18 10:20:30.456Z");
      log.level = 123;
      log.message = "a".repeat(8001);
      log.data = new JSONMap({ a: "test1", b: "test2", c: "a".repeat(40) });

      const result = log.DBExport(app);

      expect(result.message).toBe("a".repeat(8000));
      expect(JSON.parse(String(result.data))).toEqual({
        __pb_truncated__: true,
        a: "test1",
        b: "test2",
        c: "a".repeat(10),
      });
    } finally {
      await cleanup();
    }
  });

  it("retains a partially decoded final field like PocketBase", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const limit = 2 << 10;
      app.settings().logs.maxDataSize = limit;
      const log = new Log();
      log.data = new JSONMap({ a: "test1", b: "test2", c: `${"a".repeat(limit - 32)}x` });

      expect(JSON.parse(String(log.DBExport(app).data))).toEqual({
        __pb_truncated__: true,
        a: "test1",
        b: "test2",
        c: `${"a".repeat(limit - 32)}x`,
      });
    } finally {
      await cleanup();
    }
  });
});
