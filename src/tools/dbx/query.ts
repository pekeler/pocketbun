// PocketBun-only: minimal dbx query helpers for pb_hooks compatibility.

import type { Changes, SQLQueryBindings } from "bun:sqlite";
import type { SqlExpr } from "../search/types.ts";
import type { DbxDatabase } from "./database.ts";
import { JSONArray, JSONMap } from "../types/index.ts";
import { extractDbxParamNames } from "./identifiers.ts";

export const DynamicModelShapeKey = "__pbDynamicModelShape";
export const DynamicModelFactoryKey = "__pbDynamicModelFactory";
type DbxNamedParams = Record<string, SQLQueryBindings>;
const errNoRowsMessage = "sql: no rows in result set";
type DbxExecHookFunc = (q: DbxQuery, op: () => unknown) => unknown;
type DbxOneHookFunc = <T>(q: DbxQuery, into: T | undefined, op: (nextInto: T | undefined) => T | null) => T | null | void;
type DbxAllHookFunc = <T>(q: DbxQuery, into: T[] | undefined, op: (nextInto: T[] | undefined) => T[]) => T[] | void;
type DbxBuildHookFunc = (q: DbxQuery) => void;
type DbxExecutableStmt = {
  run: (...params: SQLQueryBindings[]) => Changes;
  get: (...params: SQLQueryBindings[]) => unknown;
  all: (...params: SQLQueryBindings[]) => unknown;
  values: (...params: SQLQueryBindings[]) => unknown;
  finalize?: () => void;
};

class DbxRows {
  #rows: Array<Record<string, unknown>>;
  #columns: string[];
  #index = -1;
  #current: Record<string, unknown> | null = null;
  #closed = false;

  constructor(rows: Array<Record<string, unknown>>) {
    this.#rows = rows;
    const first = this.#rows[0];
    this.#columns = first ? Object.keys(first) : [];
  }

  next(): boolean {
    if (this.#closed) {
      return false;
    }

    const nextIndex = this.#index + 1;
    if (nextIndex >= this.#rows.length) {
      this.#current = null;
      this.close();
      return false;
    }

    this.#index = nextIndex;
    this.#current = this.#rows[nextIndex] ?? null;
    return this.#current != null;
  }

  nextResultSet(): boolean {
    return false;
  }

  err(): null {
    return null;
  }

  columns(): string[] {
    return [...this.#columns];
  }

  columnTypes(): unknown[] {
    return [];
  }

  scanMap(into: Record<string, unknown>): void {
    const row = this.#requireCurrent();
    Object.assign(into, row);
  }

  scanStruct(into: Record<string, unknown>): void {
    const row = this.#requireCurrent();
    applyRow(into, row);
  }

  scan(...into: unknown[]): void {
    if (into.length === 0) {
      return;
    }

    const row = this.#requireCurrent();
    const values = this.#columns.map((column) => row[column]);
    scanIntoTargets(values, into);
  }

  close(): void {
    this.#closed = true;
    this.#current = null;
  }

  [Symbol.dispose](): void {
    this.close();
  }

  #requireCurrent(): Record<string, unknown> {
    if (!this.#current || this.#closed) {
      throw new Error("rows: call next() before scan");
    }
    return this.#current;
  }
}

export class DbxQuery {
  #db: DbxDatabase;
  #sql: string;
  #params: SQLQueryBindings[];
  #preparedStmt: DbxExecutableStmt | null = null;
  #context: unknown = null;
  #execHook: DbxExecHookFunc | null = null;
  #oneHook: DbxOneHookFunc | null = null;
  #allHook: DbxAllHookFunc | null = null;
  fieldMapper: unknown = null;
  lastError: Error | null = null;
  logFunc: unknown = null;
  perfFunc: unknown = null;
  queryLogFunc: unknown = null;
  execLogFunc: unknown = null;

  constructor(db: DbxDatabase, sql: string, params: SQLQueryBindings[] = []) {
    this.#db = db;
    this.#sql = sql;
    this.#params = params;
    this.queryLogFunc = (db as { QueryLogFunc?: unknown }).QueryLogFunc ?? null;
  }

