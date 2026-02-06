// PocketBun-only: worker that writes logs to SQLite without blocking the main event loop.

import { Database, type SQLQueryBindings } from "bun:sqlite";
import { applyDefaultDbPragmas } from "../dbx/connect_pragmas.ts";
import { rewriteDbxIdentifiers } from "../dbx/identifiers.ts";

type RunMessage = {
  type: "run";
  sql: string;
  valuesLength: number;
  [key: `values${number}`]: LogValue | undefined;
};

type InitMessage = {
  type: "init";
  dbPath: string;
};

type CloseMessage = {
  type: "close";
};

type WorkerMessage = RunMessage | InitMessage | CloseMessage;
type WorkerResponse = { id: number; ok?: boolean; error?: string };
type WorkerMessageEvent = { data: WorkerMessage };
type WorkerGlobal = {
  postMessage: (message: WorkerResponse) => void;
  onmessage: (event: WorkerMessageEvent) => void;
  close: () => void;
};

const workerGlobal = globalThis as unknown as WorkerGlobal;
type LogValue = string | number | boolean | bigint | null | undefined | Uint8Array;

let db: Database | null = null;
const logWorkerErrors = process.env.POCKETBUN_LOG_WORKER_ERRORS === "1";

function resolveValues(message: RunMessage): SQLQueryBindings[] {
  const length = message.valuesLength;
  if (length <= 0) {
    return [];
  }
  const values: SQLQueryBindings[] = Array.from({ length });
  const record = message as unknown as Record<string, LogValue>;
  // Values are flattened into numbered fields by LogWriter to avoid arrays in the worker message.
  for (let i = 0; i < length; i += 1) {
    values[i] = record[`values${i}`] as SQLQueryBindings;
  }
  return values;
}

const handleRun = (message: RunMessage) => {
  if (!db) {
    return;
  }

  try {
    const rewritten = rewriteDbxIdentifiers(message.sql);
    const values = resolveValues(message);
    db.run(rewritten, values);
  } catch (error) {
    if (logWorkerErrors) {
      const err = error as Error;
      console.error("Failed to write log", err.message ?? String(err));
    }
  }
};

const handleInit = (message: InitMessage) => {
  if (db) {
    workerGlobal.postMessage({ id: -1, ok: true });
    return;
  }
  try {
    db = new Database(message.dbPath);
    applyDefaultDbPragmas(db);
    workerGlobal.postMessage({ id: -1, ok: true });
  } catch (error) {
    if (logWorkerErrors) {
      console.error("Failed to initialize log writer DB", error);
    }
    db = null;
    workerGlobal.postMessage({ id: -1, ok: false });
  }
};

const handleClose = () => {
  if (db) {
    db.close();
    db = null;
  }
  workerGlobal.postMessage({ id: 0 });
  workerGlobal.close();
};

workerGlobal.onmessage = (event: WorkerMessageEvent) => {
  const message = event.data;
  switch (message.type) {
    case "init":
      handleInit(message);
      break;
    case "run":
      handleRun(message);
      break;
    case "close":
      handleClose();
      break;
    default:
      break;
  }
};
