// Ported from pocketbase/tools/search/simple_field_resolver.go

import type { FieldResolver, QueryUpdate, ResolverResult } from "./field_resolver.ts";
import { columnify } from "../inflector/inflector.ts";

export type { NullFallbackPreference } from "./field_resolver.ts";

// SimpleFieldResolver defines a generic search resolver that allows
// only its listed fields to be resolved and take part in a search query.
//
// If `allowedFields` are empty no fields filtering is applied.
export class SimpleFieldResolver implements FieldResolver {
  #allowedFields: string[];

  constructor(...allowedFields: string[]) {
    this.#allowedFields = allowedFields;
  }

  updateQuery(query: QueryUpdate): QueryUpdate {
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
