// Ported from pocketbase/core/validators/equal.go

import { newError } from "../../internal/compat/validation.ts";

export function Equal<T>(valueToCompare: T): (value: unknown) => Error | null {
  return (value: unknown) => {
    if (compareValues(value, valueToCompare)) {
      return null;
    }
    return newError("validation_values_mismatch", "Values don't match.");
  };
}

function compareValues(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) {
    return true;
  }

  const normalizedA = normalizeComparable(a);
  const normalizedB = normalizeComparable(b);

  if (normalizedA.isNil && normalizedB.isNil) {
    return true;
  }
  if (normalizedA.isNil || normalizedB.isNil) {
    return false;
  }

  return Object.is(normalizedA.value, normalizedB.value);
}

function normalizeComparable(value: unknown): { isNil: boolean; value: unknown } {
  if (value == null) {
    return { isNil: true, value: null };
  }

  if (typeof value === "object") {
    const candidate = value as { valueOf?: () => unknown };
    if (typeof candidate.valueOf === "function") {
      const unwrapped = candidate.valueOf();
      if (unwrapped !== value && isPrimitive(unwrapped)) {
        return { isNil: false, value: unwrapped };
      }
    }
  }

  return { isNil: false, value };
}

function isPrimitive(value: unknown): value is string | number | boolean | bigint {
  const type = typeof value;
  return type === "string" || type === "number" || type === "boolean" || type === "bigint";
}
