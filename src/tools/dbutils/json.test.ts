// Ported from pocketbase/tools/dbutils/json_test.go

import { describe, expect, it } from "bun:test";
import { JSONArrayLength, JSONEach, JSONExtract } from "./json.ts";

describe("dbutils json", () => {
  it("JSONEach", () => {
    const result = JSONEach("a.b");
    const expected =
      "json_each(CASE WHEN iif(json_valid([[a.b]]), json_type([[a.b]])='array', FALSE) THEN [[a.b]] ELSE json_array([[a.b]]) END)";
    expect(result).toBe(expected);
  });

  it("JSONArrayLength", () => {
    const result = JSONArrayLength("a.b");
    const expected =
      "json_array_length(CASE WHEN iif(json_valid([[a.b]]), json_type([[a.b]])='array', FALSE) THEN [[a.b]] ELSE (CASE WHEN [[a.b]] = '' OR [[a.b]] IS NULL THEN json_array() ELSE json_array([[a.b]]) END) END)";
    expect(result).toBe(expected);
  });

  it("JSONExtract", () => {
    const scenarios = [
      {
        name: "empty path",
        column: "a.b",
        path: "",
        expected:
          "(CASE WHEN json_valid([[a.b]]) THEN JSON_EXTRACT([[a.b]], '$') ELSE JSON_EXTRACT(json_object('pb', [[a.b]]), '$.pb') END)",
      },
      {
        name: "starting with array index",
        column: "a.b",
        path: "[1].a[2]",
        expected:
          "(CASE WHEN json_valid([[a.b]]) THEN JSON_EXTRACT([[a.b]], '$[1].a[2]') ELSE JSON_EXTRACT(json_object('pb', [[a.b]]), '$.pb[1].a[2]') END)",
      },
      {
        name: "starting with key",
        column: "a.b",
        path: "a.b[2].c",
        expected:
          "(CASE WHEN json_valid([[a.b]]) THEN JSON_EXTRACT([[a.b]], '$.a.b[2].c') ELSE JSON_EXTRACT(json_object('pb', [[a.b]]), '$.pb.a.b[2].c') END)",
      },
    ];

    for (const scenario of scenarios) {
      const result = JSONExtract(scenario.column, scenario.path);
      expect(result).toBe(scenario.expected);
    }
  });
});
