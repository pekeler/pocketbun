// Ported from pocketbase/core/log_model.go

import { ParseDateTime, type DateTime } from "../tools/types/index.ts";

export const LogsTableName = "_logs";

export class Log {
  id = "";
  created: DateTime = ParseDateTime("");
  data: Record<string, unknown> = {};
  message = "";
  level = 0;

  TableName(): string {
    return LogsTableName;
  }
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
  if (dataValue && typeof dataValue === "object" && !Array.isArray(dataValue)) {
    log.data = dataValue as Record<string, unknown>;
  } else if (typeof dataValue === "string") {
    try {
      const parsed = JSON.parse(dataValue) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        log.data = parsed as Record<string, unknown>;
      }
    } catch {
      log.data = {};
    }
  }

  return log;
}
