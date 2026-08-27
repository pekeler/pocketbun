// Ported from pocketbase/core/db_retry.go

import { defaultBusyTimeoutMs } from "../tools/dbx/connect_pragmas.ts";

// default retries intervals (in ms)
export const defaultRetryIntervals = [50, 100, 150, 200, 300, 400, 500, 700, 1000];

// default max retry attempts
export const defaultMaxLockRetries = 12;

const immediateRetryIntervals = [0, 1, 2, 4, 8, 16, 32, 64] as const;
const immediateRetryTimeoutMs = 10_000;

type BusyTimeoutDb = {
  setBusyTimeout: (timeoutMs: number) => void;
};

// execLockRetry returns a retry wrapper for lock errors.
// Deviation: dbx exec hooks aren't ported, so this returns a helper for manual use.
export function execLockRetry(timeoutMs: number, maxRetries = defaultMaxLockRetries) {
  return async (op: () => Error | null | Promise<Error | null>): Promise<Error | null> => {
    const deadline = timeoutMs > 0 ? Date.now() + timeoutMs : null;

    return baseLockRetry(async () => {
      if (deadline !== null && Date.now() > deadline) {
        return new Error("lock retry timeout");
      }

      const result = await op();
      return result ?? null;
    }, maxRetries);
  };
}

// PocketBun-only: sync variant for lock retry helpers (used by sync save paths).
export function execLockRetrySync(timeoutMs: number, maxRetries = defaultMaxLockRetries) {
  return (op: () => Error | null): Error | null => {
    const deadline = timeoutMs > 0 ? Date.now() + timeoutMs : null;

    return baseLockRetrySync((_attempt) => {
      if (deadline !== null && Date.now() > deadline) {
        return new Error("lock retry timeout");
      }

      return op() ?? null;
    }, maxRetries);
  };
}

export async function baseLockRetry(
  op: (attempt: number) => Error | null | Promise<Error | null>,
  maxRetries: number,
): Promise<Error | null> {
  let attempt = 1;

  for (;;) {
    const err = await op(attempt);
    if (err && attempt <= maxRetries) {
      const errStr = err.message ?? String(err);
      // we are checking the error against the plain error texts since the codes could vary between drivers
      if (errStr.includes("database is locked") || errStr.includes("table is locked")) {
        await sleep(getDefaultRetryInterval(attempt));
        attempt += 1;
        continue;
      }
    }

    return err ?? null;
  }
}

// PocketBun-only: avoid blocking a Bun worker while an async model write waits
// for another SQLite connection, without changing raw or synchronous DB calls.
export async function baseImmediateLockRetry(db: BusyTimeoutDb, op: (attempt: number) => Error | null): Promise<Error | null> {
  const deadline = performance.now() + immediateRetryTimeoutMs;
  let attempt = 1;

  for (;;) {
    let err: Error | null;
    db.setBusyTimeout(0);
    try {
      err = op(attempt);
    } finally {
      db.setBusyTimeout(defaultBusyTimeoutMs);
    }

    if (!err || !isLockError(err)) {
      return err;
    }

    const remaining = deadline - performance.now();
    if (remaining <= 0) {
      return err;
    }

    const interval = immediateRetryIntervals[Math.min(attempt - 1, immediateRetryIntervals.length - 1)]!;
    const delay = interval === 0 ? 0 : interval * (0.75 + Math.random() * 0.5);
    await new Promise((resolve) => setTimeout(resolve, Math.min(delay, remaining)));
    attempt += 1;
  }
}

// PocketBun-only: sync variant for lock retry helpers (used by sync save paths).
export function baseLockRetrySync(op: (attempt: number) => Error | null, maxRetries: number): Error | null {
  let attempt = 1;

  for (;;) {
    const err = op(attempt);
    if (err && attempt <= maxRetries) {
      const errStr = err.message ?? String(err);
      // we are checking the error against the plain error texts since the codes could vary between drivers
      if (errStr.includes("database is locked") || errStr.includes("table is locked")) {
        const delay = getDefaultRetryInterval(attempt);
        if (delay > 0) {
          Bun.sleepSync(delay);
        }
        attempt += 1;
        continue;
      }
    }

    return err ?? null;
  }
}

export function getDefaultRetryInterval(attempt: number): number {
  if (attempt < 0 || attempt > defaultRetryIntervals.length - 1) {
    return defaultRetryIntervals[defaultRetryIntervals.length - 1] ?? 0;
  }

  return defaultRetryIntervals[attempt] ?? 0;
}

function isLockError(err: Error): boolean {
  const errStr = err.message ?? String(err);
  return errStr.includes("database is locked") || errStr.includes("table is locked");
}

async function sleep(durationMs: number): Promise<void> {
  if (durationMs <= 0) {
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, durationMs));
}
