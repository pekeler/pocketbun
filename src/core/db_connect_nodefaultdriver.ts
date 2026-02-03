// Ported from pocketbase/core/db_connect_nodefaultdriver.go

import type { DbxDatabase } from "../tools/dbx/database.ts";

export function DefaultDBConnect(_dbPath: string): DbxDatabase {
  throw new Error("DBConnect config option must be set when the no_default_driver tag is used!");
}
