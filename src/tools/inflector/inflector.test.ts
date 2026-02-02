// Ported from pocketbase/tools/inflector/inflector_test.go

import { describe, expect, it } from "bun:test";
import { camelize, columnify, sanitize, sentenize, snakecase, ucFirst } from "./inflector.ts";

describe("inflector", () => {
  it("ucFirst", () => {
    const scenarios = [
      { val: "", expected: "" },
      { val: " ", expected: " " },
      { val: "Test", expected: "Test" },
      { val: "test", expected: "Test" },
      { val: "test test2", expected: "Test test2" },
    ];

    for (const scenario of scenarios) {
      expect(ucFirst(scenario.val)).toBe(scenario.expected);
    }
  });

  it("columnify", () => {
    const scenarios = [
      { val: "", expected: "" },
      { val: "   ", expected: "" },
      { val: "123", expected: "123" },
      { val: "Test.", expected: "Test." },
      { val: " test ", expected: "test" },
      { val: "test1.test2", expected: "test1.test2" },
      { val: "@test!abc", expected: "@testabc" },
      { val: "#test?abc", expected: "#testabc" },
      { val: "123test(123)#", expected: "123test123#" },
      { val: "test1--test2", expected: "test1--test2" },
    ];

    for (const scenario of scenarios) {
      expect(columnify(scenario.val)).toBe(scenario.expected);
    }
  });

  it("sentenize", () => {
    const scenarios = [
      { val: "", expected: "" },
      { val: "   ", expected: "" },
      { val: ".", expected: "." },
      { val: "?", expected: "?" },
      { val: "!", expected: "!" },
      { val: "Test", expected: "Test." },
      { val: " test ", expected: "Test." },
      { val: "hello world", expected: "Hello world." },
      { val: "hello world.", expected: "Hello world." },
      { val: "hello world!", expected: "Hello world!" },
      { val: "hello world?", expected: "Hello world?" },
    ];

    for (const scenario of scenarios) {
      expect(sentenize(scenario.val)).toBe(scenario.expected);
    }
  });

  it("sanitize", () => {
    const scenarios = [
      { val: "", pattern: "", expected: "", expectError: false },
      { val: " ", pattern: "", expected: " ", expectError: false },
      { val: " ", pattern: " ", expected: "", expectError: false },
      { val: "", pattern: "[A-Z]", expected: "", expectError: false },
      { val: "abcABC", pattern: "[A-Z]", expected: "abc", expectError: false },
      { val: "abcABC", pattern: "[A-Z", expected: "", expectError: true },
    ];

    for (const scenario of scenarios) {
      const result = tryCall(() => sanitize(scenario.val, scenario.pattern));
      expect(Boolean(result.error)).toBe(scenario.expectError);
      if (!result.error) {
        expect(result.value).toBe(scenario.expected);
      }
    }
  });

  it("snakecase", () => {
    const scenarios = [
      { val: "", expected: "" },
      { val: "  ", expected: "" },
      { val: "!@#$%^", expected: "" },
      { val: "...", expected: "" },
      { val: "_", expected: "" },
      { val: "John Doe", expected: "john_doe" },
      { val: "John_Doe", expected: "john_doe" },
      { val: ".a!b@c#d$e%123. ", expected: "a_b_c_d_e_123" },
      { val: "HelloWorld", expected: "hello_world" },
      { val: "HelloWorld1HelloWorld2", expected: "hello_world1_hello_world2" },
      { val: "TEST", expected: "test" },
      { val: "testABR", expected: "test_abr" },
    ];

    for (const scenario of scenarios) {
      expect(snakecase(scenario.val)).toBe(scenario.expected);
    }
  });

  it("camelize", () => {
    const scenarios = [
      { val: "", expected: "" },
      { val: " ", expected: "" },
      { val: "Test", expected: "Test" },
      { val: "test", expected: "Test" },
      { val: "testTest2", expected: "TestTest2" },
      { val: "TestTest2", expected: "TestTest2" },
      { val: "test test2", expected: "TestTest2" },
      { val: "test-test2", expected: "TestTest2" },
      { val: "test'test2", expected: "TestTest2" },
      { val: "test1test2", expected: "Test1test2" },
      { val: "1test-test2", expected: "1testTest2" },
      { val: "123", expected: "123" },
      { val: "123a", expected: "123a" },
    ];

    for (const scenario of scenarios) {
      expect(camelize(scenario.val)).toBe(scenario.expected);
    }
  });
});

function tryCall<T>(fn: () => T): { value: T | null; error: unknown } {
  try {
    return { value: fn(), error: null };
  } catch (error) {
    return { value: null, error };
  }
}
