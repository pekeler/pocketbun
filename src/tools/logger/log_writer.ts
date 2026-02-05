// PocketBun-only: log writer helper that offloads log DB writes to a worker.

type Pending = {
  resolve: (value: Error | null) => void;
};

type WorkerResponse = {
  id: number;
  error?: string;
};

export class LogWriter {
  #worker: Worker;
  #pending = new Map<number, Pending>();
  #nextId = 1;
  #closed = false;

  constructor(dbPath: string) {
    this.#worker = new Worker(new URL("./log_writer_worker.ts", import.meta.url), { type: "module" });
    this.#worker.onmessage = (event) => {
      const data = event.data as WorkerResponse;
      const pending = this.#pending.get(data.id);
      if (!pending) {
        return;
      }
      this.#pending.delete(data.id);
      pending.resolve(data.error ? new Error(data.error) : null);
    };
    this.#worker.onerror = (event) => {
      const error = event instanceof ErrorEvent ? (event.error ?? new Error(event.message)) : new Error("worker error");
      this.#failAll(error);
    };

    this.#worker.postMessage({ type: "init", dbPath });
  }

  async run(sql: string, values: unknown[]): Promise<Error | null> {
    if (this.#closed) {
      return new Error("log writer is closed");
    }
    return await this.#send({ type: "run", sql, values });
  }

  close(): void {
    if (this.#closed) {
      return;
    }
    this.#closed = true;
    try {
      this.#worker.postMessage({ type: "close" });
    } catch {
      // ignore worker close errors
    }
    this.#worker.terminate();
    this.#failAll(new Error("log writer closed"));
  }

  #failAll(error: Error): void {
    for (const pending of this.#pending.values()) {
      pending.resolve(error);
    }
    this.#pending.clear();
  }

  async #send(message: { type: string; sql?: string; values?: unknown[] }): Promise<Error | null> {
    const id = this.#nextId;
    this.#nextId += 1;

    return await new Promise<Error | null>((resolve) => {
      this.#pending.set(id, { resolve });
      this.#worker.postMessage({ ...message, id });
    });
  }
}
