// Ported from pocketbase/tools/search/sort_test.go.

import { describe, expect, it } from "bun:test";
import { SimpleFieldResolver } from "./simple_field_resolver.ts";
import { buildSortExpr, parseSortFromString, SortAsc, SortDesc } from "./sort.ts";

describe("search sort", () => {
  it("build sort expression", () => {
    const resolver = new SimpleFieldResolver("test1", "test2", "test3", "test4.sub");

    const scenarios = [
      { sortField: { name: "", direction: SortDesc }, expectError: true, expectExpression: "" },
      { sortField: { name: "unknown", direction: SortAsc }, expectError: true, expectExpression: "" },
      { sortField: { name: "'test'", direction: SortAsc }, expectError: true, expectExpression: "" },
      { sortField: { name: "null", direction: SortAsc }, expectError: true, expectExpression: "" },
      { sortField: { name: "test1", direction: SortAsc }, expectError: false, expectExpression: "[[test1]] ASC" },
      { sortField: { name: "test1", direction: SortDesc }, expectError: false, expectExpression: "[[test1]] DESC" },
      { sortField: { name: "@random", direction: SortDesc }, expectError: false, expectExpression: "RANDOM()" },
      { sortField: { name: "@rowid", direction: SortDesc }, expectError: false, expectExpression: "[[_rowid_]] DESC" },
    ];

    for (const scenario of scenarios) {
      let result: string | null = null;
      let err: unknown = null;
      try {
        result = buildSortExpr(scenario.sortField, resolver);
      } catch (error) {
        err = error;
      }

      const hasErr = err != null;
      expect(hasErr).toBe(scenario.expectError);

      if (scenario.expectError) {
        continue;
      }

      expect(result).toBe(scenario.expectExpression);
    }
  });

  it("parse sort from string", () => {
    const scenarios = [
      { value: "", expected: `[{"name":"","direction":"ASC"}]` },
      { value: "test", expected: `[{"name":"test","direction":"ASC"}]` },
      { value: "+test", expected: `[{"name":"test","direction":"ASC"}]` },
      { value: "-test", expected: `[{"name":"test","direction":"DESC"}]` },
      {
        value: "test1,-test2,+test3",
        expected: `[{"name":"test1","direction":"ASC"},{"name":"test2","direction":"DESC"},{"name":"test3","direction":"ASC"}]`,
      },
      {
        value: "@random,-test",
        expected: `[{"name":"@random","direction":"ASC"},{"name":"test","direction":"DESC"}]`,
      },
      {
        value: "-@rowid,-test",
        expected: `[{"name":"@rowid","direction":"DESC"},{"name":"test","direction":"DESC"}]`,
      },
    ];

    for (const scenario of scenarios) {
      const result = parseSortFromString(scenario.value);
      const encoded = JSON.stringify(result);
      expect(encoded).toBe(scenario.expected);
    }
  });
});
