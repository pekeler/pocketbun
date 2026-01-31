// Ported from pocketbase/tools/search/simple_field_resolver.go

import { columnify } from "../inflector/inflector.ts";
import type { FieldResolver, ResolverResult } from "./field_resolver.ts";

export type NullFallbackPreference = "auto" | "disabled" | "enforced";

export class SimpleFieldResolver implements FieldResolver {
  #allowedFields: string[];

  constructor(...allowedFields: string[]) {
    this.#allowedFields = allowedFields;
  }

  updateQuery(query: { select: string; count?: string; params: unknown[] }): {
    select: string;
    count?: string;
    params: unknown[];
  } {
    return query;
  }

  resolve(field: string): ResolverResult {
    if (this.#allowedFields.length > 0 && !matchesAllowedField(field, this.#allowedFields)) {
      throw new Error(`failed to resolve field "${field}"`);
    }

    const parts = field.split(".");
    if (parts.length === 1) {
      return {
        identifier: `[[${columnify(parts[0] ?? "")}]]`,
        nullFallback: "auto",
        params: [],
      };
    }

    const root = columnify(parts[0] ?? "");
    let jsonPath = "$";
    for (const part of parts.slice(1)) {
      if (!part) {
        continue;
      }
      if (/^\d+$/.test(part)) {
        jsonPath += `[${columnify(part)}]`;
      } else {
        jsonPath += `.${columnify(part)}`;
      }
    }

    return {
      identifier: `JSON_EXTRACT([[${root}]], '${jsonPath}')`,
      nullFallback: "disabled",
      params: [],
    };
  }
}

function matchesAllowedField(field: string, allowedFields: string[]): boolean {
  return allowedFields.some((allowed) => {
    if (allowed === field) {
      return true;
    }
    if (allowed.startsWith("^") || allowed.endsWith("$")) {
      try {
        return new RegExp(allowed).test(field);
      } catch {
        return false;
      }
    }
    return false;
  });
}
