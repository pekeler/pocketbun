// Ported from pocketbase/core/db_retry.go

// default retries intervals (in ms)
export const defaultRetryIntervals = [50, 100, 150, 200, 300, 400, 500, 700, 1000];

// default max retry attempts
export const defaultMaxLockRetries = 12;

// execLockRetry returns a retry wrapper for lock errors.
// Deviation: dbx exec hooks aren't ported, so this returns a helper for manual use.
export function execLockRetry(timeoutMs: number, maxRetries = defaultMaxLockRetries) {
  return async (op: () => Error | null | Promise<Error | null>): Promise<Error | null> => {
    const deadline = timeoutMs > 0 ? Date.now() + timeoutMs : null;

    return await baseLockRetry(async () => {
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

async function sleep(durationMs: number): Promise<void> {
  if (durationMs <= 0) {
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, durationMs));
}
