// PocketBun-only: regression tests for internal cast helpers.
//
// Why this file exists:
// `src/internal/compat/cast.ts` is a PocketBun runtime shim used by many API
// and field paths. These tests lock conversion behavior to prevent drift.

import { describe, expect, it } from "bun:test";
import { toBoolValue, toNumberValue, toStringValue } from "./cast.ts";

describe("cast helpers", () => {
  describe("toStringValue", () => {
    it("handles primitives and nullish values", () => {
      expect(toStringValue(null)).toBe("");
      expect(toStringValue(undefined)).toBe("");
      expect(toStringValue("test")).toBe("test");
      expect(toStringValue(123)).toBe("123");
      expect(toStringValue(true)).toBe("true");
      expect(toStringValue(10n)).toBe("10");
    });

    it("handles Date and object conversions", () => {
      const date = new Date("2026-02-26T00:00:00.000Z");
      expect(toStringValue(date)).toBe("2026-02-26T00:00:00.000Z");

      expect(
        toStringValue({
          valueOf: () => 99,
          toString: () => "ignored",
        }),
      ).toBe("99");

      expect(
        toStringValue({
          valueOf: () => ({ nested: true }),
          toString: () => "fallback",
        }),
      ).toBe("fallback");
    });

    it("returns empty string for plain objects", () => {
      expect(toStringValue({})).toBe("");
    });
  });

  describe("toBoolValue", () => {
    it("converts booleans, numbers, and bigints", () => {
      expect(toBoolValue(true)).toBe(true);
      expect(toBoolValue(false)).toBe(false);
      expect(toBoolValue(1)).toBe(true);
      expect(toBoolValue(0)).toBe(false);
      expect(toBoolValue(-1)).toBe(true);
      expect(toBoolValue(1n)).toBe(true);
      expect(toBoolValue(0n)).toBe(false);
    });

    it("converts supported string values", () => {
      expect(toBoolValue(" true ")).toBe(true);
      expect(toBoolValue("YES")).toBe(true);
      expect(toBoolValue("on")).toBe(true);
      expect(toBoolValue("0")).toBe(false);
      expect(toBoolValue("No")).toBe(false);
      expect(toBoolValue("")).toBe(false);
      expect(toBoolValue("custom")).toBe(true);
    });
  });

  describe("toNumberValue", () => {
    it("converts primitives and Date values", () => {
      const date = new Date("1970-01-01T00:00:01.234Z");

      expect(toNumberValue(12)).toBe(12);
      expect(toNumberValue(12n)).toBe(12);
      expect(toNumberValue(true)).toBe(1);
      expect(toNumberValue(false)).toBe(0);
      expect(toNumberValue(date)).toBe(1234);
    });

    it("converts string values and special tokens", () => {
      expect(toNumberValue(" 123 ")).toBe(123);
      expect(toNumberValue("")).toBe(0);
      expect(toNumberValue("abc")).toBe(0);
      expect(toNumberValue("nan")).toBeNaN();
      expect(toNumberValue("+inf")).toBe(Number.POSITIVE_INFINITY);
      expect(toNumberValue("-Infinity")).toBe(Number.NEGATIVE_INFINITY);
    });

    it("returns 0 for unsupported objects", () => {
      expect(toNumberValue({ value: 1 })).toBe(0);
    });
  });
});
