// PocketBun-only: log writer helper that offloads log DB writes to a worker.

import { Database, type SQLQueryBindings } from "bun:sqlite";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { applyDefaultDbPragmas } from "../dbx/connect_pragmas.ts";
import { rewriteDbxIdentifiers } from "../dbx/identifiers.ts";

type LogValue = string | number | boolean | bigint | null | undefined | Uint8Array;

type WorkerResponse = {
  id: number;
  ok?: boolean;
};

type WorkerRequest =
  | { type: "init"; dbPath: string }
  | { type: "close" }
  | {
      type: "run";
      sql: string;
      valuesLength: number;
      [key: `values${number}`]: LogValue | undefined;
    };

const WorkerCloseTimeoutMs = 1000;

export class LogWriter {
  #worker: Worker | null = null;
  #syncDb: Database | null = null;
  #closed = false;
  #ready = false;
  private workerClosedPromise: Promise<void> | null = null;

  constructor(dbPath: string) {
    const workerScriptPath = resolveLogWriterWorkerScriptPath(dirname(fileURLToPath(import.meta.url)));
    if (workerScriptPath) {
      this.#worker = new Worker(pathToFileURL(workerScriptPath), { type: "module" });
      this.workerClosedPromise = new Promise<void>((resolveClosed) => {
        this.#worker?.addEventListener("close", () => resolveClosed(), { once: true });
      });
      this.#worker.onmessage = (event) => {
        const data = event.data as WorkerResponse;
        if (data.id === -1 && this.#readyResolve) {
          this.#ready = Boolean(data.ok);
          this.#readyResolve();
          this.#readyResolve = null;
          return;
        }
        if (data.id === 0 && this.#closeResolve) {
          this.#closeResolve();
          this.#closeResolve = null;
        }
      };
      this.#worker.onerror = (event) => {
        const error = event instanceof ErrorEvent ? (event.error ?? new Error(event.message)) : new Error("worker error");
        console.error("Log writer worker error", error);
        if (this.#readyResolve) {
          this.#readyResolve();
          this.#readyResolve = null;
        }
        if (this.#closeResolve) {
          this.#closeResolve();
          this.#closeResolve = null;
        }
      };

      this.#readyPromise = new Promise<void>((resolveReady) => {
        this.#readyResolve = resolveReady;
      });
      this.#worker.postMessage({ type: "init", dbPath });
      return;
    }

    // Fallback for bundled CLI runs where the worker module isn't emitted as a standalone file.
    try {
      this.#syncDb = new Database(dbPath);
      applyDefaultDbPragmas(this.#syncDb);
      this.#ready = true;
    } catch {
      this.#syncDb = null;
      this.#ready = false;
    }
  }

  async run(sql: string, values: unknown[]): Promise<Error | null> {
    if (this.#closed) {
      return new Error("log writer is closed");
    }
    if (!this.#ready && this.#readyPromise) {
      await this.#readyPromise;
    }
    if (this.#syncDb) {
      try {
        this.#syncDb.run(rewriteDbxIdentifiers(sql), values as SQLQueryBindings[]);
      } catch (error) {
        return error as Error;
      }
      return null;
    }
    if (!this.#ready || !this.#worker) {
      return null;
    }
    const payload: WorkerRequest = { type: "run", sql, valuesLength: values.length };
    // Flatten values into indexed fields to keep the worker message in Bun's fast-path
    // (plain object with primitive values) while still binding parameters on the worker.
    for (let i = 0; i < values.length; i += 1) {
      payload[`values${i}`] = values[i] as LogValue;
    }
    this.#worker.postMessage(payload);
    return null;
  }

  async close(): Promise<void> {
    if (this.#closed) {
      await this.#awaitWorkerCloseWithTimeout();
      return;
    }
    this.#closed = true;
    if (this.#syncDb) {
      this.#syncDb.close();
      this.#syncDb = null;
      return;
    }
    if (!this.#worker) {
      return;
    }
    if (!this.#closePromise) {
      this.#closePromise = new Promise<void>((resolveClose) => {
        this.#closeResolve = resolveClose;
      });
      try {
        this.#worker.postMessage({ type: "close" });
      } catch {
        if (this.#closeResolve) {
          this.#closeResolve();
          this.#closeResolve = null;
        }
      }
    }
    await this.#awaitWorkerCloseWithTimeout();
  }

  #closePromise: Promise<void> | null = null;
  #closeResolve: (() => void) | null = null;
  #readyPromise: Promise<void> | null = null;
  #readyResolve: (() => void) | null = null;

  async #awaitWorkerCloseWithTimeout(): Promise<void> {
    if (!this.#closePromise || !this.#worker) {
      return;
    }

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const closeResult = await Promise.race([
      this.#closePromise.then(() => "closed" as const),
      new Promise<"timeout">((resolveTimeout) => {
        timeoutId = setTimeout(() => {
          resolveTimeout("timeout");
        }, WorkerCloseTimeoutMs);
      }),
    ]);

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    if (closeResult === "timeout" && this.#closeResolve) {
      this.#closeResolve();
      this.#closeResolve = null;
    }

    this.#worker.terminate();
    await this.workerClosedPromise;
    this.#worker = null;
    this.workerClosedPromise = null;
    this.#closePromise = null;
  }
}

export function resolveLogWriterWorkerScriptPath(
  baseDir: string,
  fileExists: (path: string) => boolean = existsSync,
): string | null {
  const candidates = [
    resolve(baseDir, "./log_writer_worker.ts"),
    resolve(baseDir, "./log_writer_worker.js"),
    resolve(baseDir, "./tools/logger/log_writer_worker.ts"),
    resolve(baseDir, "./tools/logger/log_writer_worker.js"),
    resolve(baseDir, "../../src/tools/logger/log_writer_worker.ts"),
    resolve(baseDir, "../../src/tools/logger/log_writer_worker.js"),
  ];

  for (let i = 0; i < candidates.length; i += 1) {
    const candidate = candidates[i]!;
    if (fileExists(candidate)) {
      return candidate;
    }
  }

  return null;
}
