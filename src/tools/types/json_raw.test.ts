// Ported from pocketbase/tools/types/json_raw_test.go.

import { describe, expect, it } from "bun:test";
import { JSONRaw, ParseJSONRaw } from "./json_raw.ts";

describe("JSONRaw", () => {
  it("ParseJSONRaw", () => {
    const scenarios = [
      { value: null as unknown, expectError: false, expectJSON: "null" },
      { value: "", expectError: false, expectJSON: "null" },
      { value: new Uint8Array(), expectError: false, expectJSON: "null" },
      { value: new JSONRaw(), expectError: false, expectJSON: "null" },
      { value: "{}", expectError: false, expectJSON: "{}" },
      { value: "[]", expectError: false, expectJSON: "[]" },
      { value: 123, expectError: false, expectJSON: "123" },
      { value: `""`, expectError: false, expectJSON: `""` },
      { value: "test", expectError: false, expectJSON: "test" },
      { value: `{"invalid"`, expectError: false, expectJSON: `{"invalid"` },
      { value: `{"test":1}`, expectError: false, expectJSON: `{"test":1}` },
      { value: new TextEncoder().encode("[1,2,3]"), expectError: false, expectJSON: "[1,2,3]" },
      { value: [1, 2, 3], expectError: false, expectJSON: "[1,2,3]" },
      {
        value: { test: new TextDecoder().decode(Uint8Array.of(0x61, 0xc3)) },
        expectError: false,
        expectJSON: `{"test":"a�"}`,
      },
    ];

    for (const scenario of scenarios) {
      const [raw, err] = ParseJSONRaw(scenario.value);
      const hasErr = err != null;
      expect(hasErr).toBe(scenario.expectError);
      expect(raw.MarshalJSON()).toBe(scenario.expectJSON);
    }
  });

  it("String", () => {
    const scenarios: Array<{ json: JSONRaw; expected: string }> = [
      { json: new JSONRaw(), expected: "null" },
      { json: new JSONRaw(), expected: "null" },
      { json: new JSONRaw("123"), expected: "123" },
      { json: new JSONRaw(`{"demo":123}`), expected: `{"demo":123}` },
    ];

    for (const scenario of scenarios) {
      const result = scenario.json.String();
      expect(result).toBe(scenario.expected);
    }
  });

  it("MarshalJSON", () => {
    const scenarios: Array<{ json: JSONRaw; expected: string }> = [
      { json: new JSONRaw(), expected: "null" },
      { json: new JSONRaw(), expected: "null" },
      { json: new JSONRaw("123"), expected: "123" },
      { json: new JSONRaw(`{"demo":123}`), expected: `{"demo":123}` },
    ];

    for (const scenario of scenarios) {
      const result = scenario.json.MarshalJSON();
      expect(result).toBe(scenario.expected);
    }
  });

  it("UnmarshalJSON", () => {
    const scenarios = [
      { json: null as unknown as Uint8Array, expectString: "null" },
      { json: new Uint8Array([0, 1, 2]), expectString: "\u0000\u0001\u0002" },
      { json: "123", expectString: "123" },
      { json: "test", expectString: "test" },
      { json: `{"test":123}`, expectString: `{"test":123}` },
    ];

    for (const scenario of scenarios) {
      const raw = new JSONRaw();
      raw.UnmarshalJSON(scenario.json as string | Uint8Array | null);
      expect(raw.String()).toBe(scenario.expectString);
    }
  });

  it("Value", () => {
    const scenarios = [
      { json: new JSONRaw(), expected: null },
      { json: new JSONRaw(), expected: null },
      { json: new JSONRaw(""), expected: null },
      { json: new JSONRaw("test"), expected: "test" },
    ];

    for (const scenario of scenarios) {
      const result = scenario.json.Value();
      expect(result).toBe(scenario.expected);
    }
  });

  it("Scan", () => {
    const scenarios = [
      { value: null as unknown, expectError: false, expectJSON: "null" },
      { value: "", expectError: false, expectJSON: "null" },
      { value: new Uint8Array(), expectError: false, expectJSON: "null" },
      { value: new JSONRaw(), expectError: false, expectJSON: "null" },
      { value: new JSONRaw("test"), expectError: false, expectJSON: "test" },
      { value: "{}", expectError: false, expectJSON: "{}" },
      { value: "[]", expectError: false, expectJSON: "[]" },
      { value: 123, expectError: false, expectJSON: "123" },
      { value: `""`, expectError: false, expectJSON: `""` },
      { value: "test", expectError: false, expectJSON: "test" },
      { value: `{"invalid"`, expectError: false, expectJSON: `{"invalid"` },
      { value: `{"test":1}`, expectError: false, expectJSON: `{"test":1}` },
      { value: new TextEncoder().encode("[1,2,3]"), expectError: false, expectJSON: "[1,2,3]" },
      { value: [1, 2, 3], expectError: false, expectJSON: "[1,2,3]" },
      { value: { test: 1 }, expectError: false, expectJSON: `{"test":1}` },
    ];

    for (const scenario of scenarios) {
      const raw = new JSONRaw();
      const err = raw.Scan(scenario.value);
      const hasErr = err != null;
      expect(hasErr).toBe(scenario.expectError);
      expect(raw.MarshalJSON()).toBe(scenario.expectJSON);
    }
  });
});
