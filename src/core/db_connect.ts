// Ported from pocketbase/core/db_connect.go

import { DbxDatabase } from "../tools/dbx/database.ts";

export function DefaultDBConnect(dbPath: string): DbxDatabase {
  const db = new DbxDatabase(dbPath);

  // Note: the busy_timeout pragma must be first because
  // the connection needs to be set to block on busy before WAL mode
  // is set in case it hasn't been already set by another connection.
  db.run("PRAGMA busy_timeout = 10000");
  db.run("PRAGMA journal_mode = WAL");
  db.run("PRAGMA journal_size_limit = 200000000");
  db.run("PRAGMA synchronous = NORMAL");
  db.run("PRAGMA foreign_keys = ON");
  db.run("PRAGMA temp_store = MEMORY");
  db.run("PRAGMA cache_size = -32000");

  return db;
}
