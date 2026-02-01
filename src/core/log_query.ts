// Ported from pocketbase/core/log_query.go

import type { SQLQueryBindings } from "bun:sqlite";
import type { SqlExpr } from "../tools/search/types.ts";
import type { App } from "./app.ts";
import { HashExp } from "../tools/dbx/expr.ts";
import { DateTime, ParseDateTime } from "../tools/types/index.ts";
import { Log, LogsTableName, normalizeLogRow } from "./log_model.ts";

export type LogsStatsItem = {
  date: DateTime;
  total: number;
};

export function logQuery(app: App) {
  return app.AuxModelQuery(new Log());
}

export function findLogById(app: App, id: string): Log {
  if (!id) {
    throw new Error("log id is required");
  }

  const row = logQuery(app).AndWhere(HashExp({ id })).Limit(1).One();
  if (!row) {
    throw new Error("log not found");
  }

  return normalizeLogRow(row);
}

export function logsStats(app: App, expr: SqlExpr | null): LogsStatsItem[] {
  let sql = `select count(id) as total, strftime('%Y-%m-%d %H:00:00', created) as date from {{${LogsTableName}}}`;
  const params: SQLQueryBindings[] = [];

  if (expr?.sql) {
    sql = appendWhere(sql, expr.sql);
    params.push(...(expr.params as SQLQueryBindings[]));
  }

  sql = `${sql} group by date`;

  const rows = app
    .auxDb()
    .query(sql)
    .all(...params) as Array<Record<string, unknown>>;
  return rows.map((row) => {
    const rawDate = typeof row.date === "string" ? row.date : "";
    const normalized = rawDate.includes("Z") ? rawDate : `${rawDate}.000Z`;
    const date = ParseDateTime(normalized);
    const total = typeof row.total === "number" ? row.total : Number(row.total ?? 0);
    return { date, total: Number.isFinite(total) ? total : 0 };
  });
}

export function deleteOldLogs(app: App, createdBefore: Date | DateTime): Error | null {
  const dt = createdBefore instanceof DateTime ? createdBefore : new DateTime(createdBefore);
  const formattedDate = dt.toString();

  try {
    app.auxDb().run(`delete from {{${LogsTableName}}} where [[created]] <= ?`, [formattedDate]);
    return null;
  } catch (error) {
    return error as Error;
  }
}

function appendWhere(baseSql: string, clause: string): string {
  if (!clause) {
    return baseSql;
  }
  if (/\bwhere\b/i.test(baseSql)) {
    return `${baseSql} AND ${clause}`;
  }
  return `${baseSql} WHERE ${clause}`;
}
