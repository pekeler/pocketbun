// PocketBun-only: minimal dbx query helpers for pb_hooks compatibility.

import type { SQLQueryBindings } from "bun:sqlite";
import type { SqlExpr } from "../search/types.ts";
import type { DbxDatabase } from "./database.ts";
import { JSONArray, JSONMap } from "../types/index.ts";

export const DynamicModelShapeKey = "__pbDynamicModelShape";
export const DynamicModelFactoryKey = "__pbDynamicModelFactory";

export class DbxQuery {
  #db: DbxDatabase;
  #sql: string;
  #params: SQLQueryBindings[];

  constructor(db: DbxDatabase, sql: string, params: SQLQueryBindings[] = []) {
    this.#db = db;
    this.#sql = sql;
    this.#params = params;
  }

  Bind(...params: SQLQueryBindings[]): this {
    this.#params = params;
    return this;
  }

  one<T extends Record<string, unknown>>(into?: T): T | null {
    const row = this.#db.query(this.#sql).get(...this.#params) as Record<string, unknown> | undefined;
    if (!row) {
      return null;
    }
    if (into) {
      applyRow(into as Record<string, unknown>, row);
      return into;
    }
    return row as T;
  }

  all<T extends Record<string, unknown>>(into?: T[]): T[] {
    const rows = this.#db.query(this.#sql).all(...this.#params) as Record<string, unknown>[] | undefined;
    const result = rows ?? [];
    if (!into) {
      return result as T[];
    }

    into.length = 0;
    const factory = (into as unknown as Record<string, unknown>)[DynamicModelFactoryKey];
    const shape = (into as unknown as Record<string, unknown>)[DynamicModelShapeKey];

    for (const row of result) {
      let entry: Record<string, unknown>;
      if (typeof factory === "function") {
        entry = factory();
      } else {
        entry = {};
        if (shape && typeof shape === "object") {
          Object.defineProperty(entry, DynamicModelShapeKey, { value: shape, enumerable: false });
        }
      }
      applyRow(entry, row);
      into.push(entry as T);
    }

    return into;
  }
}

export class DbxSelectQuery {
  #db: DbxDatabase;
  #fields: string[] = [];
  #table = "";
  #where: SqlExpr[] = [];
  #orderBy: string | null = null;
  #limit: number | null = null;

  constructor(db: DbxDatabase, fields: string[]) {
    this.#db = db;
    this.#fields = fields;
  }

  from(table: string): this {
    this.#table = table;
    return this;
  }

  where(expr: SqlExpr | string): this {
    if (typeof expr === "string") {
      this.#where.push({ sql: expr, params: [] });
      return this;
    }
    if (expr && typeof expr.sql === "string") {
      this.#where.push(expr);
    }
    return this;
  }

  limit(limit: number): this {
    this.#limit = limit;
    return this;
  }

  orderBy(expr: string): this {
    this.#orderBy = expr;
    return this;
  }

  one<T extends Record<string, unknown>>(into?: T): T | null {
    const query = new DbxQuery(this.#db, this.buildSql(), this.buildParams());
    return query.one(into);
  }

  all<T extends Record<string, unknown>>(into?: T[]): T[] {
    const query = new DbxQuery(this.#db, this.buildSql(), this.buildParams());
    return query.all(into);
  }

  private buildSql(): string {
    const fields = this.#fields.length > 0 ? this.#fields.join(", ") : "*";
    let sql = `SELECT ${fields} FROM {{${this.#table}}}`;
    if (this.#where.length > 0) {
      const clauses = this.#where.map((expr) => `(${expr.sql})`);
      sql += ` WHERE ${clauses.join(" AND ")}`;
    }
    if (this.#orderBy) {
      sql += ` ORDER BY ${this.#orderBy}`;
    }
    if (this.#limit != null) {
      sql += ` LIMIT ${this.#limit}`;
    }
    return sql;
  }

  private buildParams(): SQLQueryBindings[] {
    const params: SQLQueryBindings[] = [];
    for (const expr of this.#where) {
      if (expr.params && Array.isArray(expr.params)) {
        params.push(...(expr.params as SQLQueryBindings[]));
      }
    }
    return params;
  }
}

function applyRow(target: Record<string, unknown>, row: Record<string, unknown>): void {
  const shape = target[DynamicModelShapeKey] as Record<string, string> | undefined;
  if (!shape) {
    Object.assign(target, row);
    return;
  }

  for (const [key, kind] of Object.entries(shape)) {
    const value = row[key];
    if (value == null) {
      target[key] = null;
      continue;
    }

    if (kind === "array") {
      target[key] = normalizeJsonArray(value);
      continue;
    }

    if (kind === "object") {
      target[key] = normalizeJsonObject(value);
      continue;
    }

    if (kind === "bool") {
      if (typeof value === "boolean") {
        target[key] = value;
      } else if (typeof value === "number") {
        target[key] = value !== 0;
      } else if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        target[key] = normalized === "1" || normalized === "true";
      } else {
        target[key] = Boolean(value);
      }
      continue;
    }

    target[key] = value;
  }
}

function normalizeJsonArray(value: unknown): JSONArray<unknown> | null {
  if (value == null) {
    return null;
  }
  if (value instanceof JSONArray) {
    return new JSONArray(...value);
  }
  if (Array.isArray(value)) {
    return new JSONArray(...value);
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return new JSONArray(...parsed);
      }
    } catch {
      // ignore
    }
  }
  return new JSONArray();
}

function normalizeJsonObject(value: unknown): JSONMap<unknown> | null {
  if (value == null) {
    return null;
  }
  if (value instanceof JSONMap) {
    return new JSONMap(value.toJSON());
  }
  if (typeof value === "object") {
    return new JSONMap(value as Record<string, unknown>);
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object") {
        return new JSONMap(parsed as Record<string, unknown>);
      }
    } catch {
      // ignore
    }
  }
  return new JSONMap();
}
