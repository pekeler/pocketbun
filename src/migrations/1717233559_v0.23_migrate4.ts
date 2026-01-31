// Ported from pocketbase/migrations/1717233559_v0.23_migrate4.go

import type { Database } from "bun:sqlite";
import type { App } from "../core/app.ts";
import { SystemMigrations } from "../core/migrations_runner.ts";

const FILE_NAME = "1717233559_v0.23_migrate4.go";

SystemMigrations.register(up, undefined, FILE_NAME);

function up(app: App): void {
  const db = app.db();
  const fieldsColumn = hasColumn(db, "_collections", "fields") ? "fields" : "schema";
  const row = db
    .query(`select id, ${fieldsColumn} as fields from _collections where name = ?`)
    .get("_otps") as { id: string; fields: string } | undefined;
  if (!row) {
    throw new Error("missing _otps collection");
  }

  const fields = parseJson<Record<string, unknown>[]>(row.fields, []);
  if (fields.some((field) => toString(field.name) === "sentTo")) {
    return;
  }

  fields.push(
    textField("sentTo", {
      system: true,
      required: false,
      hidden: true,
    }),
  );

  db.query(`update _collections set ${fieldsColumn} = ? where id = ?`).run(
    JSON.stringify(fields),
    row.id,
  );

  if (!hasColumn(db, "_otps", "sentTo")) {
    db.run("ALTER TABLE _otps ADD COLUMN sentTo TEXT DEFAULT '' NOT NULL;");
  }
}

function textField(
  name: string,
  options: {
    system: boolean;
    required: boolean;
    hidden: boolean;
  },
): Record<string, unknown> {
  return {
    type: "text",
    name,
    id: fieldIdChecksum("text", name),
    system: options.system,
    hidden: options.hidden,
    presentable: false,
    primaryKey: false,
    required: options.required,
    min: 0,
    max: 0,
    pattern: "",
    autogeneratePattern: "",
  };
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
  return ~crc >>> 0;
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
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  return "";
}

function hasColumn(db: Database, table: string, column: string): boolean {
  if (!isSafeIdentifier(table)) {
    return false;
  }
  const rows = db.query(`pragma table_info("${table}")`).all() as Array<{ name: string }>;
  return rows.some((row) => row.name.toLowerCase() === column.toLowerCase());
}

function isSafeIdentifier(value: string): boolean {
  return /^[A-Za-z0-9_]+$/.test(value);
}
