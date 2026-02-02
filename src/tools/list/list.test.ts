// Ported from pocketbase/tools/list/list_test.go

import { describe, expect, it } from "bun:test";
import { JSONArray } from "../types/json_array.ts";
import {
  existInSlice,
  existInSliceWithRegex,
  nonzeroUniques,
  subtractSlice,
  toChunks,
  toInterfaceSlice,
  toUniqueStringSlice,
} from "./list.ts";

describe("list", () => {
  it("subtractSlice (string)", () => {
    const scenarios = [
      { base: [] as string[], subtract: [] as string[], expected: "[]" },
      { base: [] as string[], subtract: ["1", "2", "3", "4"], expected: "[]" },
      { base: ["1", "2", "3", "4"], subtract: [] as string[], expected: '["1","2","3","4"]' },
      { base: ["1", "2", "3", "4"], subtract: ["1", "2", "3", "4"], expected: "[]" },
      { base: ["1", "2", "3", "4", "7"], subtract: ["2", "4", "5", "6"], expected: '["1","3","7"]' },
    ];

    for (const scenario of scenarios) {
      const result = subtractSlice(scenario.base, scenario.subtract);
      const raw = JSON.stringify(result);
      expect(raw).toBe(scenario.expected);
    }
  });

  it("subtractSlice (int)", () => {
    const scenarios = [
      { base: [] as number[], subtract: [] as number[], expected: "[]" },
      { base: [] as number[], subtract: [1, 2, 3, 4], expected: "[]" },
      { base: [1, 2, 3, 4], subtract: [] as number[], expected: "[1,2,3,4]" },
      { base: [1, 2, 3, 4], subtract: [1, 2, 3, 4], expected: "[]" },
      { base: [1, 2, 3, 4, 7], subtract: [2, 4, 5, 6], expected: "[1,3,7]" },
    ];

    for (const scenario of scenarios) {
      const result = subtractSlice(scenario.base, scenario.subtract);
      const raw = JSON.stringify(result);
      expect(raw).toBe(scenario.expected);
    }
  });

  it("existInSlice (string)", () => {
    const scenarios = [
      { item: "", list: [""], expected: true },
      { item: "", list: ["1", "2", "test 123"], expected: false },
      { item: "test", list: [] as string[], expected: false },
      { item: "test", list: ["TEST"], expected: false },
      { item: "test", list: ["1", "2", "test 123"], expected: false },
      { item: "test", list: ["1", "2", "test"], expected: true },
    ];

    for (const scenario of scenarios) {
      expect(existInSlice(scenario.item, scenario.list)).toBe(scenario.expected);
    }
  });

  it("existInSlice (int)", () => {
    const scenarios = [
      { item: 0, list: [] as number[], expected: false },
      { item: 0, list: [0], expected: true },
      { item: 4, list: [1, 2, 3], expected: false },
      { item: 1, list: [1, 2, 3], expected: true },
      { item: -1, list: [0, 1, 2, 3], expected: false },
      { item: -1, list: [0, -1, -2, -3, -4], expected: true },
    ];

    for (const scenario of scenarios) {
      expect(existInSlice(scenario.item, scenario.list)).toBe(scenario.expected);
    }
  });

  it("existInSliceWithRegex", () => {
    const scenarios = [
      { item: "", list: [""], expected: true },
      { item: "", list: ["^\\W+$"], expected: false },
      { item: " ", list: ["^\\W+$"], expected: true },
      { item: "test", list: ["^\\invalid[+$"], expected: false },
      { item: "test", list: ["^\\W+$", "test"], expected: true },
      { item: "^\\W+$", list: ["^\\W+$", "test"], expected: false },
      { item: "\\W+$", list: ["\\W+$", "test"], expected: true },
      { item: "!?@", list: ["\\W+$", "test"], expected: false },
      { item: "!?@", list: ["^\\W+", "test"], expected: false },
      { item: "!?@", list: ["^\\W+$", "test"], expected: true },
      { item: "!?@test", list: ["^\\W+$", "test"], expected: false },
    ];

    for (const scenario of scenarios) {
      expect(existInSliceWithRegex(scenario.item, scenario.list)).toBe(scenario.expected);
    }
  });

  it("toInterfaceSlice", () => {
    const scenarios = [
      { items: [] as string[] },
      { items: [""] },
      { items: ["1", "test"] },
      { items: ["test1", "test1", "test2", "test3"] },
    ];

    for (const scenario of scenarios) {
      const result = toInterfaceSlice(scenario.items);
      expect(result.length).toBe(scenario.items.length);
      for (let i = 0; i < result.length; i += 1) {
        expect(result[i]).toBe(scenario.items[i]);
      }
    }
  });

  it("nonzeroUniques", () => {
    const scenarios = [
      { items: [] as string[], expected: [] as string[] },
      { items: [""], expected: [] as string[] },
      { items: ["1", "test"], expected: ["1", "test"] },
      { items: ["test1", "", "test2", "Test2", "test1", "test3"], expected: ["test1", "test2", "Test2", "test3"] },
    ];

    for (const scenario of scenarios) {
      const result = nonzeroUniques(scenario.items);
      expect(result.length).toBe(scenario.expected.length);
      for (let i = 0; i < result.length; i += 1) {
        expect(result[i]).toBe(scenario.expected[i]);
      }
    }
  });

  it("toUniqueStringSlice", () => {
    const scenarios = [
      { value: null, expected: [] as string[] },
      { value: "", expected: [] as string[] },
      { value: [] as unknown[], expected: [] as string[] },
      { value: [] as number[], expected: [] as string[] },
      { value: "test", expected: ["test"] },
      { value: [1, 2, 3], expected: ["1", "2", "3"] },
      { value: [0, 1, "test", ""], expected: ["0", "1", "test"] },
      { value: ["test1", "test2", "test1"], expected: ["test1", "test2"] },
      { value: '["test1", "test2", "test2"]', expected: ["test1", "test2"] },
      { value: new JSONArray("test1", "test2", "test1"), expected: ["test1", "test2"] },
    ];

    for (const scenario of scenarios) {
      const result = toUniqueStringSlice(scenario.value);
      expect(result.length).toBe(scenario.expected.length);
      for (let i = 0; i < result.length; i += 1) {
        expect(result[i]).toBe(scenario.expected[i]);
      }
    }
  });

  it("toChunks", () => {
    const scenarios = [
      { items: null as unknown[] | null, chunkSize: 2, expected: "[]" },
      { items: [] as unknown[], chunkSize: 2, expected: "[]" },
      { items: [1, 2, 3, 4], chunkSize: -1, expected: "[[1],[2],[3],[4]]" },
      { items: [1, 2, 3, 4], chunkSize: 0, expected: "[[1],[2],[3],[4]]" },
      { items: [1, 2, 3, 4], chunkSize: 2, expected: "[[1,2],[3,4]]" },
      { items: [1, 2, 3, 4, 5], chunkSize: 2, expected: "[[1,2],[3,4],[5]]" },
      { items: [1, 2, 3, 4, 5], chunkSize: 10, expected: "[[1,2,3,4,5]]" },
    ];

    for (const scenario of scenarios) {
      const result = toChunks(scenario.items ?? [], scenario.chunkSize);
      const raw = JSON.stringify(result);
      expect(raw).toBe(scenario.expected);
    }
  });
});
