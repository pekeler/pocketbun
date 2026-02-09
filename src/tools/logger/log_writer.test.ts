// PocketBun-only: tests worker path resolution for source and bundled CLI runtimes.

import { describe, expect, it } from "bun:test";
import { resolveLogWriterWorkerScriptPath } from "./log_writer.ts";

describe("resolveLogWriterWorkerScriptPath", () => {
  it("prefers local worker path when running from source", () => {
    const baseDir = "/repo/src/tools/logger";
    const workerPath = "/repo/src/tools/logger/log_writer_worker.ts";
    const result = resolveLogWriterWorkerScriptPath(baseDir, (path) => path === workerPath);

    expect(result).toBe(workerPath);
  });

  it("resolves source worker path from bundled dist entrypoint", () => {
    const baseDir = "/repo/dist/src";
    const workerPath = "/repo/src/tools/logger/log_writer_worker.ts";
    const result = resolveLogWriterWorkerScriptPath(baseDir, (path) => path === workerPath);

    expect(result).toBe(workerPath);
  });

  it("returns null when no candidate worker path exists", () => {
    const result = resolveLogWriterWorkerScriptPath("/repo/unknown", () => false);

    expect(result).toBeNull();
  });
});
