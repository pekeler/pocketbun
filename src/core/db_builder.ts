// Ported from pocketbase/core/db_builder.go (simplified for the Bun dbx shim).

import type { SQLQueryBindings, Statement } from "bun:sqlite";
import type { DbxDatabase } from "../tools/dbx/database.ts";
import type { DbxQuery, DbxSelectQuery } from "../tools/dbx/query.ts";

// DualDbBuilder routes read-only select queries to the concurrent DB and
// write queries to the nonconcurrent DB.
export class DualDbBuilder {
  #concurrentDB: DbxDatabase;
  #nonconcurrentDB: DbxDatabase;

  constructor(concurrentDB: DbxDatabase, nonconcurrentDB: DbxDatabase) {
    this.#concurrentDB = concurrentDB;
    this.#nonconcurrentDB = nonconcurrentDB;
  }

  select(...fields: string[]): DbxSelectQuery {
    return this.#concurrentDB.select(...fields);
  }

  newQuery(sql: string, ...params: SQLQueryBindings[]): DbxQuery {
    const trimmed = trimLeftSpaces(sql);
    if (hasPrefixFold(trimmed, "SELECT") || hasPrefixFold(trimmed, "WITH")) {
      return this.#concurrentDB.newQuery(sql, ...params);
    }
    return this.#nonconcurrentDB.newQuery(sql, ...params);
  }

  run<ParamsType extends SQLQueryBindings[]>(sql: string, ...bindings: ParamsType[]) {
    return this.#nonconcurrentDB.run(sql, ...bindings);
  }

  query<ReturnType, ParamsType extends SQLQueryBindings | SQLQueryBindings[]>(
    sql: string,
  ): Statement<ReturnType, ParamsType extends any[] ? ParamsType : [ParamsType]> {
    return this.#concurrentDB.query(sql);
  }
}

const asciiSpace = Array.from({ length: 256 }, () => 0);
asciiSpace[9] = 1;
asciiSpace[10] = 1;
asciiSpace[11] = 1;
asciiSpace[12] = 1;
asciiSpace[13] = 1;
asciiSpace[32] = 1;

// note: similar to strings.Space() but without the right trim because it is not needed in our case
function trimLeftSpaces(str: string): string {
  let start = 0;
  for (; start < str.length; start += 1) {
    const code = str.charCodeAt(start);
    if (code >= 0x80) {
      return str.slice(start).trimStart();
    }
    if (asciiSpace[code] === 0) {
      break;
    }
  }

  return str.slice(start);
}

// note: the prefix is expected to be ASCII
function hasPrefixFold(str: string, prefix: string): boolean {
  if (str.length < prefix.length) {
    return false;
  }

  return str.slice(0, prefix.length).toLowerCase() === prefix.toLowerCase();
}