  Bind(...params: Array<SQLQueryBindings | DbxNamedParams>): this {
    const first = params[0];
    if (params.length === 1 && first && isDbxNamedParams(first)) {
      const values: SQLQueryBindings[] = [];
      const names = extractDbxParamNames(this.#sql);
      for (const name of names) {
        if (!Object.prototype.hasOwnProperty.call(first, name)) {
          throw new Error(`missing param :${name}`);
        }
        values.push(first[name] as SQLQueryBindings);
      }
      this.#params = values;
      return this;
    }

    this.#params = params as SQLQueryBindings[];
    return this;
  }

  bind(...params: Array<SQLQueryBindings | DbxNamedParams>): this {
    return this.Bind(...params);
  }

  sql(): string {
    return this.#sql;
  }

  params(): SQLQueryBindings[] {
    return [...this.#params];
  }

  context(): unknown {
    return this.#context;
  }

  withContext(ctx: unknown): this {
    this.#context = ctx;
    return this;
  }

  withExecHook(fn: DbxExecHookFunc): this {
    this.#execHook = fn;
    return this;
  }

  withOneHook(fn: DbxOneHookFunc): this {
    this.#oneHook = fn;
    return this;
  }

  withAllHook(fn: DbxAllHookFunc): this {
    this.#allHook = fn;
    return this;
  }

  prepare(): this {
    if (!this.#preparedStmt) {
      try {
        this.#preparedStmt = this.#db.prepare(this.#sql) as unknown as DbxExecutableStmt;
      } catch (error) {
        this.lastError = toError(error);
      }
    }
    return this;
  }

  close(): void {
    if (!this.#preparedStmt) {
      this.#preparedStmt = null;
      return;
    }
    this.#preparedStmt.finalize?.();
    this.#preparedStmt = null;
  }

  [Symbol.dispose](): void {
    this.close();
  }

  execute() {
    this.#consumeLastError();
    return this.#runWithExecHook(() => this.#stmt().run(...this.#params)) as Changes;
  }

  one<T extends Record<string, unknown>>(into?: T): T | null {
    this.#consumeLastError();
    return this.#runWithExecHook(() => {
      const hook = this.#oneHook as DbxOneHookFunc | null;
      const op = (nextInto?: T): T | null => this.#oneWithoutHook(nextInto);
      if (!hook) {
        return op(into);
      }

      let executed = false;
      let result: T | null | undefined;
      const wrappedOp = (nextInto?: T): T | null => {
        executed = true;
        result = op(nextInto);
        return result;
      };

      const hookResult = hook(this, into, wrappedOp);
      if (hookResult !== undefined) {
        return hookResult as T | null;
      }
      if (!executed) {
        return wrappedOp(into);
      }
      return result as T | null;
    }) as T | null;
  }

