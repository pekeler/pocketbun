// PocketBun-only: minimal dbx expression helpers to support ported core query tests.

import type { SQLQueryBindings } from "bun:sqlite";
import type { SqlExpr } from "../search/types.ts";

export type Expression = SqlExpr;
export type Params = Record<string, unknown>;

export function HashExp(values: Record<string, unknown>): SqlExpr {
  const clauses: string[] = [];
  const params: SQLQueryBindings[] = [];

  for (const [key, value] of Object.entries(values)) {
    if (!key) {
      continue;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        clauses.push("1=0");
        continue;
      }
      const placeholders = value.map(() => "?").join(", ");
      clauses.push(`[[${key}]] IN (${placeholders})`);
      params.push(...(value as SQLQueryBindings[]));
      continue;
    }

    if (value === null) {
      clauses.push(`[[${key}]] IS NULL`);
      continue;
    }

    clauses.push(`[[${key}]] = ?`);
    params.push(value as SQLQueryBindings);
  }

  return {
    sql: clauses.join(" AND "),
    params,
  };
}

export function NewExp(sql: string, params: Params = {}): SqlExpr {
  const bindings: SQLQueryBindings[] = [];
  const updated = sql.replace(/\{:([a-zA-Z0-9_]+)\}/g, (_match, key: string) => {
    if (!(key in params)) {
      throw new Error(`missing param :${key}`);
    }
    bindings.push(params[key] as SQLQueryBindings);
    return "?";
  });

  return {
    sql: updated,
    params: bindings,
  };
}

export type LikeExpr = SqlExpr & {
  Match: (left: boolean, right: boolean) => LikeExpr;
};

export function Like(field: string, value: string): LikeExpr {
  let leftMatch = false;
  let rightMatch = false;

  const update = (): SqlExpr => {
    let pattern = value;
    if (leftMatch) {
      pattern = `%${pattern}`;
    }
    if (rightMatch) {
      pattern = `${pattern}%`;
    }
    return {
      sql: `[[${field}]] LIKE ?`,
      params: [pattern],
    };
  };

  const expr = update() as LikeExpr;

  expr.Match = (left: boolean, right: boolean) => {
    leftMatch = left;
    rightMatch = right;
    const updated = update();
    expr.sql = updated.sql;
    expr.params = updated.params;
    return expr;
  };

  return expr;
}

export function Not(expr: SqlExpr): SqlExpr {
  return {
    sql: expr.sql ? `NOT (${expr.sql})` : "",
    params: [...expr.params],
  };
}
