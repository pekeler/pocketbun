// Ported from pocketbase/core/record_field_resolver_replace_expr.go

import type { SqlExpr } from "../tools/search/types.ts";

// replaceWithExpression defines a custom expression that will replace
// a placeholder identifier found in "oldExpr" with the result of "newExpr".
export function replaceWithExpression(placeholder: string, oldExpr: SqlExpr, newExpr: SqlExpr): SqlExpr {
  if (!placeholder || !oldExpr || !newExpr) {
    return { sql: "0=1", params: [] };
  }

  const sql = oldExpr.sql;
  const occurrences: number[] = [];
  let index = sql.indexOf(placeholder);
  while (index !== -1) {
    occurrences.push(index);
    index = sql.indexOf(placeholder, index + placeholder.length);
  }

  if (occurrences.length === 0) {
    return oldExpr;
  }

  const updatedSql = sql.split(placeholder).join(newExpr.sql);
  const params = [...oldExpr.params];
  let offset = 0;

  for (const pos of occurrences) {
    const insertAt = countParamsBefore(sql, pos);
    params.splice(insertAt + offset, 0, ...newExpr.params);
    offset += newExpr.params.length;
  }

  return { sql: updatedSql, params };
}

function countParamsBefore(sql: string, endIndex: number): number {
  let count = 0;
  for (let i = 0; i < endIndex; i += 1) {
    if (sql[i] === "?") {
      count += 1;
    }
  }
  return count;
}
