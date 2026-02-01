// Ported from pocketbase/tools/picker/pick.go

import type { SearchResult } from "../search/types.ts";
import { Tokenizer } from "../tokenizer/tokenizer.ts";
import { initModifier, type Modifier } from "./modifiers.ts";
import "./excerpt_modifier.ts";

export function Pick(data: unknown, rawFields: string): unknown {
  const parsedFields = parseFields(rawFields);

  const encoded = JSON.stringify(data);
  const decoded = JSON.parse(encoded) as unknown;

  if (isSearchResultLike(data)) {
    if (decoded && typeof decoded === "object" && !Array.isArray(decoded)) {
      const err = pickParsedFields((decoded as Record<string, unknown>).items, parsedFields);
      if (err) {
        throw err;
      }
    }
  } else {
    const err = pickParsedFields(decoded, parsedFields);
    if (err) {
      throw err;
    }
  }

  return decoded;
}

function isSearchResultLike(value: unknown): value is SearchResult<unknown> {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return "items" in record && "page" in record && "perPage" in record && "totalItems" in record && "totalPages" in record;
}

function parseFields(rawFields: string): Record<string, Modifier | null> {
  const tokenizer = new Tokenizer(rawFields);
  const fields = tokenizer.scanAll();
  const result: Record<string, Modifier | null> = {};

  for (const rawField of fields) {
    const trimmed = rawField.trim();
    if (trimmed === "") {
      continue;
    }
    const parts = trimmed.split(":", 2);
    if (parts.length > 1) {
      result[parts[0] ?? ""] = initModifier(parts[1] ?? "");
    } else {
      result[parts[0] ?? ""] = null;
    }
  }

  return result;
}

function pickParsedFields(data: unknown, fields: Record<string, Modifier | null>): Error | null {
  if (Array.isArray(data)) {
    if (data.length === 0) {
      return null;
    }

    if (!isPlainObject(data[0])) {
      return null;
    }

    for (const item of data) {
      if (!isPlainObject(item)) {
        continue;
      }
      const err = pickMapFields(item, fields);
      if (err) {
        return null;
      }
    }

    return null;
  }

  if (isPlainObject(data)) {
    return pickMapFields(data, fields);
  }

  return null;
}

function pickMapFields(data: Record<string, unknown>, fields: Record<string, Modifier | null>): Error | null {
  if (Object.keys(fields).length === 0) {
    return null;
  }

  if ("*" in fields) {
    const wildcard = fields["*"] ?? null;

    for (const key of Object.keys(data)) {
      let exists = false;
      for (const field of Object.keys(fields)) {
        if (`${field}.`.startsWith(`${key}.`)) {
          exists = true;
          break;
        }
      }

      if (!exists) {
        fields[key] = wildcard;
      }
    }
  }

  for (const key of Object.keys(data)) {
    const matchingFields: Record<string, Modifier | null> = {};
    for (const [field, modifier] of Object.entries(fields)) {
      if (`${field}.`.startsWith(`${key}.`)) {
        matchingFields[field] = modifier;
      }
    }

    if (Object.keys(matchingFields).length === 0) {
      delete data[key];
      continue;
    }

    let skipRecursive = false;
    for (const [field, modifier] of Object.entries(matchingFields)) {
      let remains = `${field}.`;
      if (remains.startsWith(`${key}.`)) {
        remains = remains.slice(key.length + 1);
      }
      if (remains.endsWith(".")) {
        remains = remains.slice(0, -1);
      }

      if (remains === "") {
        if (modifier) {
          try {
            data[key] = modifier.Modify(data[key]);
          } catch (error) {
            return error as Error;
          }
        }
        skipRecursive = true;
        break;
      }

      delete matchingFields[field];
      matchingFields[remains] = modifier;
    }

    if (skipRecursive) {
      continue;
    }

    const err = pickParsedFields(data[key], matchingFields);
    if (err) {
      return err;
    }
  }

  return null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
