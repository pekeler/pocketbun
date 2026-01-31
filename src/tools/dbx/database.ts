// dbx-style SQL placeholder rewrite wrapper for bun:sqlite.

import {
  Database,
  type Changes,
  type DatabaseOptions,
  type SQLQueryBindings,
  type Statement,
} from "bun:sqlite";
import { rewriteDbxIdentifiers } from "./identifiers.ts";

export class DbxDatabase extends Database {
  constructor(filename?: string, options?: number | DatabaseOptions) {
    super(filename, options);
  }

  override run<ParamsType extends SQLQueryBindings[]>(
    sql: string,
    ...bindings: ParamsType[]
  ): Changes {
    return super.run(rewriteDbxIdentifiers(sql), ...bindings);
  }

  override exec<ParamsType extends SQLQueryBindings[]>(
    sql: string,
    ...bindings: ParamsType[]
  ): Changes {
    return super.run(rewriteDbxIdentifiers(sql), ...bindings);
  }

  override query<ReturnType, ParamsType extends SQLQueryBindings | SQLQueryBindings[]>(
    sql: string,
  ): Statement<ReturnType, ParamsType extends any[] ? ParamsType : [ParamsType]> {
    return super.query(rewriteDbxIdentifiers(sql));
  }

  override prepare<ReturnType, ParamsType extends SQLQueryBindings | SQLQueryBindings[]>(
    sql: string,
    params?: ParamsType,
  ): Statement<ReturnType, ParamsType extends any[] ? ParamsType : [ParamsType]> {
    return super.prepare(rewriteDbxIdentifiers(sql), params);
  }
}
