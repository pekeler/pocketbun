// Ported from pocketbase/core/log_model.go

import type { App } from "./app.ts";
import { deterministicJSONStringify } from "../internal/compat/deterministic_json.ts";
import { ParseDateTime, type DateTime } from "../tools/types/index.ts";
import { JSONMap } from "../tools/types/json_map.ts";
import { JSONRaw } from "../tools/types/json_raw.ts";

export const LogsTableName = "_logs";

const defaultMaxLogDataSize = 16 << 10;
const defaultMaxLogMessageSize = 8000;

export class Log {
  id = "";
  #lastSavedPK = "";
  created: DateTime = ParseDateTime("");
  data: JSONMap<unknown> = new JSONMap();
  message = "";
  level = 0;

  TableName(): string {
    return LogsTableName;
  }

  // DBExport prepares and exports the current log model for db persistence.
  // It also truncates the log's message and data to keep individual rows bounded.
  DBExport(app: App): Record<string, unknown> {
    const maxDataSize = app.settings().logs.maxDataSize || defaultMaxLogDataSize;
    const data = this.data.toJSON();
    const rawData = deterministicJSONStringify(data);

    return {
      id: this.id,
      created: this.created,
      level: this.level,
      message: truncateUtf8(this.message, defaultMaxLogMessageSize),
      data:
        Object.keys(data).length === 0
          ? this.data
          : new JSONRaw(
              utf8Length(rawData) <= maxDataSize
                ? rawData
                : deterministicJSONStringify({
                    ...(parseTruncatedJSONObject(truncateUtf8(rawData, maxDataSize)) ??
                      completeTopLevelEntriesWithin(data, maxDataSize)),
                    __pb_truncated__: true,
                  }),
            ),
    };
  }

  PK(): string {
    return this.id;
  }

  LastSavedPK(): string {
    return this.#lastSavedPK;
  }

  IsNew(): boolean {
    return this.#lastSavedPK === "";
  }

  MarkAsNew(): void {
    this.#lastSavedPK = "";
  }

  MarkAsNotNew(): void {
    this.#lastSavedPK = this.id;
  }

  PostScan(): Error | null {
    this.MarkAsNotNew();
    return null;
  }
}

function parseTruncatedJSONObject(raw: string): Record<string, unknown> | null {
  let completed = raw;
  const closers: string[] = [];
  let inString = false;
  let escaped = false;

  for (const char of completed) {
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
    } else if (char === "{") {
      closers.push("}");
    } else if (char === "[") {
      closers.push("]");
    } else if (char === "}" || char === "]") {
      closers.pop();
    }
  }

  if (inString) {
    if (escaped) {
      completed = completed.slice(0, -1);
    } else {
      const incompleteUnicodeEscape = completed.match(/\\u[0-9a-fA-F]{0,3}$/)?.[0];
      if (incompleteUnicodeEscape) {
        completed = completed.slice(0, -incompleteUnicodeEscape.length);
      }
    }
    completed += '"';
  }
  completed += closers.reverse().join("");

  try {
    const value = JSON.parse(completed) as unknown;
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function completeTopLevelEntriesWithin(data: Record<string, unknown>, maxBytes: number): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  let usedBytes = 1; // opening brace

  for (const key of Object.keys(data).sort()) {
    const encodedEntry = `${usedBytes === 1 ? "" : ","}${JSON.stringify(key)}:${deterministicJSONStringify(data[key])}`;
    const entryBytes = utf8Length(encodedEntry);
    if (usedBytes + entryBytes > maxBytes) {
      break;
    }
    result[key] = data[key];
    usedBytes += entryBytes;
  }

  return result;
}

function truncateUtf8(value: string, maxBytes: number): string {
  const encoded = new TextEncoder().encode(value);
  if (encoded.length <= maxBytes) {
    return value;
  }
  return new TextDecoder().decode(encoded.subarray(0, maxBytes));
}

function utf8Length(value: string): number {
  return new TextEncoder().encode(value).length;
}

export function normalizeLogRow(row: Record<string, unknown>): Log {
  const log = new Log();

  if (typeof row.id === "string") {
    log.id = row.id;
  }

  log.created = ParseDateTime(row.created ?? "");

  if (typeof row.message === "string") {
    log.message = row.message;
  }

  if (typeof row.level === "number" && Number.isFinite(row.level)) {
    log.level = row.level;
  } else if (typeof row.level === "string" && row.level !== "" && Number.isFinite(Number(row.level))) {
    log.level = Number(row.level);
  }

  const dataValue = row.data;
  if (dataValue instanceof JSONMap) {
    log.data = dataValue;
  } else if (dataValue && typeof dataValue === "object" && !Array.isArray(dataValue)) {
    log.data = new JSONMap(dataValue as Record<string, unknown>);
  } else if (typeof dataValue === "string") {
    try {
      const parsed = JSON.parse(dataValue) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        log.data = new JSONMap(parsed as Record<string, unknown>);
      }
    } catch {
      log.data = new JSONMap();
    }
  }

  return log;
}
