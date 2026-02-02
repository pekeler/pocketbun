// Ported from pocketbase/tools/dbutils/select_test.go

import { describe, expect, it } from "bun:test";
import { aliasOrIdentifier } from "./select.ts";

describe("dbutils select", () => {
  it("aliasOrIdentifier", () => {
    const scenarios = [
      { value: "", expected: "" },
      { value: "abc", expected: "abc" },
      { value: "abc  ", expected: "abc  " },
      { value: "abc.def", expected: "abc.def" },
      { value: "abc.123 def", expected: "def" },
      { value: "abc.123 as def.456", expected: "def.456" },
      { value: "(abc) def", expected: "def" },
      { value: "(abc) as def", expected: "def" },
      { value: "abc   def", expected: "def" },
      { value: "abc as   def", expected: "def" },
      { value: "a b c d", expected: "d" },
      { value: "a b c as d", expected: "d" },
    ];

    for (const scenario of scenarios) {
      expect(aliasOrIdentifier(scenario.value)).toBe(scenario.expected);
    }
  });
});
