// Ported from pocketbase/core/record_query.go (partial: record query helpers and filters).

import type { SQLQueryBindings } from "bun:sqlite";
import type { SqlExpr } from "../tools/search/types.ts";
import type { App } from "./app.ts";
import type { Collection } from "./collection.ts";
import { HashExp } from "../tools/dbx/expr.ts";
import { Record as RecordModel, type RecordData } from "./record.ts";

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

    const normalized = normalizeSqlExpr(expr);
    if (normalized?.sql) {
      this.#clauses.push(normalized.sql);
      this.#params.push(...(normalized.params as SQLQueryBindings[]));
    }
  }

  toExpr(): SqlExpr | null {
    if (this.#clauses.length === 0) {
      return null;
    }
    return { sql: this.#clauses.join(" AND "), params: [...this.#params] };
  }
}

export function combineSqlExprs(exprs: Array<SqlExpr | Record<string, unknown> | null | undefined>): SqlExpr | null {
  const clauses: string[] = [];
  const params: SQLQueryBindings[] = [];

  for (const expr of exprs) {
    const normalized = normalizeSqlExpr(expr);
    if (!normalized?.sql) {
      continue;
    }
    clauses.push(`(${normalized.sql})`);
    params.push(...(normalized.params as SQLQueryBindings[]));
  }

  if (clauses.length === 0) {
    return null;
  }

  return { sql: clauses.join(" AND "), params };
}

export class RecordQuery {
  #app: App;
  #collection: Collection | null = null;
  #collectionErr: Error | null = null;
  #where: SqlExpr[] = [];
  #orderBy: string | null = null;
  #limit: number | null = null;
  #offset: number | null = null;

  constructor(app: App, collectionModelOrIdentifier: Collection | string | null | undefined) {
    this.#app = app;

    if (!collectionModelOrIdentifier) {
      this.#collectionErr = new Error("unknown collection identifier - must be collection model, id or name");
      return;
    }

    if (typeof collectionModelOrIdentifier === "string") {
      const resolved = app.findCollectionByNameOrId(collectionModelOrIdentifier);
      if (!resolved) {
        this.#collectionErr = new Error("unknown collection identifier - must be collection model, id or name");
        return;
      }
      this.#collection = resolved;
      return;
    }

    this.#collection = collectionModelOrIdentifier;
  }

  Where(expr: SqlExpr | Record<string, unknown>): this {
    const normalized = normalizeSqlExpr(expr);
    if (normalized?.sql) {
      this.#where.push(normalized);
    }
    return this;
  }

