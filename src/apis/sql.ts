// Ported from pocketbase/apis/sql.go
// Deviation: Bun's SQLite API doesn't expose cancellable contexts or column nullability metadata.

import type { Changes, Statement } from "bun:sqlite";
import type { App } from "../core/app.ts";
import type { RequestEvent } from "../core/event_request.ts";
import type { RouterGroup } from "../tools/router/group.ts";
import { ValidationError, ValidationErrors, required } from "../internal/compat/validation.ts";
import { badRequest, forbidden } from "./api_errors.ts";
import { RequireSuperuserAuth } from "./middlewares.ts";
import { readJsonBody } from "./record_auth_utils.ts";

const runSQLMaxRows = 1000;

// bindSQLApi registers the SQL api endpoints.
export function bindSQLApi(app: App, rg: RouterGroup<RequestEvent>): void {
  const subGroup = rg.group("/sql").bind(RequireSuperuserAuth());
  subGroup.post("", (event) => runSQL(app, event));
}

async function runSQL(app: App, event: RequestEvent): Promise<Response> {
  // extra precaution in case manually invoked from somewhere else
  if (!event.hasSuperuserAuth()) {
    return forbidden(event, "");
  }

  const form = { query: "" };
  const body = await readJsonBody(event);
  if (body.error) {
    return badRequest(event, "An error occurred while loading the submitted data.", body.error);
  }
  if (body.data && typeof body.data.query === "string") {
    form.query = body.data.query;
  }

  const validationErr = validateRunSQLForm(form);
  if (validationErr) {
    return badRequest(event, "An error occurred while validating the submitted data.", validationErr);
  }

  try {
    const result = await executeQuery(app, form.query, runSQLMaxRows);
    return event.json(200, result);
  } catch (error) {
    return badRequest(event, `Failed to execute query. Raw error:\n${normalizeSQLExecutionError(error).message}`, null);
  }
}

function validateRunSQLForm(form: { query: string }): Error | null {
  const errors: Record<string, Error> = {};

  const queryRequiredErr = required(form.query);
  if (queryRequiredErr) {
    errors.query = queryRequiredErr;
  } else if (form.query.length > 5000) {
    errors.query = new ValidationError("validation_length_out_of_range", "The length must be between 0 and 5000.");
  }

  return Object.keys(errors).length > 0 ? new ValidationErrors(errors) : null;
}

type RunSQLResultColumn = {
  name: string;
  type: string;
  nullable: boolean;
};

type RunSQLResult = {
  execTime: number;
  affectedRows: number;
  columns: RunSQLResultColumn[];
  rows: unknown[][];
};

const knownWriteQueryPrefixes = ["INSERT", "CREATE", "UPDATE", "DELETE", "DROP", "DETACH", "ALTER", "REPLACE"];

async function executeQuery(app: App, query: string, maxRows: number): Promise<RunSQLResult> {
  query = query.trim();
  if (!query) {
    // see https://github.com/mattn/go-sqlite3/issues/950
    throw new Error("empty query");
  }

  let isPossibleWriteQuery = false;

  // loosely check the query type
  const ucQuery = query.toUpperCase();
  if (!ucQuery.startsWith("SELECT")) {
    for (const prefix of knownWriteQueryPrefixes) {
      if (ucQuery.startsWith(prefix)) {
        isPossibleWriteQuery = true;
        break;
      }
    }
  }

  const result: RunSQLResult = {
    // init empty slices to ensure "[]" serialization
    execTime: 0,
    affectedRows: 0,
    columns: [],
    rows: [],
  };

  const startedAt = performance.now();
  try {
    // assume write/mutation query
    // ---------------------------------------------------------------
    if (isPossibleWriteQuery) {
      const txErr = await app.RunInTransaction((txApp) => {
        try {
          const runResult = txApp.db().run(query) as Changes;
          result.affectedRows = Number(runResult.changes ?? 0);
          return null;
        } catch (error) {
          return normalizeSQLExecutionError(error);
        }
      });
      if (txErr) {
        throw txErr;
      }

      return result;
    }

    // assume query returning rows
    // ---------------------------------------------------------------
    const statements = splitSQLStatements(query);
    const lastStatement = statements[statements.length - 1] ?? query;
    const db = app.db();
    for (const previousStatement of statements.slice(0, -1)) {
      db.run(previousStatement);
    }

    const stmt = db.query(lastStatement) as Statement<Record<string, unknown>, never[]>;
    const native = (stmt as unknown as { native?: StatementNativeMetadata }).native;
    const columnNames = stmt.columnNames ?? [];
    const declaredTypes = native?.declaredTypes ?? [];

    for (let i = 0; i < columnNames.length; i++) {
      result.columns.push({
        name: columnNames[i] ?? "",
        type: declaredTypes[i] ?? "",
        nullable: true,
      });
    }

    const rows = stmt.values() as unknown[][];
    const limitedRows = maxRows >= 0 ? rows.slice(0, maxRows) : rows;
    for (const row of limitedRows) {
      result.rows.push(row.map(normalizeCellValue));
    }

    return result;
  } catch (error) {
    throw normalizeSQLExecutionError(error);
  } finally {
    result.execTime = Math.floor(performance.now() - startedAt);
  }
}

type StatementNativeMetadata = {
  declaredTypes?: Array<string | null | undefined>;
};

function normalizeCellValue(value: unknown): unknown {
  if (value == null) {
    return null;
  }
  if (value instanceof Uint8Array) {
    return new TextDecoder().decode(value);
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value) ?? "";
}

function normalizeSQLExecutionError(error: unknown): Error {
  const err = error instanceof Error ? error : new Error(String(error));
  const name = (err as { name?: string }).name ?? "";
  if (name === "SQLiteError" && !err.message.includes("SQL logic error")) {
    return new Error(`SQL logic error: ${err.message}`);
  }
  return err;
}

function splitSQLStatements(sql: string): string[] {
  const statements: string[] = [];
  let start = 0;
  let quote: "'" | '"' | "`" | "[" | null = null;
  let lineComment = false;
  let blockComment = false;

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i]!;
    const next = sql[i + 1] ?? "";

    if (lineComment) {
      if (ch === "\n" || ch === "\r") {
        lineComment = false;
      }
      continue;
    }

    if (blockComment) {
      if (ch === "*" && next === "/") {
        blockComment = false;
        i++;
      }
      continue;
    }

    if (quote) {
      if (quote === "[" && ch === "]") {
        quote = null;
      } else if (quote !== "[" && ch === quote) {
        if (next === quote && quote !== "`") {
          i++;
        } else {
          quote = null;
        }
      }
      continue;
    }

    if (ch === "-" && next === "-") {
      lineComment = true;
      i++;
      continue;
    }

    if (ch === "/" && next === "*") {
      blockComment = true;
      i++;
      continue;
    }

    if (ch === "'" || ch === '"' || ch === "`" || ch === "[") {
      quote = ch;
      continue;
    }

    if (ch === ";") {
      const statement = sql.slice(start, i).trim();
      if (statement) {
        statements.push(statement);
      }
      start = i + 1;
    }
  }

  const last = sql.slice(start).trim();
  if (last) {
    statements.push(last);
  }

  return statements.length > 0 ? statements : [sql.trim()];
}
