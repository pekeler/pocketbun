// Ported from pocketbase/tools/search/simple_field_resolver.go

import type { SqlExpr } from "./types.ts";

export type NullFallbackPreference = "auto" | "disabled" | "enforced";

export const NullFallbackAuto: NullFallbackPreference = "auto";
export const NullFallbackDisabled: NullFallbackPreference = "disabled";
export const NullFallbackEnforced: NullFallbackPreference = "enforced";

export type ResolverResult = {
  identifier: string;
  nullFallback: NullFallbackPreference;
  params: unknown[];
  multiMatchSubquery?: unknown;
  afterBuild?: (expr: SqlExpr) => SqlExpr;
};

export interface FieldResolver {
  resolve(field: string): ResolverResult;
}
