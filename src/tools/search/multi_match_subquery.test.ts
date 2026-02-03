// Ported from pocketbase/tools/search/multi_match_subquery_test.go.

import { describe, expect, it } from "bun:test";
import { MultiMatchSubquery } from "./multi_match_subquery.ts";

describe("multi match subquery", () => {
  it("build", () => {
    const mm = new MultiMatchSubquery();
    mm.targetTableAlias = "test_TargetTableAlias";
    mm.fromTableName = "test_FromTableName";
    mm.fromTableAlias = "test_FromTableAlias";
    mm.valueIdentifier = "(?,?)";
    mm.joins = [
      { tableName: "join_table1", tableAlias: "join_alias1" },
      {
        tableName: "join_table2",
        tableAlias: "join_alias2",
        on: { sql: "123=?", params: ["test_join"] },
      },
    ];
    mm.params = ["test_mm", "test_external"];

    const result = mm.build();

    const expectedSql =
      "SELECT (?,?) as [[multiMatchValue]] FROM {{test_FromTableName}} {{test_FromTableAlias}} LEFT JOIN {{join_table1}} {{join_alias1}} LEFT JOIN {{join_table2}} {{join_alias2}} ON 123=? WHERE [[test_FromTableAlias.id]] = [[test_TargetTableAlias.id]]";

    expect(result.sql).toBe(expectedSql);
    expect(result.params).toEqual(["test_mm", "test_external", "test_join"]);
  });
});
