// PocketBun-only: shared SQLite PRAGMA initialization used by all DB connection entrypoints.

import { constants as sqliteConstants } from "bun:sqlite";

type PragmaCapableDb = {
  run: (sql: string) => unknown;
  fileControl?: (op: number, arg: number) => unknown;
};

const defaultDbPragmas = [
  "PRAGMA busy_timeout = 10000",
  "PRAGMA journal_mode = WAL",
  "PRAGMA journal_size_limit = 200000000",
  "PRAGMA synchronous = NORMAL",
  "PRAGMA foreign_keys = ON",
  "PRAGMA temp_store = MEMORY",
  "PRAGMA cache_size = -32000",
] as const;

export function applyDefaultDbPragmas(db: PragmaCapableDb): void {
  // Bun's SQLite can persist WAL sidecar files after close unless this is disabled.
  // Keep it explicit for predictable shutdown behavior matching PocketBase.
  if (typeof db.fileControl === "function") {
    try {
      db.fileControl(sqliteConstants.SQLITE_FCNTL_PERSIST_WAL, 0);
    } catch {
      // ignore file-control failures and continue with default pragmas
    }
  }

  // Note: the busy_timeout pragma must be first because
  // the connection needs to be set to block on busy before WAL mode
  // is set in case it hasn't been already set by another connection.
  for (const pragma of defaultDbPragmas) {
    db.run(pragma);
  }
}
