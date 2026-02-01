// Ported from pocketbase/tools/search/sort.go

import type { FieldResolver } from "./field_resolver.ts";

const randomSortKey = "@random";
const rowidSortKey = "@rowid";

export const SortAsc = "ASC";
export const SortDesc = "DESC";

export type SortField = {
  name: string;
  direction: string;
};

export function buildSortExpr(field: SortField, resolver: FieldResolver): string {
  if (field.name === randomSortKey) {
    return "RANDOM()";
  }

  if (field.name === rowidSortKey) {
    return `[[_rowid_]] ${field.direction}`;
  }

  const result = resolver.resolve(field.name);
  if (!result.identifier || result.params.length > 0 || result.identifier.toLowerCase() === "null") {
    throw new Error(`invalid sort field "${field.name}"`);
  }

  return `${result.identifier} ${field.direction}`;
}

export function parseSortFromString(value: string): SortField[] {
  return value
    .split(",")
    .map((field) => field.trim())
    .map((field) => {
      if (field.startsWith("-")) {
        return { name: field.slice(1), direction: SortDesc };
      }
      if (field.startsWith("+")) {
        return { name: field.slice(1), direction: SortAsc };
      }
      return { name: field, direction: SortAsc };
    });
}