  AndWhere(expr: SqlExpr | Record<string, unknown>): this {
    return this.Where(expr);
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

  One(target?: unknown): unknown {
    const row = this.#fetchOne();
    if (!row) {
      throw new Error("record not found");
    }
    return mapRow(row, target, this.#collection!);
  }

  All(target?: unknown[]): unknown[] {
    const rows = this.#fetchAll();
    return mapRows(rows, target, this.#collection!);
  }

  #fetchOne(): RecordData | null {
    const { sql, params } = this.#buildQuerySql(1);
    const row = this.#app
      .db()
      .query(sql)
      .get(...params);
    if (!row || typeof row !== "object") {
      return null;
    }
    return row as RecordData;
  }

  #fetchAll(): RecordData[] {
    const { sql, params } = this.#buildQuerySql();
    const rows = this.#app
      .db()
      .query(sql)
      .all(...params);
    if (!Array.isArray(rows)) {
      return [];
    }
    return rows as RecordData[];
  }

  #buildQuerySql(limitOverride?: number): { sql: string; params: SQLQueryBindings[] } {
    if (!this.#collection) {
      throw this.#collectionErr ?? new Error("missing collection");
    }

    const table = this.#collection.name;
    if (!isSafeIdentifier(table)) {
      throw new Error(`unsafe table name ${table}`);
    }

    let sql = `select {{${table}}}.* from {{${table}}}`;
    const params: SQLQueryBindings[] = [];

    const combined = combineSqlExprs(this.#where);
    if (combined?.sql) {
      sql = appendWhere(sql, combined.sql);
      params.push(...(combined.params as SQLQueryBindings[]));
    }

    if (this.#orderBy) {
      sql = appendOrderBy(sql, this.#orderBy);
    }

    const limit = limitOverride ?? this.#limit;
    const offset = this.#offset;
    sql = applyLimitOffset(sql, limit, offset);

    return { sql, params };
  }
}

function normalizeSqlExpr(expr: SqlExpr | Record<string, unknown> | null | undefined): SqlExpr | null {
  if (!expr) {
    return null;
  }

  const maybeExpr = expr as SqlExpr;
  if (typeof maybeExpr.sql === "string" && Array.isArray(maybeExpr.params)) {
    return maybeExpr;
  }

  const hashExpr = HashExp(expr as Record<string, unknown>);
  if (!hashExpr.sql) {
    return null;
  }
  return hashExpr;
}

function mapRows(rows: RecordData[], target: unknown[] | undefined, collection: Collection): unknown[] {
  if (!target) {
    return rows.map((row) => RecordModel.fromRow(collection, row));
  }

  const template = target.length > 0 ? target[0] : null;
  target.length = 0;

  for (const row of rows) {
    target.push(mapRowWithTemplate(row, template, collection));
  }

  return target;
}

function mapRow(row: RecordData, target: unknown, collection: Collection): unknown {
  const record = RecordModel.fromRow(collection, row);

  if (!target) {
    return record;
  }

  if (target instanceof RecordModel) {
    // Deviation: we cannot hydrate an existing Record instance with private fields.
    // Return a freshly constructed record to preserve correct field values.
    target.Id = record.Id;
    return record;
  }

  if (isRecordProxy(target)) {
    target.SetProxyRecord(record);
    return target;
  }

  if (typeof target === "object") {
    Object.assign(target as Record<string, unknown>, row);
    return target;
  }

  return record;
}

function mapRowWithTemplate(row: RecordData, template: unknown, collection: Collection): unknown {
  if (!template) {
    return RecordModel.fromRow(collection, row);
  }

  if (template instanceof RecordModel) {
    return RecordModel.fromRow(collection, row);
  }

  if (isRecordProxy(template)) {
    const proxy = createInstance(template);
    if (proxy && isRecordProxy(proxy)) {
      proxy.SetProxyRecord(RecordModel.fromRow(collection, row));
      return proxy;
    }
  }

  const instance = createInstance(template);
  if (instance && typeof instance === "object") {
    Object.assign(instance as Record<string, unknown>, row);
    return instance;
  }

  return RecordModel.fromRow(collection, row);
}

function createInstance(template: unknown): unknown {
  if (!template || typeof template !== "object") {
    return null;
  }

  const ctor = (template as { constructor?: new () => unknown }).constructor;
  if (typeof ctor !== "function") {
    return {};
  }

  try {
    return new ctor();
  } catch {
    return {};
  }
}

function isRecordProxy(value: unknown): value is { SetProxyRecord: (record: RecordModel) => void } {
  return typeof (value as { SetProxyRecord?: unknown })?.SetProxyRecord === "function";
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

function applyLimitOffset(sql: string, limit: number | null | undefined, offset: number | null | undefined): string {
  const safeLimit = typeof limit === "number" ? limit : null;
  const safeOffset = typeof offset === "number" ? offset : null;

  if (safeLimit !== null && safeLimit > 0) {
    return safeOffset && safeOffset > 0 ? `${sql} LIMIT ${safeLimit} OFFSET ${safeOffset}` : `${sql} LIMIT ${safeLimit}`;
  }

  if (safeOffset && safeOffset > 0) {
    return `${sql} LIMIT -1 OFFSET ${safeOffset}`;
  }

  return sql;
}

function isSafeIdentifier(value: string): boolean {
  return /^[A-Za-z0-9_]+$/.test(value);
}
