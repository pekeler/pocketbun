// PocketBun-only: shared helpers split from bucket/reader/writer to avoid circular imports.

import type { Driver } from "./driver.ts";
import { ErrNotFound } from "./driver.ts";

export const ErrEOF = new Error("EOF");

export function isNotFoundError(err: unknown): boolean {
  if (err === ErrNotFound) {
    return true;
  }
  if (err instanceof AggregateError) {
    return err.errors.some((entry) => isNotFoundError(entry));
  }
  if (err instanceof Error && (err as { cause?: unknown }).cause) {
    return isNotFoundError((err as { cause?: unknown }).cause);
  }
  return false;
}

export function wrapError(drv: Driver, err: Error | null, key: string): Error | null {
  if (!err) {
    return null;
  }

  if (err === ErrEOF) {
    return err;
  }

  const normalized = drv.NormalizeError(err);
  if (normalized === err) {
    if (!key) {
      return err;
    }
    return new Error(`[key: ${key}] ${err.message}`, { cause: err });
  }

  if (!key) {
    return normalized;
  }

  return new Error(`[key: ${key}] ${normalized.message}`, { cause: normalized });
}
