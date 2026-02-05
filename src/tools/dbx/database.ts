// PocketBun-only: bun:sqlite Database wrapper that applies dbx placeholder rewrites.

import { Database, type Changes, type DatabaseOptions, type SQLQueryBindings, type Statement } from "bun:sqlite";
import { profileDbEnabled, recordDbProfile, recordProfile } from "../perf/profile.ts";
import { rewriteDbxIdentifiers } from "./identifiers.ts";
import { DbxQuery, DbxSelectQuery } from "./query.ts";

export type QueryLogFunc = (sql: string) => void;

export class DbxDatabase extends Database {
  QueryLogFunc?: QueryLogFunc;

  constructor(filename?: string, options?: number | DatabaseOptions) {
    super(filename, options);
  }

  override run<ParamsType extends SQLQueryBindings[]>(sql: string, ...bindings: ParamsType[]): Changes {
    this.QueryLogFunc?.(sql);
    if (!profileDbEnabled()) {
      return super.run(rewriteDbxIdentifiers(sql), ...bindings);
    }
    const started = performance.now();
    try {
      return super.run(rewriteDbxIdentifiers(sql), ...bindings);
    } finally {
      const duration = performance.now() - started;
      recordProfile("db.run", duration);
      recordDbProfile(sql, duration);
    }
  }

  override exec<ParamsType extends SQLQueryBindings[]>(sql: string, ...bindings: ParamsType[]): Changes {
    this.QueryLogFunc?.(sql);
    if (!profileDbEnabled()) {
      // eslint-disable-next-line typescript-eslint/no-deprecated -- bun:sqlite exec supports multi-statement SQL.
      return super.exec(rewriteDbxIdentifiers(sql), ...bindings);
    }
    const started = performance.now();
    try {
      // eslint-disable-next-line typescript-eslint/no-deprecated -- bun:sqlite exec supports multi-statement SQL.
      return super.exec(rewriteDbxIdentifiers(sql), ...bindings);
    } finally {
      const duration = performance.now() - started;
      recordProfile("db.exec", duration);
      recordDbProfile(sql, duration);
    }
  }

  override query<ReturnType, ParamsType extends SQLQueryBindings | SQLQueryBindings[]>(
    sql: string,
  ): Statement<ReturnType, ParamsType extends any[] ? ParamsType : [ParamsType]> {
    this.QueryLogFunc?.(sql);
    const stmt = super.query(rewriteDbxIdentifiers(sql)) as Statement<
      ReturnType,
      ParamsType extends any[] ? ParamsType : [ParamsType]
    >;
    if (!profileDbEnabled()) {
      return stmt;
    }
    return wrapStatement(stmt, sql);
  }

  override prepare<ReturnType, ParamsType extends SQLQueryBindings | SQLQueryBindings[]>(
    sql: string,
    params?: ParamsType,
  ): Statement<ReturnType, ParamsType extends any[] ? ParamsType : [ParamsType]> {
    const stmt = super.prepare(rewriteDbxIdentifiers(sql), params) as Statement<
      ReturnType,
      ParamsType extends any[] ? ParamsType : [ParamsType]
    >;
    if (!profileDbEnabled()) {
      return stmt;
    }
    return wrapStatement(stmt, sql);
  }

  newQuery(sql: string, ...params: SQLQueryBindings[]): DbxQuery {
    return new DbxQuery(this, sql, params);
  }

  select(...fields: string[]): DbxSelectQuery {
    return new DbxSelectQuery(this, fields);
  }
}

const wrappedStatements = new WeakSet<object>();

function wrapStatement<ReturnType, ParamsType extends SQLQueryBindings | SQLQueryBindings[]>(
  stmt: Statement<ReturnType, ParamsType extends any[] ? ParamsType : [ParamsType]>,
  sql: string,
): Statement<ReturnType, ParamsType extends any[] ? ParamsType : [ParamsType]> {
  if (wrappedStatements.has(stmt)) {
    return stmt;
  }
  if (!Object.isExtensible(stmt)) {
    return stmt;
  }
  wrappedStatements.add(stmt);

  const target = stmt as unknown as Record<string, unknown>;

  const wrapMethod = (name: string, label: string) => {
    const fn = target[name];
    if (typeof fn !== "function") {
      return;
    }
    target[name] = (...args: unknown[]) => {
      const started = performance.now();
      try {
        return (fn as (...callArgs: unknown[]) => unknown).apply(stmt, args);
      } finally {
        const duration = performance.now() - started;
        recordProfile(label, duration);
        recordDbProfile(sql, duration);
      }
    };
  };

  wrapMethod("get", "db.get");
  wrapMethod("all", "db.all");
  wrapMethod("run", "db.run_stmt");
  wrapMethod("values", "db.values");
  wrapMethod("iterate", "db.iterate");

  return stmt;
}
