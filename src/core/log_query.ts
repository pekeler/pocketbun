// Ported from pocketbase/core/log_query.go

import type { SQLQueryBindings } from "bun:sqlite";
import type { SqlExpr } from "../tools/search/types.ts";
import type { App } from "./app.ts";
import { HashExp } from "../tools/dbx/expr.ts";
import { DateTime, ParseDateTime } from "../tools/types/index.ts";
import { Log, LogsTableName, normalizeLogRow } from "./log_model.ts";

// LogsStatsItem defines the total number of logs for a specific time period.
export type LogsStatsItem = {
  date: DateTime;
  total: number;
};

// LogQuery returns a new Log select query.
export function logQuery(app: App) {
  return app.AuxModelQuery(new Log());
}

// FindLogById finds a single Log entry by its id.
export function findLogById(app: App, id: string): Log {
  const row = logQuery(app).AndWhere(HashExp({ id })).Limit(1).One();
  if (!row) {
    throw new Error("log not found");
  }

  return normalizeLogRow(row);
}

// CountLogs returns the total number of log entries.
export function countLogs(app: App, ...optExprs: Array<SqlExpr | null | undefined>): number {
  const query = logQuery(app).Select("count(*)");
  for (const expr of optExprs) {
    if (expr != null) {
      // add only the non-nil expressions
      query.AndWhere(expr);
    }
  }
  return query.Row<number>() ?? 0;
}

// LogsStats returns hourly grouped logs statistics.
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

// DeleteOldLogs delete all logs that are created before createdBefore.
//
// For better performance the logs delete is executed as plain SQL statement,
// aka. no delete model hook events will be fired.
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
