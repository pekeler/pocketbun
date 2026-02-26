// PocketBun-only: regression tests for the minimal slog compatibility shim.
//
// Why this file exists:
// `src/internal/compat/slog.ts` is a runtime bridge used by logger/base app
// paths. These tests lock the shim behavior independent of upstream Go tests.

import { describe, expect, it } from "bun:test";
import * as slog from "./slog.ts";

function collectAttrs(record: slog.Record): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  record.Attrs((attr) => {
    result[attr.Key] = attr.Value.Any();
    return true;
  });
  return result;
}

describe("slog compat shim", () => {
  it("supports level helpers", () => {
    const level = new slog.Level(7);
    expect(level.Level()).toBe(level);
    expect(level.Value()).toBe(7);
    expect(level.valueOf()).toBe(7);
    expect(level.toString()).toBe("7");
  });

  it("supports Attr/Value helpers and LogValue resolution", () => {
    const anyAttr = slog.Any("count", 3);
    expect(anyAttr.Key).toBe("count");
    expect(anyAttr.Value.Kind()).toBe(slog.Kind.Any);
    expect(anyAttr.Value.Any()).toBe(3);

    const groupAttr = slog.Group("meta", slog.String("name", "test"), slog.Int("age", 2));
    expect(groupAttr.Value.Kind()).toBe(slog.Kind.Group);
    expect(groupAttr.Value.Group().map((attr) => attr.Key)).toEqual(["name", "age"]);

    const unresolved = new slog.Value(slog.Kind.Any, {
      LogValue: () => new slog.Value(slog.Kind.Any, 42),
    });
    expect(unresolved.Resolve().Any()).toBe(42);
  });

  it("supports Record operations", () => {
    const record = new slog.Record(new Date("2026-02-26T00:00:00.000Z"), slog.LevelInfo, "hello", 123);
    record.Add("a", 1);
    record.AddAttrs(slog.String("b", "two"));

    expect(record.NumAttrs()).toBe(2);

    const seen: string[] = [];
    record.Attrs((attr) => {
      seen.push(attr.Key);
      return attr.Key !== "a";
    });
    expect(seen).toEqual(["a"]);

    const clone = record.Clone();
    expect(clone).not.toBe(record);
    expect(clone.NumAttrs()).toBe(2);
    expect(collectAttrs(clone)).toEqual({ a: 1, b: "two" });
  });

  it("maps Logger args to attrs and calls the handler", () => {
    const handled: slog.Record[] = [];
    const handler: slog.Handler = {
      Enabled: () => true,
      Handle: (_ctx, record) => {
        handled.push(record.Clone());
        return null;
      },
      WithAttrs: () => handler,
      WithGroup: () => handler,
    };

    const logger = slog.New(handler);
    logger.Log({}, slog.LevelInfo, "message", "name", "alice", slog.Int("count", 3), 100);

    expect(handled).toHaveLength(1);
    expect(handled[0]?.Message).toBe("message");
    expect(collectAttrs(handled[0]!)).toEqual({
      name: "alice",
      count: 3,
      "100": undefined,
    });
  });

  it("skips Handle when handler is disabled", () => {
    let calls = 0;
    const handler: slog.Handler = {
      Enabled: () => false,
      Handle: () => {
        calls += 1;
        return null;
      },
      WithAttrs: () => handler,
      WithGroup: () => handler,
    };

    const logger = slog.New(handler);
    logger.Info("ignored");
    expect(calls).toBe(0);
  });

  it("swallows async handler rejections", async () => {
    const handler: slog.Handler = {
      Enabled: () => true,
      Handle: async () => {
        throw new Error("boom");
      },
      WithAttrs: () => handler,
      WithGroup: () => handler,
    };

    const logger = slog.New(handler);
    logger.Error("example");
    await Promise.resolve();
  });

  it.serial("updates default logger with SetDefault", () => {
    const original = slog.Default();
    const replacement = slog.New({
      Enabled: () => true,
      Handle: () => null,
      WithAttrs: function withAttrs() {
        return this;
      },
      WithGroup: function withGroup() {
        return this;
      },
    });

    try {
      slog.SetDefault(replacement);
      expect(slog.Default()).toBe(replacement);
    } finally {
      slog.SetDefault(original);
    }
  });
});
