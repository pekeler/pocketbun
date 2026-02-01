// PocketBun-only: attach helper to patch dbx placeholder rewrites onto existing Database instances.

import type { Database, SQLQueryBindings, Statement } from "bun:sqlite";
import { rewriteDbxIdentifiers } from "./identifiers.ts";

const patchedSymbol = Symbol.for("pocketbun.dbxRewritePatched");

type PatchedDatabase = Database & {
  [patchedSymbol]?: {
    query: Database["query"];
    prepare: Database["prepare"];
    run: Database["run"];
  };
};

type Mutable<T> = {
  -readonly [K in keyof T]: T[K];
};

export function attachDbxRewrite(db: Database): Database {
  const target = db as PatchedDatabase;
  if (target[patchedSymbol]) {
    return db;
  }

  const original = {
    query: db.query.bind(db),
    prepare: db.prepare.bind(db),
    run: db.run.bind(db),
  };

  target[patchedSymbol] = original;

  (db as Mutable<Database>).query = (<ReturnType, ParamsType extends SQLQueryBindings | SQLQueryBindings[]>(
    sql: string,
  ): Statement<ReturnType, ParamsType extends any[] ? ParamsType : [ParamsType]> => {
    return original.query(rewriteDbxIdentifiers(sql)) as Statement<
      ReturnType,
      ParamsType extends any[] ? ParamsType : [ParamsType]
    >;
  }) as Database["query"];

  (db as Mutable<Database>).prepare = (<ReturnType, ParamsType extends SQLQueryBindings | SQLQueryBindings[]>(
    sql: string,
    params?: ParamsType,
  ): Statement<ReturnType, ParamsType extends any[] ? ParamsType : [ParamsType]> => {
    return original.prepare(rewriteDbxIdentifiers(sql), params) as Statement<
      ReturnType,
      ParamsType extends any[] ? ParamsType : [ParamsType]
    >;
  }) as Database["prepare"];

  (db as Mutable<Database>).run = ((sql: string, ...bindings: unknown[]): unknown => {
    return (original.run as (...args: unknown[]) => unknown)(rewriteDbxIdentifiers(sql), ...bindings);
  }) as Database["run"];

  (db as Mutable<Database> as Record<string, unknown>).exec = ((sql: string, ...bindings: unknown[]): unknown => {
    return (original.run as (...args: unknown[]) => unknown)(rewriteDbxIdentifiers(sql), ...bindings);
  }) as unknown;

  return db;
}
