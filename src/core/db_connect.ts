// Ported from pocketbase/core/db_connect.go

import { applyDefaultDbPragmas } from "../tools/dbx/connect_pragmas.ts";
import { DbxDatabase } from "../tools/dbx/database.ts";

export function DefaultDBConnect(dbPath: string): DbxDatabase {
  const db = new DbxDatabase(dbPath);
  applyDefaultDbPragmas(db);

  return db;
}
