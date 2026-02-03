// PocketBun-only: bun:sqlite Database wrapper that applies dbx placeholder rewrites.

import { Database, type Changes, type DatabaseOptions, type SQLQueryBindings, type Statement } from "bun:sqlite";
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
    return super.run(rewriteDbxIdentifiers(sql), ...bindings);
  }

  override exec<ParamsType extends SQLQueryBindings[]>(sql: string, ...bindings: ParamsType[]): Changes {
    this.QueryLogFunc?.(sql);
    // eslint-disable-next-line typescript-eslint/no-deprecated -- bun:sqlite exec supports multi-statement SQL.
    return super.exec(rewriteDbxIdentifiers(sql), ...bindings);
  }

  override query<ReturnType, ParamsType extends SQLQueryBindings | SQLQueryBindings[]>(
    sql: string,
  ): Statement<ReturnType, ParamsType extends any[] ? ParamsType : [ParamsType]> {
    this.QueryLogFunc?.(sql);
    return super.query(rewriteDbxIdentifiers(sql));
  }

  override prepare<ReturnType, ParamsType extends SQLQueryBindings | SQLQueryBindings[]>(
    sql: string,
    params?: ParamsType,
  ): Statement<ReturnType, ParamsType extends any[] ? ParamsType : [ParamsType]> {
    return super.prepare(rewriteDbxIdentifiers(sql), params);
  }

  newQuery(sql: string, ...params: SQLQueryBindings[]): DbxQuery {
    return new DbxQuery(this, sql, params);
  }

  select(...fields: string[]): DbxSelectQuery {
    return new DbxSelectQuery(this, fields);
  }
}
