// PocketBun-only: minimal casting helpers aligned with PocketBase usage.

export function toStringValue(value: unknown): string {
  if (value == null) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "object") {
    const candidate = value as { valueOf?: () => unknown; toString?: () => string };
    if (typeof candidate.valueOf === "function") {
      const raw = candidate.valueOf();
      if (
        typeof raw === "string" ||
        typeof raw === "number" ||
        typeof raw === "boolean" ||
        typeof raw === "bigint"
      ) {
        return String(raw);
      }
    }
    if (typeof candidate.toString === "function") {
      const str = candidate.toString();
      if (str && str !== "[object Object]") {
        return str;
      }
    }
  }
  return "";
}

export function toBoolValue(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  if (typeof value === "bigint") {
    return value !== 0n;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "t", "true", "y", "yes", "on"].includes(normalized)) {
      return true;
    }
    if (["0", "f", "false", "n", "no", "off", ""].includes(normalized)) {
      return false;
    }
  }
  return Boolean(value);
}

export function toNumberValue(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "bigint") {
    return Number(value);
  }
  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return 0;
    }
    const lowered = trimmed.toLowerCase();
    if (lowered === "nan") {
      return Number.NaN;
    }
    if (
      lowered === "inf" ||
      lowered === "+inf" ||
      lowered === "infinity" ||
      lowered === "+infinity"
    ) {
      return Number.POSITIVE_INFINITY;
    }
    if (lowered === "-inf" || lowered === "-infinity") {
      return Number.NEGATIVE_INFINITY;
    }
    const num = Number(trimmed);
    return Number.isNaN(num) ? 0 : num;
  }
  if (value instanceof Date) {
    return value.getTime();
  }
  return 0;
}
