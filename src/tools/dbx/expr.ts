// PocketBun-only: minimal dbx expression helpers to support ported core query tests.

import type { SQLQueryBindings } from "bun:sqlite";
import type { SqlExpr } from "../search/types.ts";

export type Expression = SqlExpr & { build?: (db: unknown, params: Record<string, unknown>) => string };
export type Params = Record<string, unknown>;

class DbxExpr implements SqlExpr {
  sql: string;
  params: SQLQueryBindings[];

  constructor(sql: string, params: SQLQueryBindings[] = []) {
    this.sql = sql;
    this.params = params;
  }

  build(_db: unknown, paramsMap: Record<string, unknown>): string {
    let index = 0;
    let sql = this.sql.replace(/\[\[([^\]]+)\]\]/g, (_match, name: string) => `\`${name}\``);
    sql = sql.replace(/\{\{([^}]+)\}\}/g, (_match, name: string) => `\`${name}\``);
    sql = sql.replace(/\?/g, () => {
      const key = `p${index}`;
      paramsMap[key] = this.params[index];
      index += 1;
      return `{:${key}}`;
    });
    return sql;
  }
}

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

    clauses.push(`[[${key}]]=?`);
    params.push(value as SQLQueryBindings);
  }

  return new DbxExpr(clauses.join(" AND "), params);
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

  return new DbxExpr(updated, bindings);
}

export type LikeExpr = SqlExpr & {
  Match: (left: boolean, right: boolean) => LikeExpr;
};

class LikeExpression extends DbxExpr implements LikeExpr {
  #field: string;
  #values: string[];
  #joiner: "AND" | "OR";
  #operator: "LIKE" | "NOT LIKE";
  #leftMatch = false;
  #rightMatch = false;

  constructor(field: string, values: string[], operator: "LIKE" | "NOT LIKE", joiner: "AND" | "OR") {
    super("");
    this.#field = field;
    this.#values = values;
    this.#operator = operator;
    this.#joiner = joiner;
    this.update();
  }

  Match(left: boolean, right: boolean): LikeExpr {
    this.#leftMatch = left;
    this.#rightMatch = right;
    this.update();
    return this;
  }

  match(left: boolean, right: boolean): LikeExpr {
    return this.Match(left, right);
  }

  private update(): void {
    const patterns: SQLQueryBindings[] = [];
    const parts: string[] = [];
    for (const value of this.#values) {
      let pattern = value;
      if (this.#leftMatch) {
        pattern = `%${pattern}`;
      }
      if (this.#rightMatch) {
        pattern = `${pattern}%`;
      }
      patterns.push(pattern);
      parts.push(`[[${this.#field}]] ${this.#operator} ?`);
    }
    this.sql = parts.join(` ${this.#joiner} `);
    this.params = patterns;
  }
}

export function Like(field: string, ...values: string[]): LikeExpr {
  return new LikeExpression(field, values, "LIKE", "AND");
}

export function Not(expr: SqlExpr): SqlExpr {
  const params = (expr.params as SQLQueryBindings[] | undefined) ?? [];
  return new DbxExpr(expr.sql ? `NOT (${expr.sql})` : "", [...params]);
}

export function And(...exprs: SqlExpr[]): SqlExpr {
  const clauses: string[] = [];
  const params: SQLQueryBindings[] = [];
  for (const expr of exprs) {
    if (!expr?.sql) {
      continue;
    }
    clauses.push(`(${expr.sql})`);
    params.push(...(expr.params as SQLQueryBindings[]));
  }
  return new DbxExpr(clauses.join(" AND "), params);
}

export function Or(...exprs: SqlExpr[]): SqlExpr {
  const clauses: string[] = [];
  const params: SQLQueryBindings[] = [];
  for (const expr of exprs) {
    if (!expr?.sql) {
      continue;
    }
    clauses.push(`(${expr.sql})`);
    params.push(...(expr.params as SQLQueryBindings[]));
  }
  return new DbxExpr(clauses.join(" OR "), params);
}

export function In(field: string, ...values: SQLQueryBindings[]): SqlExpr {
  if (!values || values.length === 0) {
    return new DbxExpr("1=0", []);
  }
  const placeholders = values.map(() => "?").join(", ");
  return new DbxExpr(`[[${field}]] IN (${placeholders})`, values);
}

export function NotIn(field: string, ...values: SQLQueryBindings[]): SqlExpr {
  if (!values || values.length === 0) {
    return new DbxExpr("1=1", []);
  }
  const placeholders = values.map(() => "?").join(", ");
  return new DbxExpr(`[[${field}]] NOT IN (${placeholders})`, values);
}

export function OrLike(field: string, ...values: string[]): LikeExpr {
  return new LikeExpression(field, values, "LIKE", "OR");
}

export function NotLike(field: string, ...values: string[]): LikeExpr {
  return new LikeExpression(field, values, "NOT LIKE", "AND");
}

export function OrNotLike(field: string, ...values: string[]): LikeExpr {
  return new LikeExpression(field, values, "NOT LIKE", "OR");
}

export function Exists(subquery: SqlExpr | string): SqlExpr {
  const sql = typeof subquery === "string" ? subquery : subquery.sql;
  const params = typeof subquery === "string" ? [] : ((subquery as SqlExpr).params as SQLQueryBindings[] | undefined);
  return new DbxExpr(`EXISTS (${sql})`, params ?? []);
}

export function NotExists(subquery: SqlExpr | string): SqlExpr {
  const sql = typeof subquery === "string" ? subquery : subquery.sql;
  const params = typeof subquery === "string" ? [] : ((subquery as SqlExpr).params as SQLQueryBindings[] | undefined);
  return new DbxExpr(`NOT EXISTS (${sql})`, params ?? []);
}

export function Between(field: string, from: SQLQueryBindings, to: SQLQueryBindings): SqlExpr {
  return new DbxExpr(`[[${field}]] BETWEEN ? AND ?`, [from, to]);
}

export function NotBetween(field: string, from: SQLQueryBindings, to: SQLQueryBindings): SqlExpr {
  return new DbxExpr(`[[${field}]] NOT BETWEEN ? AND ?`, [from, to]);
}
