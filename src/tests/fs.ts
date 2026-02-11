// PocketBun-only: test filesystem cleanup helpers for Windows file-lock retries.

import { rm } from "node:fs/promises";

function isRetriableRemoveError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = (error as { code?: unknown }).code;
  return code === "EBUSY" || code === "EPERM" || code === "ENOTEMPTY";
}

export async function removeDirWithRetry(dir: string, options: { retries?: number; delayMs?: number } = {}): Promise<void> {
  // Windows runners may keep SQLite/log files locked for several seconds.
  const retries = Math.max(1, options.retries ?? 240);
  const delayMs = Math.max(1, options.delayMs ?? 50);
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      await rm(dir, { recursive: true, force: true });
      return;
    } catch (error) {
      lastError = error;
      if (!isRetriableRemoveError(error) || attempt === retries) {
        throw error;
      }
      await Bun.sleep(delayMs);
    }
  }

  if (lastError) {
    throw lastError;
  }
}
