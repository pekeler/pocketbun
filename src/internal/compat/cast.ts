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
