// PocketBun-only: log writer helper that offloads log DB writes to a worker.

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

export class LogWriter {
  #worker: Worker;
  #closed = false;
  #ready = false;

  constructor(dbPath: string) {
    this.#worker = new Worker(new URL("./log_writer_worker.ts", import.meta.url), { type: "module" });
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

    this.#readyPromise = new Promise<void>((resolve) => {
      this.#readyResolve = resolve;
    });
    this.#worker.postMessage({ type: "init", dbPath });
  }

  async run(sql: string, values: unknown[]): Promise<Error | null> {
    if (this.#closed) {
      return new Error("log writer is closed");
    }
    if (!this.#ready && this.#readyPromise) {
      await this.#readyPromise;
    }
    if (!this.#ready) {
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
      if (this.#closePromise) {
        await this.#closePromise;
      }
      return;
    }
    this.#closed = true;
    if (!this.#closePromise) {
      this.#closePromise = new Promise<void>((resolve) => {
        this.#closeResolve = resolve;
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
    await this.#closePromise;
    this.#worker.terminate();
    this.#closePromise = null;
  }

  #closePromise: Promise<void> | null = null;
  #closeResolve: (() => void) | null = null;
  #readyPromise: Promise<void> | null = null;
  #readyResolve: (() => void) | null = null;
}
