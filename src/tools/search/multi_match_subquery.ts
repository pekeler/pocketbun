// Ported from pocketbase/tools/search/multi_match_subquery.go

import type { SqlExpr } from "./types.ts";

// Join defines common fields required for a single SQL JOIN clause.
export type Join = {
  tableName: string;
  tableAlias: string;
  on?: SqlExpr | null;
  params?: unknown[];
};

// MultiMatchSubquery defines a multi-match record subquery expression.
export class MultiMatchSubquery {
  targetTableAlias = "";
  fromTableName = "";
  fromTableAlias = "";
  valueIdentifier = "";
  joins: Join[] = [];
  params: unknown[] = [];

  build(): SqlExpr {
    if (!this.targetTableAlias || !this.fromTableName || !this.fromTableAlias) {
      return { sql: "0=1", params: [] };
    }

    const params: unknown[] = [...this.params];
    const joinSql: string[] = [];

    for (const join of this.joins) {
      const { sql, params: joinParams } = buildJoin(join);
      if (joinParams.length > 0) {
        params.push(...joinParams);
      }
      joinSql.push(sql);
    }

    const mergedJoins = joinSql.length > 0 ? ` ${joinSql.join(" ")}` : "";
    const sql = `SELECT ${this.valueIdentifier} as [[multiMatchValue]] FROM ${quoteTableName(
      this.fromTableName,
    )} {{${this.fromTableAlias}}}${mergedJoins} WHERE [[${this.fromTableAlias}.id]] = [[${this.targetTableAlias}.id]]`;

    return { sql, params };
  }
}

function buildJoin(join: Join): SqlExpr {
  const tableSql = quoteTableName(join.tableName);
  const aliasSql = join.tableAlias ? ` {{${join.tableAlias}}}` : "";
  const onSql = join.on?.sql ? ` ON ${join.on.sql}` : "";
  const params = [...(join.params ?? []), ...(join.on?.params ?? [])];
  return { sql: `LEFT JOIN ${tableSql}${aliasSql}${onSql}`, params };
}

function quoteTableName(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }
  if (trimmed.includes("(") || /\s/.test(trimmed) || trimmed.includes("{{") || trimmed.includes("[[")) {
    return trimmed;
  }
  return `{{${trimmed}}}`;
}
