// PocketBun-only: worker that writes logs to SQLite without blocking the main event loop.

import { Database, type SQLQueryBindings } from "bun:sqlite";
import { rewriteDbxIdentifiers } from "../dbx/identifiers.ts";

type RunMessage = {
  type: "run";
  id: number;
  sql: string;
  values: unknown[];
};

type InitMessage = {
  type: "init";
  dbPath: string;
};

type CloseMessage = {
  type: "close";
};

type WorkerMessage = RunMessage | InitMessage | CloseMessage;
type WorkerResponse = { id: number; error?: string };
type WorkerMessageEvent = { data: WorkerMessage };
type WorkerGlobal = {
  postMessage: (message: WorkerResponse) => void;
  onmessage: (event: WorkerMessageEvent) => void;
  close: () => void;
};

const workerGlobal = globalThis as unknown as WorkerGlobal;

let db: Database | null = null;

const handleRun = (message: RunMessage) => {
  if (!db) {
    workerGlobal.postMessage({ id: message.id, error: "log writer not initialized" });
    return;
  }

  try {
    const rewritten = rewriteDbxIdentifiers(message.sql);
    db.run(rewritten, message.values as SQLQueryBindings[]);
    workerGlobal.postMessage({ id: message.id });
  } catch (error) {
    const err = error as Error;
    workerGlobal.postMessage({ id: message.id, error: err.message ?? String(err) });
  }
};

const handleInit = (message: InitMessage) => {
  if (db) {
    return;
  }
  db = new Database(message.dbPath);
  db.run("PRAGMA busy_timeout = 10000");
  db.run("PRAGMA journal_mode = WAL");
  db.run("PRAGMA journal_size_limit = 200000000");
  db.run("PRAGMA synchronous = NORMAL");
  db.run("PRAGMA foreign_keys = ON");
  db.run("PRAGMA temp_store = MEMORY");
  db.run("PRAGMA cache_size = -32000");
};

const handleClose = () => {
  if (db) {
    db.close();
    db = null;
  }
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
