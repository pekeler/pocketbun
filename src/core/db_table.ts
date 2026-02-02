// Ported from pocketbase/core/db_table.go

import type { Database } from "bun:sqlite";

export type TableInfoRow = {
  PK: number;
  Index: number;
  Name: string;
  Type: string;
  NotNull: boolean;
  DefaultValue: string | null;
};

export function TableInfo(db: Database, tableName: string): TableInfoRow[] {
  // bun:sqlite doesn't reliably bind PRAGMA table names; inline a quoted name instead.
  const safeName = tableName.replace(/'/g, "''");
  const rows = db.query(`select * from pragma_table_info('${safeName}')`).all() as Array<{
    pk: number;
    cid: number;
    name: string;
    type: string;
    notnull: number;
    dflt_value: string | null;
  }>;

  if (!rows || rows.length === 0) {
    throw new Error(`empty table info probably due to invalid or missing table ${tableName}`);
  }

  return rows.map((row) => ({
    PK: row.pk,
    Index: row.cid,
    Name: row.name,
    Type: row.type,
    NotNull: Boolean(row.notnull),
    DefaultValue: row.dflt_value,
  }));
}

export function TableColumns(db: Database, tableName: string): string[] {
  // bun:sqlite doesn't reliably bind PRAGMA table names; inline a quoted name instead.
  const safeName = tableName.replace(/'/g, "''");
  const rows = db.query(`select name from pragma_table_info('${safeName}')`).all() as Array<{
    name: string;
  }>;
  return rows.map((row) => row.name);
}

// TableIndexes returns a name grouped map with all non empty index of the specified table.
//
// Note: This method doesn't return an error on nonexisting table.
export function TableIndexes(db: Database, tableName: string): Record<string, string> {
  const rows = db
    .query("select name, sql from sqlite_master where sql is not null and type = 'index' and tbl_name = ?")
    .all(tableName) as Array<{ name: string; sql: string | null }>;

  const result: Record<string, string> = {};
  for (const row of rows ?? []) {
    if (!row?.name || !row.sql) {
      continue;
    }
    result[row.name] = row.sql;
  }

  return result;
}
