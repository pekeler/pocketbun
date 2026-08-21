// PocketBun-only: tests worker path resolution for source and bundled CLI runtimes.

import { describe, expect, it, spyOn } from "bun:test";
import { resolve } from "node:path";
import { resolveLogWriterWorkerScriptPath } from "./log_writer.ts";

describe("resolveLogWriterWorkerScriptPath", () => {
  it("prefers local worker path when running from source", () => {
    const baseDir = resolve("repo", "src", "tools", "logger");
    const workerPath = resolve("repo", "src", "tools", "logger", "log_writer_worker.ts");
    const result = resolveLogWriterWorkerScriptPath(baseDir, (path) => path === workerPath);

    expect(result).toBe(workerPath);
  });

  it("resolves source worker path from bundled dist entrypoint", () => {
    const baseDir = resolve("repo", "dist", "src");
    const workerPath = resolve("repo", "src", "tools", "logger", "log_writer_worker.ts");
    const result = resolveLogWriterWorkerScriptPath(baseDir, (path) => path === workerPath);

    expect(result).toBe(workerPath);
  });

  it("returns null when no candidate worker path exists", () => {
    const result = resolveLogWriterWorkerScriptPath(resolve("repo", "unknown"), () => false);

    expect(result).toBeNull();
  });
});

describe("LogWriter", () => {
  it("waits for worker termination and closes repeatedly", async () => {
    const fakeWorker = new FakeWorker();
    using workerSpy = spyOn(globalThis, "Worker");
    (workerSpy as unknown as { mockImplementation(implementation: () => Worker): void }).mockImplementation(
      () => fakeWorker as unknown as Worker,
    );
    const { LogWriter } = await import("./log_writer.ts");
    const writer = new LogWriter("unused.db");

    let resolved = false;
    const closePromise = writer.close().then(() => {
      resolved = true;
    });
    await Bun.sleep(0);

    expect(fakeWorker.terminateCalls).toBe(1);
    expect(resolved).toBe(false);

    fakeWorker.dispatchEvent(new Event("close"));
    await closePromise;
    await writer.close();

    expect(resolved).toBe(true);
    expect(fakeWorker.terminateCalls).toBe(1);
  });
});

class FakeWorker extends EventTarget {
  onerror: ((this: Worker, ev: ErrorEvent) => unknown) | null = null;
  onmessage: ((this: Worker, ev: MessageEvent) => unknown) | null = null;
  terminateCalls = 0;

  postMessage(message: { type?: string }): void {
    const data = message.type === "init" ? { id: -1, ok: true } : { id: 0 };
    queueMicrotask(() => {
      this.onmessage?.call(this as unknown as Worker, new MessageEvent("message", { data }));
    });
  }

  terminate(): void {
    this.terminateCalls += 1;
  }
}