  #oneWithoutHook<T extends Record<string, unknown>>(into?: T): T | null {
    const row = this.#stmt().get(...this.#params) as Record<string, unknown> | undefined;
    if (!row) {
      throw new Error(errNoRowsMessage);
    }
    if (into) {
      applyRow(into as Record<string, unknown>, row);
      return into;
    }
    return row as T;
  }

  all<T extends Record<string, unknown>>(into?: T[]): T[] {
    this.#consumeLastError();
    return this.#runWithExecHook(() => {
      const hook = this.#allHook as DbxAllHookFunc | null;
      const op = (nextInto?: T[]): T[] => this.#allWithoutHook(nextInto);
      if (!hook) {
        return op(into);
      }

      let executed = false;
      let result: T[] | undefined;
      const wrappedOp = (nextInto?: T[]): T[] => {
        executed = true;
        result = op(nextInto);
        return result;
      };

      const hookResult = hook(this, into, wrappedOp);
      if (hookResult !== undefined) {
        return hookResult as T[];
      }
      if (!executed) {
        return wrappedOp(into);
      }
      return result as T[];
    }) as T[];
  }

  #allWithoutHook<T extends Record<string, unknown>>(into?: T[]): T[] {
    const rows = this.#stmt().all(...this.#params) as Record<string, unknown>[] | undefined;
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

  rows(): DbxRows {
    this.#consumeLastError();
    const rows = this.#stmt().all(...this.#params) as Array<Record<string, unknown>> | undefined;
    return new DbxRows(rows ?? []);
  }

  row(...into: unknown[]): unknown {
    this.#consumeLastError();
    return this.#runWithExecHook(() => {
      const rows = this.#stmt().values(...this.#params) as unknown[] | undefined;
      if (!rows || rows.length === 0) {
        throw new Error(errNoRowsMessage);
      }

      const first = rows[0];
      const values = Array.isArray(first) ? first : [first];
      if (into.length > 0) {
        scanIntoTargets(values, into);
        return undefined;
      }
      return values;
    });
  }

  column(into?: unknown): unknown {
    this.#consumeLastError();
    return this.#runWithExecHook(() => {
      const rows = this.#stmt().values(...this.#params) as unknown[] | undefined;
      const values = !rows
        ? []
        : rows.map((row) => {
            if (Array.isArray(row)) {
              return row[0];
            }
            return row;
          });
      if (Array.isArray(into)) {
        into.length = 0;
        into.push(...values);
        return undefined;
      }
      return values;
    });
  }

  #runWithExecHook<T>(op: () => T): T {
    const execHook = this.#execHook;
    if (!execHook) {
      return op();
    }

    let executed = false;
    let result: T | undefined;
    const wrappedOp = () => {
      executed = true;
      result = op();
      return result;
    };

    const hookResult = execHook(this, wrappedOp);
    if (executed) {
      return result as T;
    }
    if (hookResult !== undefined) {
      return hookResult as T;
    }
    return wrappedOp();
  }

  #stmt(): DbxExecutableStmt {
    if (this.#preparedStmt) {
      return this.#preparedStmt;
    }
    return this.#db.query(this.#sql) as unknown as DbxExecutableStmt;
  }

  #consumeLastError(): void {
    const error = this.lastError;
    this.lastError = null;
    if (error) {
      throw error;
    }
  }
}

function isDbxNamedParams(value: SQLQueryBindings | DbxNamedParams): value is DbxNamedParams {
  if (!value || typeof value !== "object") {
    return false;
  }
  if (Array.isArray(value)) {
    return false;
  }
  if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
    return false;
  }
  return true;
}

function toError(value: unknown): Error {
  if (value instanceof Error) {
    return value;
  }
  return new Error(String(value));
}

export class DbxSelectQuery {
  #db: DbxDatabase;
  #fields: string[] = [];
  #from: string[] = [];
  #joins: SelectJoin[] = [];
  #where: SelectCondition[] = [];
  #having: SelectCondition[] = [];
  #groupBy: string[] = [];
  #orderBy: string[] = [];
  #distinct = false;
  #limit: number | null = null;
  #offset: number | null = null;
  #bindParams: Array<SQLQueryBindings | DbxNamedParams> = [];
  #buildHook: DbxBuildHookFunc | null = null;
  #context: unknown = null;
  #preFragment = "";
  #postFragment = "";
  #selectOption = "";
  #unions: SelectUnion[] = [];
  fieldMapper: unknown = null;
  tableMapper: unknown = null;

  constructor(db: DbxDatabase, fields: string[]) {
    this.#db = db;
    this.#fields = fields;
  }

  select(...fields: string[]): this {
    if (fields.length > 0) {
      this.#fields = fields;
    }
    return this;
  }

  andSelect(...fields: string[]): this {
    if (fields.length > 0) {
      this.#fields.push(...fields);
    }
    return this;
  }

  distinct(value: boolean): this {
    this.#distinct = value;
    return this;
  }

  selectOption(option: string): this {
    this.#selectOption = option.trim();
    return this;
  }

  withBuildHook(fn: DbxBuildHookFunc): this {
    this.#buildHook = fn;
    return this;
  }

  context(): unknown {
    return this.#context;
  }

  withContext(ctx: unknown): this {
    this.#context = ctx;
    return this;
  }

  preFragment(fragment: string): this {
    this.#preFragment = fragment.trim();
    return this;
  }

  postFragment(fragment: string): this {
    this.#postFragment = fragment.trim();
    return this;
  }

  from(...tables: string[]): this {
    if (tables.length > 0) {
      this.#from = tables;
    }
    return this;
  }

  where(expr: SqlExpr | string): this {
    this.#appendWhere("AND", expr);
    return this;
  }

