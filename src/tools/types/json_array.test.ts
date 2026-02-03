// Ported from pocketbase/tools/types/json_array_test.go.

import { describe, expect, it } from "bun:test";
import { JSONArray } from "./json_array.ts";

describe("JSONArray", () => {
  it("MarshalJSON", () => {
    const scenarios: Array<{ json: JSONArray<unknown>; expected: string }> = [
      { json: new JSONArray<unknown>(), expected: "[]" },
      { json: new JSONArray<unknown>(), expected: "[]" },
      { json: new JSONArray<unknown>(1, 2, 3), expected: "[1,2,3]" },
      { json: new JSONArray<unknown>("test1", "test2", "test3"), expected: `["test1","test2","test3"]` },
      { json: new JSONArray<unknown>(1, "test"), expected: `[1,"test"]` },
    ];

    for (const scenario of scenarios) {
      const result = scenario.json.MarshalJSON();
      expect(result).toBe(scenario.expected);
    }
  });

  it("String", () => {
    const scenarios: Array<{ json: JSONArray<unknown>; expected: string }> = [
      { json: new JSONArray<unknown>(), expected: "[]" },
      { json: new JSONArray<unknown>(), expected: "[]" },
      { json: new JSONArray<unknown>(1, 2, 3), expected: "[1,2,3]" },
      { json: new JSONArray<unknown>("test1", "test2", "test3"), expected: `["test1","test2","test3"]` },
      { json: new JSONArray<unknown>(1, "test"), expected: `[1,"test"]` },
    ];

    for (const scenario of scenarios) {
      const result = scenario.json.String();
      expect(result).toBe(scenario.expected);
    }
  });

  it("Value", () => {
    const scenarios: Array<{ json: JSONArray<unknown>; expected: string }> = [
      { json: new JSONArray<unknown>(), expected: "[]" },
      { json: new JSONArray<unknown>(), expected: "[]" },
      { json: new JSONArray<unknown>(1, 2, 3), expected: "[1,2,3]" },
      { json: new JSONArray<unknown>("test1", "test2", "test3"), expected: `["test1","test2","test3"]` },
      { json: new JSONArray<unknown>(1, "test"), expected: `[1,"test"]` },
    ];

    for (const scenario of scenarios) {
      const result = scenario.json.Value();
      expect(result).toBe(scenario.expected);
    }
  });

  it("Scan", () => {
    const scenarios = [
      { value: "", expectError: false, expectJSON: "[]" },
      { value: new Uint8Array(), expectError: false, expectJSON: "[]" },
      { value: null as unknown, expectError: false, expectJSON: "[]" },
      { value: 123, expectError: true, expectJSON: "[]" },
      { value: `""`, expectError: true, expectJSON: "[]" },
      { value: "invalid_json", expectError: true, expectJSON: "[]" },
      { value: `"test"`, expectError: true, expectJSON: "[]" },
      { value: "1,2,3", expectError: true, expectJSON: "[]" },
      { value: "[1, 2, 3", expectError: true, expectJSON: "[]" },
      { value: "[1, 2, 3]", expectError: false, expectJSON: "[1,2,3]" },
      { value: new TextEncoder().encode("[1, 2, 3]"), expectError: false, expectJSON: "[1,2,3]" },
      { value: `[1, "test"]`, expectError: false, expectJSON: `[1,"test"]` },
      { value: "[]", expectError: false, expectJSON: "[]" },
    ];

    for (const scenario of scenarios) {
      const arr = new JSONArray<unknown>();
      const err = arr.Scan(scenario.value);
      const hasErr = err != null;
      expect(hasErr).toBe(scenario.expectError);
      expect(arr.MarshalJSON()).toBe(scenario.expectJSON);
    }
  });
});
