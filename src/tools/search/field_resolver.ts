// Ported from pocketbase/tools/search/simple_field_resolver.go

// Note: upstream FieldResolver exposes UpdateQuery and multi-match behavior.
// This port implements UpdateQuery selectively for record field resolver joins.

import type { MultiMatchSubquery } from "./multi_match_subquery.ts";
import type { SqlExpr } from "./types.ts";

export type NullFallbackPreference = "auto" | "disabled" | "enforced";

export const NullFallbackAuto: NullFallbackPreference = "auto";
export const NullFallbackDisabled: NullFallbackPreference = "disabled";
export const NullFallbackEnforced: NullFallbackPreference = "enforced";

export type ResolverResult = {
  identifier: string;
  nullFallback: NullFallbackPreference;
  params: unknown[];
  knownNonEmpty?: boolean;
  multiMatchSubquery?: MultiMatchSubquery;
  afterBuild?: (expr: SqlExpr) => SqlExpr;
};

export type QueryUpdate = {
  select: string;
  count?: string;
  params: unknown[];
};

export interface FieldResolver {
  resolve(field: string): ResolverResult;
  updateQuery?(query: QueryUpdate): QueryUpdate;
}
