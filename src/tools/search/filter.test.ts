// Ported from pocketbase/tools/search/filter_test.go.

import { describe, expect, it } from "bun:test";
import { buildFilterExpr } from "./filter.ts";
import { SimpleFieldResolver } from "./simple_field_resolver.ts";
import { DefaultFilterExprLimit, ErrFilterExprLimit } from "./types.ts";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchesSqlPattern(sql: string, expectedPattern: string): boolean {
  const normalizedSql = sql.replace(/[()]/g, "");
  const normalizedPattern = expectedPattern.replace(/[()]/g, "");
  const token = "__TEST__";
  const withToken = normalizedPattern.replaceAll("TEST", token);
  const escaped = escapeRegex(withToken);
  const tokenEscaped = escapeRegex(token);
  const placeholderPattern = "(?:\\?|\\{:[^}]+\\})";
  const pattern = `^${escaped.replaceAll(tokenEscaped, placeholderPattern)}$`;
  const regex = new RegExp(pattern);
  return regex.test(normalizedSql);
}

function stripParens(value: string): string {
  return value.replace(/[()]/g, "");
}

function renderSql(sql: string, params: unknown[]): string {
  let index = 0;
  return sql.replace(/\{:[^}]+\}|\?/g, () => {
    const value = params[index++];
    if (value === null || value === undefined) {
      return "null";
    }
    if (typeof value === "number" || typeof value === "bigint") {
      return String(value);
    }
    if (typeof value === "boolean") {
      return value ? "1" : "0";
    }
    let stringValue = "";
    if (typeof value === "string") {
      stringValue = value;
    } else if (typeof value === "symbol" || typeof value === "function") {
      stringValue = value.toString();
    } else if (typeof value === "object") {
      stringValue = JSON.stringify(value) ?? "";
    }
    const escaped = stringValue.replace(/'/g, "''");
    return `'${escaped}'`;
  });
}

