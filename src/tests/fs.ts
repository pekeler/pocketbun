// PocketBun-only: test filesystem cleanup helpers for Windows file-lock retries.

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export type TempDirHandle = {
  path: string;
  cleanup: () => Promise<void>;
  [Symbol.asyncDispose]: () => Promise<void>;
};

function isRetriableRemoveError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = (error as { code?: unknown }).code;
  return code === "EBUSY" || code === "EPERM" || code === "ENOTEMPTY";
}

export async function removeDirWithRetry(dir: string, options: { retries?: number; delayMs?: number } = {}): Promise<void> {
  // Windows runners may keep SQLite/log files locked for several seconds.
  const retries = Math.max(1, options.retries ?? 120);
  const delayMs = Math.max(1, options.delayMs ?? 50);
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      await rm(dir, { recursive: true, force: true });
      return;
    } catch (error) {
      lastError = error;
      if (!isRetriableRemoveError(error)) {
        throw error;
      }
      // Keep test cleanup best-effort; locked temp dirs should not fail test assertions.
      if (attempt === retries) {
        return;
      }
      await Bun.sleep(delayMs);
    }
  }

  if (lastError && !isRetriableRemoveError(lastError)) {
    throw lastError;
  }
}

export async function newTempDir(prefix: string): Promise<TempDirHandle> {
  const path = await mkdtemp(join(tmpdir(), prefix));
  let cleaned = false;

  const cleanup = async () => {
    if (cleaned) {
      return;
    }
    cleaned = true;
    await removeDirWithRetry(path);
  };

  return {
    path,
    cleanup,
    [Symbol.asyncDispose]: cleanup,
  };
}
