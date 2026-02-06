// Ported from pocketbase/tools/list/list.go

import { Store } from "../store/store.ts";

const cachedPatterns = new Store<string, RegExp>();

export function subtractSlice<T>(base: T[], subtract: T[]): T[] {
  const result: T[] = [];
  for (const item of base) {
    if (!existInSlice(item, subtract)) {
      result.push(item);
    }
  }
  return result;
}

export function existInSlice<T>(item: T, list: T[]): boolean {
  for (const value of list) {
    if (value === item) {
      return true;
    }
  }
  return false;
}

export function existInSliceWithRegex(str: string, list: string[]): boolean {
  for (const field of list) {
    const isRegex = field.startsWith("^") && field.endsWith("$");

    if (!isRegex) {
      if (str === field) {
        return true;
      }
      continue;
    }

    let pattern = cachedPatterns.get(field);
    if (!pattern) {
      try {
        pattern = new RegExp(field);
      } catch {
        continue;
      }
      cachedPatterns.setIfLessThanLimit(field, pattern, 500);
    }

    if (pattern && pattern.test(str)) {
      return true;
    }
  }

  return false;
}

export function toInterfaceSlice<T>(list: T[]): unknown[] {
  const result: unknown[] = [];
  for (let i = 0; i < list.length; i += 1) {
    result.push(list[i]);
  }
  return result;
}

export function nonzeroUniques<T>(list: T[]): T[] {
  const result: T[] = [];
  const seen = new Set<T>();
  for (const value of list) {
    if (isZeroValue(value)) {
      continue;
    }
    if (seen.has(value)) {
      continue;
    }
    seen.add(value);
    result.push(value);
  }
  return result;
}

export function toUniqueStringSlice(value: unknown): string[] {
  if (value == null) {
    return [];
  }

  let result: string[] = [];

  if (Array.isArray(value)) {
    result = value.map((item) => coerceToString(item));
  } else if (typeof value === "string") {
    if (value === "") {
      return [];
    }
    if (value.includes("[")) {
      const parsed = parseJSONEncodedStringSlice(value);
      if (parsed) {
        result = parsed;
      } else {
        result = [value];
      }
    } else {
      result = [value];
    }
  } else if (typeof value === "object" && typeof (value as { MarshalJSON?: () => string }).MarshalJSON === "function") {
    try {
      const raw = (value as { MarshalJSON: () => string }).MarshalJSON();
      const parsed = parseJSONEncodedStringSlice(raw);
      if (parsed) {
        result = parsed;
      }
    } catch {
      result = [];
    }
  } else if (typeof value === "object" && typeof (value as { toJSON?: () => unknown }).toJSON === "function") {
    const raw = (value as { toJSON: () => unknown }).toJSON();
    if (Array.isArray(raw)) {
      result = raw.map((item) => coerceToString(item));
    } else if (raw != null) {
      result = [coerceToString(raw)];
    }
  } else {
    result = [coerceToString(value)];
  }

  const cleaned = result.filter((item) => item !== "");
  return nonzeroUniques(cleaned);
}

function coerceToString(value: unknown): string {
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
    try {
      return JSON.stringify(value) ?? "";
    } catch {
      return "";
    }
  }
  if (typeof value === "function") {
    return value.name ?? "";
  }
  if (typeof value === "symbol") {
    return value.description ?? "";
  }
  return "";
}

export function toChunks<T>(list: T[], chunkSize: number): T[][] {
  if (chunkSize <= 0) {
    chunkSize = 1;
  }

  const chunks: T[][] = [];
  for (let i = 0; i < list.length; i += chunkSize) {
    chunks.push(list.slice(i, i + chunkSize));
  }

  return chunks;
}

function isZeroValue(value: unknown): boolean {
  return value == null || value === "" || value === 0 || value === false || value === 0n;
}

function parseJSONEncodedStringSlice(raw: string): string[] | null {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return null;
    }
    if (parsed.some((item) => typeof item !== "string")) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