describe("search filter", () => {
  it("build filter expression", () => {
    const resolver = new SimpleFieldResolver("test1", "test2", "test3", `^test4_\\w+$`, `^test5\\.[\\w\\.]*\\w+$`);

    const scenarios = [
      { name: "empty", filterData: "", expectError: true, expectPattern: "" },
      { name: "invalid format", filterData: "(test1 > 1", expectError: true, expectPattern: "" },
      { name: "invalid operator", filterData: "test1 + 123", expectError: true, expectPattern: "" },
      { name: "unknown field", filterData: "test1 = 'example' && unknown > 1", expectError: true, expectPattern: "" },
      { name: "simple expression", filterData: "test1 > 1", expectError: false, expectPattern: "[[test1]] > TEST" },
      {
        name: "empty string vs null",
        filterData: "'' = null && null != ''",
        expectError: false,
        expectPattern: "('' = '' AND '' IS NOT '')",
      },
      {
        name: "like with 2 columns",
        filterData: "test1 ~ test2",
        expectError: false,
        expectPattern: "[[test1]] LIKE ('%' || [[test2]] || '%') ESCAPE '\\'",
      },
      {
        name: "like with right column operand",
        filterData: "'lorem' ~ test1",
        expectError: false,
        expectPattern: "TEST LIKE ('%' || [[test1]] || '%') ESCAPE '\\'",
      },
      {
        name: "like with left column operand and text as right operand",
        filterData: "test1 ~ 'lorem'",
        expectError: false,
        expectPattern: "[[test1]] LIKE TEST ESCAPE '\\'",
      },
      {
        name: "not like with 2 columns",
        filterData: "test1 !~ test2",
        expectError: false,
        expectPattern: "[[test1]] NOT LIKE ('%' || [[test2]] || '%') ESCAPE '\\'",
      },
      {
        name: "not like with right column operand",
        filterData: "'lorem' !~ test1",
        expectError: false,
        expectPattern: "TEST NOT LIKE ('%' || [[test1]] || '%') ESCAPE '\\'",
      },
      {
        name: "like with left column operand and text as right operand",
        filterData: "test1 !~ 'lorem'",
        expectError: false,
        expectPattern: "[[test1]] NOT LIKE TEST ESCAPE '\\'",
      },
      {
        name: "nested json no coalesce",
        filterData: "test5.a = test5.b || test5.c != test5.d",
        expectError: false,
        expectPattern:
          "(JSON_EXTRACT([[test5]], '$.a') IS JSON_EXTRACT([[test5]], '$.b') OR JSON_EXTRACT([[test5]], '$.c') IS NOT JSON_EXTRACT([[test5]], '$.d'))",
      },
      {
        name: "macros",
        filterData: `
          test4_1 > @now &&
          test4_2 > @second &&
          test4_3 > @minute &&
          test4_4 > @hour &&
          test4_5 > @day &&
          test4_6 > @year &&
          test4_7 > @month &&
          test4_9 > @weekday &&
          test4_9 > @todayStart &&
          test4_10 > @todayEnd &&
          test4_11 > @monthStart &&
          test4_12 > @monthEnd &&
          test4_13 > @yearStart &&
          test4_14 > @yearEnd
        `,
        expectError: false,
        expectPattern:
          "([[test4_1]] > TEST AND [[test4_2]] > TEST AND [[test4_3]] > TEST AND [[test4_4]] > TEST AND [[test4_5]] > TEST AND [[test4_6]] > TEST AND [[test4_7]] > TEST AND [[test4_9]] > TEST AND [[test4_9]] > TEST AND [[test4_10]] > TEST AND [[test4_11]] > TEST AND [[test4_12]] > TEST AND [[test4_13]] > TEST AND [[test4_14]] > TEST)",
      },
      {
        name: "complex expression",
        filterData: "((test1 > 1) || (test2 != 2)) && test3 ~ '%%example' && test4_sub = null",
        expectError: false,
        expectPattern:
          "(([[test1]] > TEST OR [[test2]] IS NOT TEST) AND [[test3]] LIKE TEST ESCAPE '\\' AND ([[test4_sub]] = '' OR [[test4_sub]] IS NULL))",
      },
      {
        name: "combination of special literals (null, true, false)",
        filterData: "test1=true && test2 != false && null = test3 || null != test4_sub",
        expectError: false,
        expectPattern:
          "([[test1]] = 1 AND [[test2]] IS NOT 0 AND ('' = [[test3]] OR [[test3]] IS NULL) OR ('' IS NOT [[test4_sub]] AND [[test4_sub]] IS NOT NULL))",
      },
      {
        name: "all operators",
        filterData:
          "(test1 = test2 || test2 != test3) && (test2 ~ 'example' || test2 !~ '%%abc') && 'switch1%%' ~ test1 && 'switch2' !~ test2 && test3 > 1 && test3 >= 0 && test3 <= 4 && 2 < 5",
        expectError: false,
        expectPattern:
          "((COALESCE([[test1]], '') = COALESCE([[test2]], '') OR COALESCE([[test2]], '') IS NOT COALESCE([[test3]], '')) AND ([[test2]] LIKE TEST ESCAPE '\\' OR [[test2]] NOT LIKE TEST ESCAPE '\\') AND TEST LIKE ('%' || [[test1]] || '%') ESCAPE '\\' AND TEST NOT LIKE ('%' || [[test2]] || '%') ESCAPE '\\' AND [[test3]] > TEST AND [[test3]] >= TEST AND [[test3]] <= TEST AND TEST < TEST)",
      },
      {
        name: "geoDistance function",
        filterData: "geoDistance(1,2,3,4) < 567",
        expectError: false,
        expectPattern:
          "(6371 * acos(cos(radians(TEST)) * cos(radians(TEST)) * cos(radians(TEST) - radians(TEST)) + sin(radians(TEST)) * sin(radians(TEST)))) < TEST",
      },
    ];

    for (const scenario of scenarios) {
      let expr: { sql: string; params: unknown[] } | null = null;
      let err: unknown = null;
      try {
        expr = buildFilterExpr(scenario.filterData, resolver, DefaultFilterExprLimit);
      } catch (error) {
        err = error;
      }

      const hasErr = err != null;
      expect(hasErr).toBe(scenario.expectError);

      if (hasErr || !expr) {
        continue;
      }

      const matches = matchesSqlPattern(expr.sql, scenario.expectPattern);
      if (!matches) {
        throw new Error(`Pattern mismatch for ${scenario.name}: ${expr.sql}`);
      }

      if (scenario.name === "macros") {
        expect(expr.params.length).toBe(14);
      }
    }
  });

  it("build filter expression with params", () => {
    const resolver = new SimpleFieldResolver(`^test\\w+$`);

    const filter = `
      test1 = {:test1} ||
      test2 = {:test2} ||
      test3a = {:test3} ||
      test3b = {:test3} ||
      test4 = {:test4} ||
      test5 = {:test5} ||
      test6 = {:test6} ||
      test7 = {:test7} ||
      test8 = {:test8} ||
      test9 = {:test9} ||
      test10 = {:test10} ||
      test11 = {:test11} ||
      test12 = {:test12}
    `;

    const replacements = [
      { test1: true },
      { test2: false },
      { test3: 123.456 },
      { test4: null },
      { test5: "", test6: "simple", test7: "'single_quotes'", test8: '"double_quotes"', test9: 'escape\\"quote' },
      { test10: new Date("2023-01-01T00:00:00.000Z") },
      { test11: ["a", "b", '"quote'] },
      { test12: { a: 123, b: 'quote"' } },
    ];

    const expr = buildFilterExpr(filter, resolver, DefaultFilterExprLimit, replacements);
    const rendered = renderSql(expr.sql, expr.params);

    expect(rendered).toContain("[[test1]] = 1");
    expect(rendered).toContain("[[test2]] = 0");
    expect(rendered).toContain("[[test3a]] = 123.456");
    expect(rendered).toContain("[[test3b]] = 123.456");
    expect(rendered).toContain("([[test4]] = '' OR [[test4]] IS NULL)");
    expect(rendered).toContain("([[test5]] = '' OR [[test5]] IS NULL)");
    expect(rendered).toContain("[[test6]] = 'simple'");
    expect(rendered).toContain("[[test7]] = '''single_quotes'''");
    expect(rendered).toContain("[[test8]] = '\\\"double_quotes\\\"'");
    expect(rendered).toContain("[[test9]] = 'escape\\\\\"quote'");
    expect(rendered).toContain("[[test10]] = '2023-01-01T00:00:00.000Z'");
    expect(rendered).toContain('[[test11]] = \'[\\"a\\",\\"b\\",\\"\\\\"quote\\"]\'');
    expect(rendered).toContain('[[test12]] = \'{\\"a\\":123,\\"b\\":\\"quote\\\\"\\"}\'');
  });

  it("build filter expression with limit", () => {
    const resolver = new SimpleFieldResolver(`^\\w+$`);

    const scenarios = [
      { limit: 1, filter: "1 = 1", expectError: false },
      { limit: 0, filter: "1 = 1", expectError: true },
      { limit: 2, filter: "1 = 1 || 1 = 1", expectError: false },
      { limit: 1, filter: "1 = 1 || 1 = 1", expectError: true },
      { limit: 3, filter: "1 = 1 || 1 = 1", expectError: false },
      { limit: 6, filter: "(1=1 || 1=1) && (1=1 || (1=1 || 1=1)) && (1=1)", expectError: false },
      { limit: 5, filter: "(1=1 || 1=1) && (1=1 || (1=1 || 1=1)) && (1=1)", expectError: true },
    ];

    for (const scenario of scenarios) {
      let err: unknown = null;
      try {
        buildFilterExpr(scenario.filter, resolver, scenario.limit);
      } catch (error) {
        err = error;
      }

      const hasErr = err != null;
      expect(hasErr).toBe(scenario.expectError);
      if (scenario.expectError && err) {
        expect(err).toBe(ErrFilterExprLimit);
      }
    }
  });

  it("uses deterministic generated names for equivalent literal filters", () => {
    const resolver = new SimpleFieldResolver(`^test\\w+$`);
    const filter = "test1 = 'alpha' || test2 >= 42 || test3 ~ 'beta'";

    const first = buildFilterExpr(filter, resolver, DefaultFilterExprLimit);
    const second = buildFilterExpr(filter, resolver, DefaultFilterExprLimit);

    expect(first.sql).toBe(second.sql);
    expect(first.params).toEqual(second.params);
  });

  it("like params wrapping", () => {
    const resolver = new SimpleFieldResolver(`^test\\w+$`);

    const filter = `
      test1 ~ {:p1} ||
      test2 ~ {:p2} ||
      test3 ~ {:p3} ||
      test4 ~ {:p4} ||
      test5 ~ {:p5} ||
      test6 ~ {:p6} ||
      test7 ~ {:p7} ||
      test8 ~ {:p8} ||
      test9 ~ {:p9} ||
      test10 ~ {:p10} ||
      test11 ~ {:p11} ||
      test12 ~ {:p12}
    `;

    const replacements = [
      { p1: "abc" },
      { p2: "ab%c" },
      { p3: "ab\\%c" },
      { p4: "%ab\\%c" },
      { p5: "ab\\\\%c" },
      { p6: "ab\\\\\\%c" },
      { p7: "ab_c" },
      { p8: "ab\\_c" },
      { p9: "%ab_c" },
      { p10: "ab\\c" },
      { p11: "_ab\\c_" },
      { p12: "ab\\c%" },
    ];

    const expr = buildFilterExpr(filter, resolver, DefaultFilterExprLimit, replacements);
    const rendered = renderSql(expr.sql, expr.params);

    const expectedQuery =
      "([[test1]] LIKE '%abc%' ESCAPE '\\' OR [[test2]] LIKE 'ab%c' ESCAPE '\\' OR [[test3]] LIKE 'ab\\\\%c' ESCAPE '\\' OR [[test4]] LIKE '%ab\\\\%c' ESCAPE '\\' OR [[test5]] LIKE 'ab\\\\\\%c' ESCAPE '\\' OR [[test6]] LIKE 'ab\\\\\\\\%c' ESCAPE '\\' OR [[test7]] LIKE '%ab\\_c%' ESCAPE '\\' OR [[test8]] LIKE '%ab\\\\_c%' ESCAPE '\\' OR [[test9]] LIKE '%ab_c' ESCAPE '\\' OR [[test10]] LIKE '%ab\\c%' ESCAPE '\\' OR [[test11]] LIKE '%\\_ab\\c\\_%' ESCAPE '\\' OR [[test12]] LIKE 'ab\\c%' ESCAPE '\\')";

    expect(stripParens(rendered)).toBe(stripParens(expectedQuery));
  });
});
