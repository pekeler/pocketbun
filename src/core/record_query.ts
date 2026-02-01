// Ported from pocketbase/core/record_query.go (partial: filter helpers for FindRecordById).

import type { SQLQueryBindings } from "bun:sqlite";
import type { SqlExpr } from "../tools/search/types.ts";

export type RecordQueryBuilder = {
  AndWhere(expr: SqlExpr | Record<string, unknown>): void;
};

export type RecordQueryFilter = (q: RecordQueryBuilder) => Error | null;

export function buildRecordFilterExpr(filters: Array<RecordQueryFilter | null | undefined>): SqlExpr | null {
  const builder = new RecordQueryFilterBuilder();

  for (const filter of filters) {
    if (!filter) {
      continue;
    }
    const err = filter(builder);
    if (err) {
      throw err;
    }
  }

  return builder.toExpr();
}

class RecordQueryFilterBuilder implements RecordQueryBuilder {
  #clauses: string[] = [];
  #params: SQLQueryBindings[] = [];

  AndWhere(expr: SqlExpr | Record<string, unknown>): void {
    if (!expr) {
      return;
    }

    const maybeExpr = expr as SqlExpr;
    if (typeof maybeExpr.sql === "string" && Array.isArray(maybeExpr.params)) {
      const sql = maybeExpr.sql.trim();
      if (sql) {
        this.#clauses.push(sql);
        this.#params.push(...(maybeExpr.params as SQLQueryBindings[]));
      }
      return;
    }

    for (const [key, value] of Object.entries(expr)) {
      if (!key) {
        continue;
      }
      this.#clauses.push(`[[${key}]] = ?`);
      this.#params.push(value as SQLQueryBindings);
    }
  }

  toExpr(): SqlExpr | null {
    if (this.#clauses.length === 0) {
      return null;
    }
    return { sql: this.#clauses.join(" AND "), params: [...this.#params] };
  }
}
