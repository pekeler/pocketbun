// PocketBun-only: minimal dbx SelectQuery shim to support core model/aux queries.

import type { Database, SQLQueryBindings } from "bun:sqlite";
import type { SqlExpr } from "../search/types.ts";
import { HashExp } from "./expr.ts";

type WhereExpr = SqlExpr;

export class SelectQuery {
  #db: Database;
  #table: string;
  #select: string[];
  #where: WhereExpr[] = [];
  #groupBy: string | null = null;
  #orderBy: string | null = null;
  #limit: number | null = null;
  #offset: number | null = null;

  constructor(db: Database, table: string) {
    this.#db = db;
    this.#table = table;
    this.#select = [`{{${table}}}.*`];
  }

  Select(...fields: string[]): this {
    if (fields.length > 0) {
      this.#select = [...fields];
    }
    return this;
  }

  AndWhere(expr: SqlExpr | Record<string, unknown>): this {
    const normalized = normalizeSqlExpr(expr);
    if (normalized?.sql) {
      this.#where.push(normalized);
    }
    return this;
  }

  GroupBy(expr: string): this {
    this.#groupBy = expr;
    return this;
  }

  OrderBy(expr: string): this {
    this.#orderBy = expr;
    return this;
  }

  Limit(limit: number): this {
    this.#limit = limit;
    return this;
  }

  Offset(offset: number): this {
    this.#offset = offset;
    return this;
  }

  One<T extends Record<string, unknown> = Record<string, unknown>>(): T | null {
    const { sql, params } = this.#buildQuerySql(1);
    const row = this.#db.query(sql).get(...params);
    if (!row || typeof row !== "object") {
      return null;
    }
    return row as T;
  }

  All<T extends Record<string, unknown> = Record<string, unknown>>(): T[] {
    const { sql, params } = this.#buildQuerySql();
    const rows = this.#db.query(sql).all(...params);
    if (!Array.isArray(rows)) {
      return [];
    }
    return rows as T[];
  }

  Row<T = unknown>(): T | null {
    const row = this.One<Record<string, unknown>>();
    if (!row) {
      return null;
    }
    const keys = Object.keys(row);
    if (keys.length === 0) {
      return null;
    }
    return row[keys[0] ?? ""] as T;
  }

  Build(): { SQL: () => string; Params: () => SQLQueryBindings[] } {
    const built = this.#buildQuerySql();
    return {
      SQL: () => built.sql,
      Params: () => built.params,
    };
  }

  #buildQuerySql(limitOverride?: number): { sql: string; params: SQLQueryBindings[] } {
    let sql = `select ${this.#select.join(", ")} from {{${this.#table}}}`;
    const params: SQLQueryBindings[] = [];

    const combined = combineSqlExprs(this.#where);
    if (combined?.sql) {
      sql = appendWhere(sql, combined.sql);
      params.push(...(combined.params as SQLQueryBindings[]));
    }

    if (this.#groupBy) {
      sql = `${sql} GROUP BY ${this.#groupBy}`;
    }

    if (this.#orderBy) {
      sql = appendOrderBy(sql, this.#orderBy);
    }

    const limit = limitOverride ?? this.#limit;
    if (limit != null) {
      sql = `${sql} LIMIT ${limit}`;
    }

    if (this.#offset != null) {
      sql = `${sql} OFFSET ${this.#offset}`;
    }

    return { sql, params };
  }
}

function normalizeSqlExpr(expr: SqlExpr | Record<string, unknown> | null | undefined): SqlExpr | null {
  if (!expr) {
    return null;
  }

  if (typeof (expr as SqlExpr).sql === "string") {
    return expr as SqlExpr;
  }

  if (typeof expr === "object" && !Array.isArray(expr)) {
    return HashExp(expr as Record<string, unknown>);
  }

  return null;
}

function combineSqlExprs(exprs: WhereExpr[]): SqlExpr | null {
  if (exprs.length === 0) {
    return null;
  }

  const clauses: string[] = [];
  const params: SQLQueryBindings[] = [];

  for (const expr of exprs) {
    if (!expr?.sql) {
      continue;
    }
    clauses.push(`(${expr.sql})`);
    params.push(...(expr.params as SQLQueryBindings[]));
  }

  if (clauses.length === 0) {
    return null;
  }

  return { sql: clauses.join(" AND "), params };
}

function appendWhere(baseSql: string, clause: string): string {
  if (!clause) {
    return baseSql;
  }
  if (/\bwhere\b/i.test(baseSql)) {
    return `${baseSql} AND ${clause}`;
  }
  return `${baseSql} WHERE ${clause}`;
}

function appendOrderBy(baseSql: string, clause: string): string {
  if (!clause) {
    return baseSql;
  }
  if (/\border\s+by\b/i.test(baseSql)) {
    return `${baseSql}, ${clause}`;
  }
  return `${baseSql} ORDER BY ${clause}`;
}
