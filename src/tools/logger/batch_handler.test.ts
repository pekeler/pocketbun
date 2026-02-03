// Ported from pocketbase/tools/logger/batch_handler_test.go

import { describe, expect, it } from "bun:test";
import type { Log } from "./log.ts";
import * as slog from "../../internal/compat/slog.ts";
import { ValidationErrors, newError } from "../../internal/compat/validation.ts";
import { BatchHandler, NewBatchHandler } from "./batch_handler.ts";

describe("NewBatchHandler", () => {
  it("panics without WriteFunc", () => {
    expect(() => NewBatchHandler({} as { WriteFunc: () => Error | null })).toThrow();
  });

  it("sets defaults", () => {
    const h = NewBatchHandler({
      WriteFunc: () => null,
    });

    expect(h.options.BatchSize).toBe(100);
    expect(h.options.Level).toBe(slog.LevelInfo);
    expect(h.options.BeforeAddFunc).toBeUndefined();
    expect(h.options.WriteFunc).toBeTruthy();
    expect(h.group).toBe("");
    expect(h.attrs.length).toBe(0);
    expect(h.logs.length).toBe(0);
  });
});

describe("BatchHandler", () => {
  it("Enabled respects level", () => {
    const h = NewBatchHandler({
      Level: slog.LevelWarn,
      WriteFunc: () => null,
    });

    const l = slog.New(h);

    const scenarios = [
      { level: slog.LevelDebug, expected: false },
      { level: slog.LevelInfo, expected: false },
      { level: slog.LevelWarn, expected: true },
      { level: slog.LevelError, expected: true },
    ];

    for (const s of scenarios) {
      const result = l.Enabled({}, s.level);
      expect(result).toBe(s.expected);
    }
  });

  it("SetLevel updates options", () => {
    const h = NewBatchHandler({
      Level: slog.LevelWarn,
      WriteFunc: () => null,
    });

    expect(h.options.Level).toBe(slog.LevelWarn);

    h.SetLevel(slog.LevelDebug);

    expect(h.options.Level).toBe(slog.LevelDebug);
  });

  it("WithAttrs and WithGroup maintain chain", () => {
    const h0 = NewBatchHandler({
      WriteFunc: () => null,
    });

    const h1 = h0.WithAttrs([slog.Int("test1", 1)]) as BatchHandler;
    const h2 = h1.WithGroup("h2_group") as BatchHandler;
    const h3 = h2.WithAttrs([slog.Int("test2", 2)]) as BatchHandler;

    const scenarios: Array<{
      name: string;
      handler: BatchHandler;
      expectedParent: BatchHandler | null;
      expectedGroup: string;
      expectedAttrs: number;
    }> = [
      { name: "h0", handler: h0, expectedParent: null, expectedGroup: "", expectedAttrs: 0 },
      { name: "h1", handler: h1, expectedParent: h0, expectedGroup: "", expectedAttrs: 1 },
      { name: "h2", handler: h2, expectedParent: h1, expectedGroup: "h2_group", expectedAttrs: 0 },
      { name: "h3", handler: h3, expectedParent: h2, expectedGroup: "", expectedAttrs: 1 },
    ];

    for (const s of scenarios) {
      expect(s.handler.group).toBe(s.expectedGroup);
      if (s.expectedParent) {
        expect(s.handler.parent).toBe(s.expectedParent);
      } else {
        expect(s.handler.parent).toBeUndefined();
      }
      expect(s.handler.attrs.length).toBe(s.expectedAttrs);
    }
  });

  it("Handle batches logs", () => {
    const beforeLogs: Log[] = [];
    let writeLogs: Log[] = [];

    const h = NewBatchHandler({
      BatchSize: 3,
      BeforeAddFunc: (_ctx, log) => {
        beforeLogs.push(log);
        return log.Message !== "test2";
      },
      WriteFunc: (_ctx, logs) => {
        writeLogs = logs;
        return null;
      },
    });

    h.Handle({}, slog.NewRecord(new Date(), slog.LevelInfo, "test1", 0));
    h.Handle({}, slog.NewRecord(new Date(), slog.LevelInfo, "test2", 0));
    h.Handle({}, slog.NewRecord(new Date(), slog.LevelInfo, "test3", 0));

    checkLogMessages(["test1", "test2", "test3"], beforeLogs);
    checkLogMessages(["test1", "test3"], h.logs);
    expect(writeLogs.length).toBe(0);

    h.Handle({}, slog.NewRecord(new Date(), slog.LevelInfo, "test4", 0));

    checkLogMessages([], h.logs);
    checkLogMessages(["test1", "test3", "test4"], writeLogs);
  });

  it("WriteAll flushes logs", () => {
    const beforeLogs: Log[] = [];
    let writeLogs: Log[] = [];

    const h = NewBatchHandler({
      BatchSize: 3,
      BeforeAddFunc: (_ctx, log) => {
        beforeLogs.push(log);
        return true;
      },
      WriteFunc: (_ctx, logs) => {
        writeLogs = logs;
        return null;
      },
    });

    h.Handle({}, slog.NewRecord(new Date(), slog.LevelInfo, "test1", 0));
    h.Handle({}, slog.NewRecord(new Date(), slog.LevelInfo, "test2", 0));

    checkLogMessages(["test1", "test2"], beforeLogs);
    checkLogMessages(["test1", "test2"], h.logs);
    checkLogMessages([], writeLogs);

    h.WriteAll({});

    checkLogMessages(["test1", "test2"], beforeLogs);
    checkLogMessages([], h.logs);
    checkLogMessages(["test1", "test2"], writeLogs);
  });

  it("formats attrs and errors", () => {
    const beforeLogs: Log[] = [];

    const h0 = NewBatchHandler({
      BeforeAddFunc: (_ctx, log) => {
        beforeLogs.push(log);
        return true;
      },
      WriteFunc: () => null,
    });

    const h1 = h0.WithAttrs([slog.Int("a", 1), slog.String("b", "123")]);

    const h2 = h1
      .WithGroup("sub")
      .WithAttrs([slog.Int("c", 3), slog.Any("d", { "d.1": 1 }), slog.Any("e", new Error("example error"))]);

    const record = slog.NewRecord(new Date(), slog.LevelInfo, "hello", 0);
    record.AddAttrs(slog.String("name", "test"));

    h0.Handle({}, record);
    h1.Handle({}, record);
    h2.Handle({}, record);

    const validationErrors = {
      a: newError("validation_code", "validation_message"),
      b: new Error("plain"),
    };

    const wrappedValidationErrors = new ValidationErrors(validationErrors);
    const wrapped = new Error(`wrapped: ${wrappedValidationErrors.message}`, { cause: wrappedValidationErrors });

    const errorsRecord = slog.NewRecord(new Date(), slog.LevelError, "details", 0);
    errorsRecord.Add("validation.Errors", validationErrors);
    errorsRecord.Add("wrapped_validation.Errors", wrapped);
    errorsRecord.Add("map[string]any", {
      a: newError("validation_code", "validation_message"),
      b: new Error("plain"),
      c: "test_any",
      d: {
        nestedA: newError("nested_code", "nested_message"),
        nestedB: new Error("nested_plain"),
      },
    });
    errorsRecord.Add("map[string]error", {
      a: newError("validation_code", "validation_message"),
      b: new Error("plain"),
    });
    errorsRecord.Add("map[string]validation.Error", {
      a: newError("validation_code", "validation_message"),
      b: null,
    });
    errorsRecord.Add("plain_error", new Error("plain"));
    h0.Handle({}, errorsRecord);

    const expected = [
      `{"name":"test"}`,
      `{"a":1,"b":"123","name":"test"}`,
      `{"a":1,"b":"123","sub":{"c":3,"d":{"d.1":1},"e":"example error","name":"test"}}`,
      `{"map[string]any":{"a":"validation_message","b":"plain","c":"test_any","d":{"nestedA":"nested_message","nestedB":"nested_plain"}},"map[string]error":{"a":"validation_message","b":"plain"},"map[string]validation.Error":{"a":"validation_message","b":null},"plain_error":"plain","validation.Errors":{"a":"validation_message","b":"plain"},"wrapped_validation.Errors":{"data":{"a":"validation_message","b":"plain"},"raw":"wrapped: a: validation_message; b: plain."}}`,
    ];

    expect(beforeLogs.length).toBe(expected.length);

    for (const [index, expectedData] of expected.entries()) {
      const log = beforeLogs[index]!;
      const raw = log.Data.MarshalJSON();
      expect(raw).toBe(expectedData);
    }
  });
});

function checkLogMessages(expected: string[], logs: Log[]): void {
  expect(logs.length).toBe(expected.length);

  for (const message of expected) {
    let exists = false;
    for (const log of logs) {
      if (log.Message === message) {
        exists = true;
        break;
      }
    }

    expect(exists).toBe(true);
  }
}
