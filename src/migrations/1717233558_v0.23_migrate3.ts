// Ported from pocketbase/migrations/1717233558_v0.23_migrate3.go @ v0.36.1 (9b036fb1)

import type { Database } from "bun:sqlite";
import type { App } from "../core/app.ts";
import { SystemMigrations } from "../core/migrations_runner.ts";

const FILE_NAME = "1717233558_v0.23_migrate3.go";

SystemMigrations.register(up, undefined, FILE_NAME);

function up(app: App): void {
  const db = app.db();
  const fieldsColumn = hasColumn(db, "_collections", "fields") ? "fields" : "schema";
  const names = ["_mfas", "_otps", "_externalAuths", "_authOrigins", "_superusers"];
  const placeholders = names.map(() => "?").join(",");

  const rows = db
    .query(`select id, name, type, ${fieldsColumn} as fields from _collections where name in (${placeholders})`)
    .all(...names) as Array<{ id: string; name: string; type: string; fields: string }>;

  for (const row of rows) {
    const originalId = row.id;
    const fields = parseJson<Record<string, unknown>[]>(row.fields, []);
    let needUpdate = false;

    const expectedId = collectionIdChecksum(row.type, row.name);
    if (originalId !== expectedId) {
      row.id = expectedId;
      needUpdate = true;
    }

    for (const field of fields) {
      if (!toBool(field.system)) {
        continue;
      }
      const type = toString(field.type);
      const name = toString(field.name);
      if (!type || !name) {
        continue;
      }
      const expectedFieldId = fieldIdChecksum(type, name);
      if (field.id !== expectedFieldId) {
        field.id = expectedFieldId;
        needUpdate = true;
      }
    }

    if (!needUpdate) {
      continue;
    }

    db.query(`update _collections set id = ?, ${fieldsColumn} = ? where id = ?`).run(
      row.id,
      JSON.stringify(fields),
      originalId,
    );

    updateRelationReferences(db, fieldsColumn, originalId, row.id);

    for (const table of ["_mfas", "_otps", "_authOrigins"]) {
      if (!hasTable(db, table)) {
        continue;
      }
      db.query(`update ${table} set collectionRef = ? where collectionRef = ?`).run(row.id, originalId);
    }
  }
}

function updateRelationReferences(
  db: Database,
  fieldsColumn: string,
  originalId: string,
  newId: string,
): void {
  const rows = db
    .query(`select id, ${fieldsColumn} as fields from _collections`)
    .all() as Array<{ id: string; fields: string }>;

  for (const row of rows) {
    const fields = parseJson<Record<string, unknown>[]>(row.fields, []);
    let changed = false;

    for (const field of fields) {
      if (toString(field.type) !== "relation") {
        continue;
      }
      if (field.collectionId !== originalId) {
        continue;
      }
      field.collectionId = newId;
      changed = true;
    }

    if (!changed) {
      continue;
    }

    db.query(`update _collections set ${fieldsColumn} = ? where id = ?`).run(
      JSON.stringify(fields),
      row.id,
    );
  }
}

function collectionIdChecksum(type: string, name: string): string {
  return `pbc_${crc32(type + name)}`;
}

function fieldIdChecksum(type: string, name: string): string {
  return `${type}${crc32(name)}`;
}

function crc32(input: string): number {
  let crc = 0xffffffff;
  for (let i = 0; i < input.length; i += 1) {
    crc ^= input.charCodeAt(i);
    for (let j = 0; j < 8; j += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (~crc) >>> 0;
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  if (value && typeof value === "object") {
    return value as T;
  }
  return fallback;
}

function toString(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value == null) {
    return "";
  }
  return String(value);
}

function toBool(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  if (typeof value === "string") {
    return value === "true" || value === "1";
  }
  return false;
}

function hasColumn(db: Database, table: string, column: string): boolean {
  if (!isSafeIdentifier(table)) {
    return false;
  }
  const rows = db.query(`pragma table_info("${table}")`).all() as Array<{ name: string }>;
  return rows.some((row) => row.name.toLowerCase() === column.toLowerCase());
}

function hasTable(db: Database, name: string): boolean {
  const row = db
    .query("select name from sqlite_master where type='table' and name = ?")
    .get(name) as { name?: string } | undefined;
  return Boolean(row?.name);
}

function isSafeIdentifier(value: string): boolean {
  return /^[A-Za-z0-9_]+$/.test(value);
}
