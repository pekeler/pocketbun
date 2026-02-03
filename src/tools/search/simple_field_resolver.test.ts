// Ported from pocketbase/tools/search/simple_field_resolver_test.go.

import { describe, expect, it } from "bun:test";
import { SimpleFieldResolver } from "./simple_field_resolver.ts";

function normalizeQuery(query: { select: string; count?: string; params: unknown[] }) {
  return { select: query.select, count: query.count, params: query.params };
}

describe("simple field resolver", () => {
  it("UpdateQuery returns the same query", () => {
    const resolver = new SimpleFieldResolver("test");
    const query = { select: 'select "id" from "test"', params: [] as unknown[] };

    const result = resolver.updateQuery(query);
    expect(normalizeQuery(result)).toEqual(normalizeQuery(query));
  });

  it("Resolve", () => {
    const resolver = new SimpleFieldResolver("test", `^test_regex\\d+$`, "Test columnify!", "data.test");

    const scenarios = [
      { fieldName: "", expectError: true, expectName: "" },
      { fieldName: " ", expectError: true, expectName: "" },
      { fieldName: "unknown", expectError: true, expectName: "" },
      { fieldName: "test", expectError: false, expectName: "[[test]]" },
      { fieldName: "test.sub", expectError: true, expectName: "" },
      { fieldName: "test_regex", expectError: true, expectName: "" },
      { fieldName: "test_regex1", expectError: false, expectName: "[[test_regex1]]" },
      { fieldName: "Test columnify!", expectError: false, expectName: "[[Testcolumnify]]" },
      { fieldName: "data.test", expectError: false, expectName: "JSON_EXTRACT([[data]], '$.test')" },
    ];

    for (const scenario of scenarios) {
      let result: { identifier: string; params: unknown[] } | null = null;
      let err: unknown = null;
      try {
        result = resolver.resolve(scenario.fieldName);
      } catch (error) {
        err = error;
      }

      const hasErr = err != null;
      expect(hasErr).toBe(scenario.expectError);

      if (hasErr || !result) {
        continue;
      }

      expect(result.identifier).toBe(scenario.expectName);
      expect(result.params.length).toBe(0);
    }
  });
});