  andWhere(expr: SqlExpr | string): this {
    this.#appendWhere("AND", expr);
    return this;
  }

  orWhere(expr: SqlExpr | string): this {
    this.#appendWhere("OR", expr);
    return this;
  }

  join(typ: string, table: string, on?: SqlExpr | string): this {
    this.#joins.push({
      typ,
      table,
      on: normalizeSelectExpr(on),
    });
    return this;
  }

  innerJoin(table: string, on?: SqlExpr | string): this {
    return this.join("INNER JOIN", table, on);
  }

  leftJoin(table: string, on?: SqlExpr | string): this {
    return this.join("LEFT JOIN", table, on);
  }

  rightJoin(table: string, on?: SqlExpr | string): this {
    return this.join("RIGHT JOIN", table, on);
  }

  groupBy(...columns: string[]): this {
    if (columns.length > 0) {
      this.#groupBy = columns;
    }
    return this;
  }

  andGroupBy(...columns: string[]): this {
    if (columns.length > 0) {
      this.#groupBy.push(...columns);
    }
    return this;
  }

  having(expr: SqlExpr | string): this {
    this.#appendHaving("AND", expr);
    return this;
  }

  andHaving(expr: SqlExpr | string): this {
    this.#appendHaving("AND", expr);
    return this;
  }

  orHaving(expr: SqlExpr | string): this {
    this.#appendHaving("OR", expr);
    return this;
  }

  bind(...params: Array<SQLQueryBindings | DbxNamedParams>): this {
    this.#bindParams = params;
    return this;
  }

  andBind(...params: Array<SQLQueryBindings | DbxNamedParams>): this {
    if (params.length === 0) {
      return this;
    }

    const firstCurrent = this.#bindParams[0];
    const firstNext = params[0];
    const currentNamed = this.#bindParams.length === 1 && firstCurrent && isDbxNamedParams(firstCurrent);
    const nextNamed = params.length === 1 && firstNext && isDbxNamedParams(firstNext);

    if (currentNamed && nextNamed) {
      this.#bindParams = [{ ...(firstCurrent as DbxNamedParams), ...(firstNext as DbxNamedParams) }];
      return this;
    }

    this.#bindParams.push(...params);
    return this;
  }

  union(query: DbxQuery): this {
    this.#unions.push({ all: false, query });
    return this;
  }

  unionAll(query: DbxQuery): this {
    this.#unions.push({ all: true, query });
    return this;
  }

  limit(limit: number): this {
    this.#limit = limit;
    return this;
  }

  offset(offset: number): this {
    this.#offset = offset;
    return this;
  }

  orderBy(...expr: string[]): this {
    if (expr.length > 0) {
      this.#orderBy = expr;
    }
    return this;
  }

  andOrderBy(...expr: string[]): this {
    if (expr.length > 0) {
      this.#orderBy.push(...expr);
    }
    return this;
  }

  one<T extends Record<string, unknown>>(into?: T): T | null {
    const query = this.build();
    return query.one(into);
  }

  model<T extends Record<string, unknown>>(pk: SQLQueryBindings, model: T): T | null {
    if (this.#from.length === 0) {
      const tableName = inferSelectModelTableName(model);
      if (tableName) {
        this.from(tableName);
      }
    }

    if (this.#from.length === 0) {
      throw new Error("cannot infer table name for model()");
    }

    this.andWhere({ sql: "[[id]] = ?", params: [pk] });
    return this.one(model);
  }

  all<T extends Record<string, unknown>>(into?: T[]): T[] {
    const query = this.build();
    return query.all(into);
  }

  rows(): DbxRows {
    return this.build().rows();
  }

  row(...into: unknown[]): unknown {
    return this.build().row(...into);
  }

  column(into?: unknown): unknown {
    return this.build().column(into);
  }

  info(): SelectQueryInfo {
    return {
      preFragment: this.#preFragment,
      postFragment: this.#postFragment,
      builder: this.#db,
      selects: [...this.#fields],
      distinct: this.#distinct,
      selectOption: this.#selectOption,
      from: [...this.#from],
      where: combineSelectExpr(this.#where),
      join: this.#joins.map((join) => ({ ...join })),
      orderBy: [...this.#orderBy],
      groupBy: [...this.#groupBy],
      having: combineSelectExpr(this.#having),
      union: this.#unions.map((union) => ({ ...union })),
      limit: this.#limit,
      offset: this.#offset,
      params: this.#bindParams.map(cloneBindParam),
      context: this.#context,
      buildHook: this.#buildHook,
    };
  }

  build(): DbxQuery {
    const builtParams = this.buildParams();
    const query = new DbxQuery(this.#db, this.buildSql());
    query.withContext(this.#context);

    if (this.#bindParams.length === 0) {
      query.Bind(...builtParams);
      this.#buildHook?.(query);
      return query;
    }

    const first = this.#bindParams[0];
    if (this.#bindParams.length === 1 && first && isDbxNamedParams(first)) {
      if (builtParams.length > 0) {
        throw new Error("cannot combine named bind params with expression-generated params");
      }
      query.Bind(first);
      this.#buildHook?.(query);
      return query;
    }

    query.Bind(...builtParams, ...(this.#bindParams as SQLQueryBindings[]));
    this.#buildHook?.(query);
    return query;
  }

  private buildSql(): string {
    let selectPrefix = this.#distinct ? "SELECT DISTINCT" : "SELECT";
    if (this.#selectOption) {
      selectPrefix += ` ${this.#selectOption}`;
    }
    const fields = this.#fields.length > 0 ? this.#fields.join(", ") : "*";
    const tables = this.#from.length > 0 ? this.#from : [""];
    let sql = `${selectPrefix} ${fields} FROM ${tables.map((table) => `{{${table}}}`).join(", ")}`;
    for (const join of this.#joins) {
      sql += ` ${join.typ} {{${join.table}}}`;
      if (join.on?.sql) {
        sql += ` ON (${join.on.sql})`;
      }
    }

    const where = combineSelectConditions(this.#where);
    if (where) {
      sql += ` WHERE ${where}`;
    }

    if (this.#groupBy.length > 0) {
      sql += ` GROUP BY ${this.#groupBy.join(", ")}`;
    }

    const having = combineSelectConditions(this.#having);
    if (having) {
      sql += ` HAVING ${having}`;
    }

    if (this.#orderBy.length > 0) {
      sql += ` ORDER BY ${this.#orderBy.join(", ")}`;
    }

    if (this.#limit != null) {
      sql += ` LIMIT ${this.#limit}`;
    }
    if (this.#offset != null) {
      sql += ` OFFSET ${this.#offset}`;
    }

    if (this.#postFragment) {
      sql += ` ${this.#postFragment}`;
    }

    if (this.#unions.length > 0) {
      for (const union of this.#unions) {
        const unionSql = union.query.sql().trim();
        if (!unionSql) {
          continue;
        }
        sql += ` ${union.all ? "UNION ALL" : "UNION"} ${unionSql}`;
      }
    }

    if (this.#preFragment) {
      sql = `${this.#preFragment} ${sql}`;
    }

    return sql;
  }

  private buildParams(): SQLQueryBindings[] {
    const params: SQLQueryBindings[] = [];
    for (const join of this.#joins) {
      if (join.on?.params && Array.isArray(join.on.params)) {
        params.push(...(join.on.params as SQLQueryBindings[]));
      }
    }
    for (const condition of this.#where) {
      if (condition.expr.params && Array.isArray(condition.expr.params)) {
        params.push(...(condition.expr.params as SQLQueryBindings[]));
      }
    }
    for (const condition of this.#having) {
      if (condition.expr.params && Array.isArray(condition.expr.params)) {
        params.push(...(condition.expr.params as SQLQueryBindings[]));
      }
    }
    for (const union of this.#unions) {
      params.push(...union.query.params());
    }
    return params;
  }

  #appendWhere(op: "AND" | "OR", expr: SqlExpr | string): void {
    const normalized = normalizeSelectExpr(expr);
    if (!normalized?.sql) {
      return;
    }
    this.#where.push({
      op: this.#where.length === 0 ? null : op,
      expr: normalized,
    });
  }

  #appendHaving(op: "AND" | "OR", expr: SqlExpr | string): void {
    const normalized = normalizeSelectExpr(expr);
    if (!normalized?.sql) {
      return;
    }
    this.#having.push({
      op: this.#having.length === 0 ? null : op,
      expr: normalized,
    });
  }
}

type SelectCondition = {
  op: "AND" | "OR" | null;
  expr: SqlExpr;
};

type SelectJoin = {
  typ: string;
  table: string;
  on: SqlExpr | null;
};

type SelectUnion = {
  all: boolean;
  query: DbxQuery;
};

type SelectQueryInfo = {
  preFragment: string;
  postFragment: string;
  builder: DbxDatabase;
  selects: string[];
  distinct: boolean;
  selectOption: string;
  from: string[];
  where: SqlExpr | null;
  join: SelectJoin[];
  orderBy: string[];
  groupBy: string[];
  having: SqlExpr | null;
  union: SelectUnion[];
  limit: number | null;
  offset: number | null;
  params: Array<SQLQueryBindings | DbxNamedParams>;
  context: unknown;
  buildHook: DbxBuildHookFunc | null;
};

function normalizeSelectExpr(expr: SqlExpr | string | undefined): SqlExpr | null {
  if (!expr) {
    return null;
  }
  if (typeof expr === "string") {
    return { sql: expr, params: [] };
  }
  if (expr && typeof expr.sql === "string") {
    return expr;
  }
  return null;
}

function combineSelectExpr(conditions: SelectCondition[]): SqlExpr | null {
  if (conditions.length === 0) {
    return null;
  }

  let sql = "";
  const params: SQLQueryBindings[] = [];

  for (const condition of conditions) {
    const clause = `(${condition.expr.sql})`;
    if (!condition.op || !sql) {
      sql = clause;
    } else {
      sql += ` ${condition.op} ${clause}`;
    }

    if (Array.isArray(condition.expr.params)) {
      params.push(...(condition.expr.params as SQLQueryBindings[]));
    }
  }

  if (!sql) {
    return null;
  }

  return { sql, params };
}

function combineSelectConditions(conditions: SelectCondition[]): string {
  return combineSelectExpr(conditions)?.sql ?? "";
}

function cloneBindParam(value: SQLQueryBindings | DbxNamedParams): SQLQueryBindings | DbxNamedParams {
  if (isDbxNamedParams(value)) {
    return { ...value };
  }
  return value;
}

function inferSelectModelTableName(model: Record<string, unknown>): string {
  const directMethod = callStringMethod(model, "tableName") || callStringMethod(model, "TableName");
  if (directMethod) {
    return directMethod;
  }

  const collectionRef =
    callUnknownMethod(model, "collection") ??
    callUnknownMethod(model, "Collection") ??
    (model.collection as unknown) ??
    (model.Collection as unknown);
  if (collectionRef && typeof collectionRef === "object") {
    const collectionName = (collectionRef as Record<string, unknown>).name;
    if (typeof collectionName === "string" && collectionName.trim()) {
      return collectionName.trim();
    }
  }

  const directProp = model.tableName ?? model.TableName ?? model.table ?? model.Table;
  if (typeof directProp === "string" && directProp.trim()) {
    return directProp.trim();
  }

  return "";
}

function callUnknownMethod(target: Record<string, unknown>, name: string): unknown {
  const candidate = target[name];
  if (typeof candidate !== "function") {
    return undefined;
  }
  return (candidate as (...args: never[]) => unknown).call(target);
}

function callStringMethod(target: Record<string, unknown>, name: string): string {
  const result = callUnknownMethod(target, name);
  if (typeof result === "string" && result.trim()) {
    return result.trim();
  }
  return "";
}

function scanIntoTargets(values: unknown[], targets: unknown[]): void {
  for (let i = 0; i < targets.length; i += 1) {
    const target = targets[i];
    const value = values[i];
    if (Array.isArray(target)) {
      target.length = 0;
      target.push(value);
      continue;
    }
    if (!target || typeof target !== "object") {
      continue;
    }
    const objectTarget = target as Record<string, unknown>;
    if ("value" in objectTarget) {
      objectTarget.value = value;
      continue;
    }
    if ("current" in objectTarget) {
      objectTarget.current = value;
    }
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
