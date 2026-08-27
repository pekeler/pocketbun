// PocketBun-only: bun:sqlite Database wrapper that applies dbx placeholder rewrites.

import { Database, type Changes, type DatabaseOptions, type SQLQueryBindings, type Statement } from "bun:sqlite";
import { rewriteDbxIdentifiers } from "./identifiers.ts";
import { DbxQuery, DbxSelectQuery } from "./query.ts";

export type QueryLogFunc = (sql: string, durationMs?: number) => void;

export class DbxDatabase extends Database {
  QueryLogFunc?: QueryLogFunc;

  constructor(filename?: string, options?: number | DatabaseOptions) {
    super(filename, options);
  }

  setBusyTimeout(timeoutMs: number): void {
    super.query(`PRAGMA busy_timeout = ${timeoutMs}`).get();
  }

  override run<ParamsType extends SQLQueryBindings[]>(sql: string, ...bindings: ParamsType[]): Changes {
    const rewritten = rewriteDbxIdentifiers(sql);
    const queryLogFunc = this.QueryLogFunc;
    if (!queryLogFunc) {
      return super.run(rewritten, ...bindings);
    }

    const startedAt = performance.now();
    try {
      return super.run(rewritten, ...bindings);
    } finally {
      queryLogFunc(rewritten, performance.now() - startedAt);
    }
  }

  override exec<ParamsType extends SQLQueryBindings[]>(sql: string, ...bindings: ParamsType[]): Changes {
    const rewritten = rewriteDbxIdentifiers(sql);
    const queryLogFunc = this.QueryLogFunc;
    if (!queryLogFunc) {
      // eslint-disable-next-line typescript-eslint/no-deprecated -- bun:sqlite exec supports multi-statement SQL.
      return super.exec(rewritten, ...bindings);
    }

    const startedAt = performance.now();
    try {
      // eslint-disable-next-line typescript-eslint/no-deprecated -- bun:sqlite exec supports multi-statement SQL.
      return super.exec(rewritten, ...bindings);
    } finally {
      queryLogFunc(rewritten, performance.now() - startedAt);
    }
  }

  override query<ReturnType, ParamsType extends SQLQueryBindings | SQLQueryBindings[]>(
    sql: string,
  ): Statement<ReturnType, ParamsType extends any[] ? ParamsType : [ParamsType]> {
    const rewritten = rewriteDbxIdentifiers(sql);
    const stmt = super.query(rewritten) as Statement<ReturnType, ParamsType extends any[] ? ParamsType : [ParamsType]>;
    const queryLogFunc = this.QueryLogFunc;
    if (!queryLogFunc) {
      return stmt;
    }
    return wrapStatement(stmt, rewritten, queryLogFunc);
  }

  override prepare<ReturnType, ParamsType extends SQLQueryBindings | SQLQueryBindings[]>(
    sql: string,
    params?: ParamsType,
  ): Statement<ReturnType, ParamsType extends any[] ? ParamsType : [ParamsType]> {
    const rewritten = rewriteDbxIdentifiers(sql);
    const stmt = super.prepare(rewritten, params) as Statement<
      ReturnType,
      ParamsType extends any[] ? ParamsType : [ParamsType]
    >;
    const queryLogFunc = this.QueryLogFunc;
    if (!queryLogFunc) {
      return stmt;
    }
    return wrapStatement(stmt, rewritten, queryLogFunc);
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
  logSql: string,
  logFn?: QueryLogFunc,
): Statement<ReturnType, ParamsType extends any[] ? ParamsType : [ParamsType]> {
  if (wrappedStatements.has(stmt)) {
    return stmt;
  }
  if (!Object.isExtensible(stmt)) {
    return stmt;
  }
  wrappedStatements.add(stmt);

  const target = stmt as unknown as Record<string, unknown>;

  const wrapMethod = (name: string) => {
    const fn = target[name];
    if (typeof fn !== "function") {
      return;
    }
    target[name] = (...args: unknown[]) => {
      const startedAt = performance.now();
      try {
        return (fn as (...callArgs: unknown[]) => unknown).apply(stmt, args);
      } finally {
        logFn?.(logSql, performance.now() - startedAt);
      }
    };
  };

  wrapMethod("get");
  wrapMethod("all");
  wrapMethod("run");
  wrapMethod("values");
  wrapMethod("iterate");

  return stmt;
}
