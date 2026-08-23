// Ported from pocketbase/tools/store/store_test.go

import { describe, expect, it } from "bun:test";
import { ShrinkThreshold, Store } from "./store.ts";

describe("store", () => {
  it("New", () => {
    const data = { test1: 1, test2: 2 };
    const originalRawData = JSON.stringify(data);

    const s = new Store<string, number>(data);
    s.set("test3", 3);
    s.remove("test1");

    const rawData = JSON.stringify(data);
    expect(rawData).toBe(originalRawData);

    expect(s.has("test1")).toBe(false);
    expect(s.get("test2")).toBe(2);
    expect(s.get("test3")).toBe(3);
  });

  it("Reset", () => {
    const s = new Store<string, number>({ test1: 1 });

    const data = { test2: 2 };
    const originalRawData = JSON.stringify(data);

    s.reset(data);
    s.set("test3", 3);

    const rawData = JSON.stringify(data);
    expect(rawData).toBe(originalRawData);

    expect(s.has("test1")).toBe(false);
    expect(s.get("test2")).toBe(2);
    expect(s.get("test3")).toBe(3);
  });

  it("Length", () => {
    const s = new Store<string, number>({ test1: 1 });
    s.set("test2", 2);

    expect(s.length()).toBe(2);
  });

  it("RemoveAll", () => {
    const s = new Store<string, boolean>({ test1: true, test2: true });

    s.removeAll();

    for (const key of ["test1", "test2"]) {
      expect(s.has(key)).toBe(false);
    }
  });

  it("Remove", () => {
    const s = new Store<string, boolean>({ test: true });

    for (const key of ["test", "missing"]) {
      s.remove(key);
      expect(s.has(key)).toBe(false);
    }
  });

  it("Has", () => {
    const s = new Store<string, number>({ test1: 0, test2: 1 });

    const scenarios = [
      { key: "test1", exist: true },
      { key: "test2", exist: true },
      { key: "missing", exist: false },
    ];

    for (const scenario of scenarios) {
      expect(s.has(scenario.key)).toBe(scenario.exist);
    }
  });

  it("Get", () => {
    const s = new Store<string, number>({ test1: 0, test2: 1 });

    const scenarios = [
      { key: "test1", expect: 0 },
      { key: "test2", expect: 1 },
      { key: "missing", expect: 0 },
    ];

    for (const scenario of scenarios) {
      expect(s.get(scenario.key)).toBe(scenario.expect);
    }
  });

  it("GetOk", () => {
    const s = new Store<string, number>({ test1: 0, test2: 1 });

    const scenarios = [
      { key: "test1", expectValue: 0, expectOk: true },
      { key: "test2", expectValue: 1, expectOk: true },
      { key: "missing", expectValue: 0, expectOk: false },
    ];

    for (const scenario of scenarios) {
      const [value, ok] = s.getOk(scenario.key);
      expect(ok).toBe(scenario.expectOk);
      expect(value).toBe(scenario.expectValue);
    }
  });

  it("GetAll", () => {
    const data = { a: 1, b: 2 };
    const s = new Store<string, number>(data);

    const result = s.getAll();
    for (const key of result.keys()) {
      result.delete(key);
    }

    const refetched = s.getAll();
    expect(refetched.size).toBe(Object.keys(data).length);

    for (const [key, value] of refetched.entries()) {
      expect(value).toBe(data[key as keyof typeof data]);
    }
  });

  it("Values", () => {
    const data = { a: 1, b: 2 };
    const values = new Store<string, number>(data).values();

    const expected = [1, 2];
    expect(values.length).toBe(expected.length);

    for (const value of expected) {
      expect(values.includes(value)).toBe(true);
    }
  });

  it("Keys", () => {
    const keys = new Store<string, number>({ a: 1, b: 2 }).keys();

    expect(keys).toHaveLength(2);
    expect(keys).toContain("a");
    expect(keys).toContain("b");
  });

  it("Set", () => {
    const s = new Store<string, number>(null, 0);

    const data = { test1: 0, test2: 1, test3: 3 };

    for (const [key, value] of Object.entries(data)) {
      s.set(key, value);
    }

    for (const [key, value] of Object.entries(data)) {
      expect(s.has(key)).toBe(true);
      expect(s.get(key)).toBe(value);
    }
  });

  it("SetFunc", () => {
    const s = new Store<string, number>(null, 0);

    s.setFunc("test", (old) => {
      expect(old).toBe(0);
      return (old ?? 0) + 2;
    });
    expect(s.get("test")).toBe(2);

    s.setFunc("test", (old) => {
      expect(old).toBe(2);
      return (old ?? 0) + 1;
    });
    expect(s.get("test")).toBe(3);
  });

  it("GetOrSet", () => {
    const s = new Store<string, number>({ test1: 0, test2: 1, test3: 3 });

    const scenarios = [
      { key: "test2", value: 20, expected: 1 },
      { key: "test3", value: 2, expected: 3 },
      { key: "test_new", value: 20, expected: 20 },
      { key: "test_new", value: 50, expected: 20 },
    ];

    for (const scenario of scenarios) {
      const result = s.getOrSet(scenario.key, () => scenario.value);
      expect(result).toBe(scenario.expected);
    }
  });

  it("GetOrSet preserves values assigned during setFunc", () => {
    const s = new Store<string, number>(null, 0);

    const result = s.getOrSet("test", () => {
      s.set("test", 10);
      return 20;
    });

    expect(result).toBe(10);
    expect(s.get("test")).toBe(10);
  });

  it("SetIfLessThanLimit", () => {
    const s = new Store<string, number>(null, 0);
    const limit = 2;

    const scenarios = [
      { key: "test1", value: 1, expected: true },
      { key: "test2", value: 2, expected: true },
      { key: "test3", value: 3, expected: false },
      { key: "test2", value: 4, expected: true },
    ];

    for (const scenario of scenarios) {
      const result = s.setIfLessThanLimit(scenario.key, scenario.value, limit);
      expect(result).toBe(scenario.expected);

      if (!scenario.expected) {
        expect(s.has(scenario.key)).toBe(false);
      }

      if (scenario.expected) {
        expect(s.get(scenario.key)).toBe(scenario.value);
      }
    }
  });

  it("LoadJSON", () => {
    const s = new Store<string, string>(null, "");
    s.set("b", "old");
    s.set("c", "test3");

    s.loadJSON('{"a":"test1", "b":"test2"}');

    expect(s.get("a")).toBe("test1");
    expect(s.get("b")).toBe("test2");
    expect(s.get("c")).toBe("test3");
  });

  it("toJSON", () => {
    const s = new Store<string, string>(null, "");
    s.set("a", "test1");
    s.set("b", "test2");

    const expected = '{"a":"test1", "b":"test2"}';
    const result = JSON.stringify(s);

    expect(result).not.toBe(expected);
  });

  it("Shrink", () => {
    const s = new Store<string, number>(null, 0);
    const total = 1000;

    for (let i = 0; i < total; i += 1) {
      s.set(String(i), i);
    }

    expect(s.length()).toBe(total);

    for (let i = 0; i < ShrinkThreshold; i += 1) {
      s.remove(String(i));
    }

    expect(s.length()).toBe(total - ShrinkThreshold);

    for (const key of s.getAll().keys()) {
      const keyInt = Number.parseInt(key, 10);
      if (Number.isNaN(keyInt)) {
        throw new Error(`failed to convert ${key} into int`);
      }
      expect(keyInt).toBeGreaterThanOrEqual(ShrinkThreshold);
    }
  });
});
