// Ported from pocketbase/tools/types/json_map_test.go.

import { describe, expect, it } from "bun:test";
import { JSONMap } from "./json_map.ts";

describe("JSONMap", () => {
  it("MarshalJSON", () => {
    const scenarios: Array<{ json: JSONMap<unknown>; expected: string }> = [
      { json: new JSONMap(), expected: "{}" },
      { json: new JSONMap(), expected: "{}" },
      {
        json: new JSONMap({
          test1: 123,
          test2: new TextDecoder().decode(Uint8Array.of(0x6c, 0x6f, 0x72, 0x65, 0x6d, 0xc3)),
        }),
        expected: `{"test1":123,"test2":"lorem�"}`,
      },
      { json: new JSONMap({ test: [1, 2, 3] }), expected: `{"test":[1,2,3]}` },
      { json: new JSONMap({ z: 1, a: { z: 2, a: 3 } }), expected: `{"a":{"a":3,"z":2},"z":1}` },
    ];

    for (const scenario of scenarios) {
      const result = scenario.json.MarshalJSON();
      expect(result).toBe(scenario.expected);
    }
  });

  it("String", () => {
    const scenarios: Array<{ json: JSONMap<unknown>; expected: string }> = [
      { json: new JSONMap(), expected: "{}" },
      { json: new JSONMap(), expected: "{}" },
      { json: new JSONMap({ test1: 123, test2: "lorem" }), expected: `{"test1":123,"test2":"lorem"}` },
      { json: new JSONMap({ test: [1, 2, 3] }), expected: `{"test":[1,2,3]}` },
    ];

    for (const scenario of scenarios) {
      const result = scenario.json.String();
      expect(result).toBe(scenario.expected);
    }
  });

  it("Get", () => {
    const scenarios = [
      { json: new JSONMap(), key: "test", expected: undefined },
      { json: new JSONMap({ test: 123 }), key: "test", expected: 123 },
      { json: new JSONMap({ test: 123 }), key: "missing", expected: undefined },
    ];

    for (const scenario of scenarios) {
      const result = scenario.json.Get(scenario.key);
      expect(result).toBe(scenario.expected);
    }
  });

  it("Set", () => {
    const scenarios = [
      { key: "a", value: null },
      { key: "a", value: 123 },
      { key: "b", value: "test" },
    ];

    for (const scenario of scenarios) {
      const map = new JSONMap<unknown>({ stale: true });
      map.Set(scenario.key, scenario.value);
      expect(map.Get(scenario.key)).toBe(scenario.value);
    }
  });

  it("Value", () => {
    const scenarios: Array<{ json: JSONMap<unknown>; expected: string }> = [
      { json: new JSONMap(), expected: "{}" },
      { json: new JSONMap(), expected: "{}" },
      { json: new JSONMap({ test1: 123, test2: "lorem" }), expected: `{"test1":123,"test2":"lorem"}` },
      { json: new JSONMap({ test: [1, 2, 3] }), expected: `{"test":[1,2,3]}` },
    ];

    for (const scenario of scenarios) {
      const result = scenario.json.Value();
      expect(result).toBe(scenario.expected);
    }
  });

  it("Scan", () => {
    const scenarios = [
      { value: "", expectError: false, expectJSON: "{}" },
      { value: null as unknown, expectError: false, expectJSON: "{}" },
      { value: new Uint8Array(), expectError: false, expectJSON: "{}" },
      { value: "{}", expectError: false, expectJSON: "{}" },
      { value: 123, expectError: true, expectJSON: "{}" },
      { value: `""`, expectError: true, expectJSON: "{}" },
      { value: "invalid_json", expectError: true, expectJSON: "{}" },
      { value: `"test"`, expectError: true, expectJSON: "{}" },
      { value: "1,2,3", expectError: true, expectJSON: "{}" },
      { value: `{"test": 1`, expectError: true, expectJSON: "{}" },
      { value: `{"test": 1}`, expectError: false, expectJSON: `{"test":1}` },
      { value: new TextEncoder().encode(`{"test": 1}`), expectError: false, expectJSON: `{"test":1}` },
    ];

    for (const scenario of scenarios) {
      const map = new JSONMap<unknown>();
      const err = map.Scan(scenario.value);
      const hasErr = err != null;
      expect(hasErr).toBe(scenario.expectError);
      expect(map.MarshalJSON()).toBe(scenario.expectJSON);
    }
  });
});
