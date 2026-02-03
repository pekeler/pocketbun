// Ported from pocketbase/core/record_field_resolver.go

// Note: this is a partial port; advanced rule modifiers and multi-match join optimizations
// are implemented incrementally as related APIs are brought online.

import type { FieldResolver, QueryUpdate, ResolverResult } from "../tools/search/field_resolver.ts";
import type { Join } from "../tools/search/multi_match_subquery.ts";
import type { App } from "./app.ts";
import type { Collection } from "./collection_model.ts";
import type { RequestInfo } from "./event_request.ts";
import { buildFilterExpr } from "../tools/search/filter.ts";
import { DefaultFilterExprLimit } from "../tools/search/types.ts";
import { randomString } from "../tools/security/random.ts";

// RecordFieldResolver defines a custom search resolver struct for
// managing Record model search fields.
//
// Usually used together with `search.Provider`.
// Example:
//
//	resolver := resolvers.NewRecordFieldResolver(
//	    app,
//	    myCollection,
//	    &models.RequestInfo{...},
//	    true,
//	)
//	provider := search.NewProvider(resolver)
//	...
export class RecordFieldResolver implements FieldResolver {
  app: App;
  baseCollection: Collection;
  requestInfo: RequestInfo | null;
  staticRequestInfo: Record<string, unknown>;
  allowedFields: string[];
  allowHiddenFields: boolean;
  joins: Join[];
  listRuleJoins: Map<string, Collection> | null;
  joinAliasSuffix: string;
  baseCollectionAlias: string;

  constructor(app: App, baseCollection: Collection, requestInfo: RequestInfo | null, allowHiddenFields: boolean) {
    this.app = app;
    this.baseCollection = baseCollection;
    this.requestInfo = requestInfo;
    this.allowHiddenFields = allowHiddenFields;
    this.joins = [];
    this.listRuleJoins = null;
    this.joinAliasSuffix = "";
    this.baseCollectionAlias = "";
    this.allowedFields = [
      "^\\w+[\\w\\.\\:]*$",
      "^\\@request\\.context$",
      "^\\@request\\.method$",
      "^\\@request\\.auth\\.[\\w\\.\\:]*\\w+$",
      "^\\@request\\.body\\.[\\w\\.\\:]*\\w+$",
      "^\\@request\\.query\\.[\\w\\.\\:]*\\w+$",
      "^\\@request\\.headers\\.[\\w\\.\\:]*\\w+$",
      "^\\@collection\\.\\w+(\\:\\w+)?\\.[\\w\\.\\:]*\\w+$",
    ];

    this.staticRequestInfo = {};
    if (this.requestInfo) {
      this.staticRequestInfo.context = this.requestInfo.context;
      this.staticRequestInfo.method = this.requestInfo.method;
      this.staticRequestInfo.query = this.requestInfo.query;
      this.staticRequestInfo.headers = this.requestInfo.headers;
      this.staticRequestInfo.body = this.requestInfo.body;
      this.staticRequestInfo.auth = null;
      if (this.requestInfo.auth) {
        this.staticRequestInfo.auth = this.requestInfo.auth.export({
          includeHidden: true,
          ignoreEmailVisibility: true,
        });
      }
    }
  }

  setAllowedFields(newAllowedFields: string[]): void {
    this.allowedFields = [...newAllowedFields];
  }

  setAllowHiddenFields(allowHiddenFields: boolean): void {
    this.allowHiddenFields = allowHiddenFields;
  }

  resolve(fieldName: string): ResolverResult {
    return parseAndRun(fieldName, this);
  }

  updateQuery(query: QueryUpdate): QueryUpdate {
    let selectSql = query.select;
    let countSql = query.count ?? "";
    const baseParams = query.params ?? [];

    let joinMap = new Map<string, Join>();
    for (const join of this.joins) {
      joinMap.set(join.tableAlias, join);
    }

    const listRuleParams: unknown[] = [];

    if (this.listRuleJoins && this.listRuleJoins.size > 0) {
      for (const [alias, collection] of this.listRuleJoins.entries()) {
        if (!collection.listRule || collection.listRule === "") {
          continue;
        }

        const clone = new RecordFieldResolver(this.app, collection, this.requestInfo, true);
        clone.baseCollectionAlias = alias;
        clone.joinAliasSuffix = randomString(8);

        const expr = buildFilterExpr(collection.listRule, clone, DefaultFilterExprLimit);
        if (expr.sql) {
          selectSql = appendWhere(selectSql, expr.sql);
          if (countSql) {
            countSql = appendWhere(countSql, expr.sql);
          }
          listRuleParams.push(...expr.params);
        }

        for (const join of clone.joins) {
          joinMap.set(join.tableAlias, join);
        }
      }
    }

    const joinList = Array.from(joinMap.values());
    const joinParams = collectJoinParams(joinList);

    if (joinList.length > 0) {
      selectSql = ensureDistinct(selectSql);
      selectSql = injectJoins(selectSql, joinList);
      if (countSql) {
        countSql = injectJoins(countSql, joinList);
      }
    }

    return {
      select: selectSql,
      count: countSql || undefined,
      params: [...joinParams, ...baseParams, ...listRuleParams],
    };
  }

  resolveStaticRequestField(...path: string[]): ResolverResult {
    if (path.length === 0) {
      throw new Error("at least one path key should be provided");
    }

    const last = path[path.length - 1] ?? "";
    const [lastProp, modifier] = splitModifier(last);
    path[path.length - 1] = lastProp;

    let resultVal: unknown = null;
    let extractErr: Error | null = null;

    try {
      resultVal = extractNestedVal(this.staticRequestInfo, ...path);
    } catch (error) {
      extractErr = error as Error;
    }

    if (modifier === issetModifier) {
      if (extractErr) {
        return { identifier: "FALSE", params: [], nullFallback: "auto" };
      }
      return { identifier: "TRUE", params: [], nullFallback: "auto" };
    }

    if (typeof resultVal === "string") {
      const field = getCollectionField(this.baseCollection, path[path.length - 1] ?? "");
      if (field?.type === FieldTypeNumber) {
        const parsed = Number.parseFloat(resultVal);
        if (Number.isFinite(parsed)) {
          resultVal = parsed;
        }
      }
    } else if (typeof resultVal !== "number" && typeof resultVal !== "boolean" && resultVal !== null) {
      try {
        resultVal = JSON.stringify(resultVal);
      } catch {
        resultVal = String(resultVal);
      }
    }

    if (modifier !== "" && modifier !== lowerModifier) {
      throw new Error(`invalid modifier sequence ${lastProp}:${modifier}`);
    }

    if (resultVal === null || resultVal === undefined) {
      return { identifier: "NULL", params: [], nullFallback: "auto" };
    }

    if (modifier === lowerModifier) {
      return { identifier: "LOWER(?)", params: [resultVal], nullFallback: "auto" };
    }

    return { identifier: "?", params: [resultVal], nullFallback: "auto" };
  }

  loadCollection(collectionNameOrId: string): Collection | null {
    if (collectionNameOrId === this.baseCollection.name || collectionNameOrId === this.baseCollection.id) {
      return this.baseCollection;
    }
    return this.app.findCollectionByNameOrId(collectionNameOrId);
  }

  registerJoin(
    tableName: string,
    tableAlias: string,
    on?: { sql: string; params: unknown[] } | null,
    params: unknown[] = [],
  ): void {
    const join: Join = {
      tableName,
      tableAlias,
      on: on ?? undefined,
      params,
    };

    if (!this.allowHiddenFields) {
      const collection = this.loadCollection(tableName);
      if (collection) {
        if (collection.listRule === null) {
          throw new Error(
            `"${collection.name}" fields can be accessed only when allowHiddenFields is enabled or by superusers`,
          );
        }
        if (!this.listRuleJoins) {
          this.listRuleJoins = new Map();
        }
        this.listRuleJoins.set(tableAlias, collection);
      }
    }

    const index = this.joins.findIndex((existing) => existing.tableAlias === tableAlias);
    if (index >= 0) {
      this.joins[index] = join;
    } else {
      this.joins.push(join);
    }
  }
}
// parseAndRun and helpers are implemented in record_field_resolver_runner.ts.
import {
  extractNestedVal,
  getCollectionField,
  parseAndRun,
  splitModifier,
  issetModifier,
  lowerModifier,
} from "./record_field_resolver_runner.ts";
export { extractNestedVal, getCollectionField, parseAndRun, splitModifier, issetModifier, lowerModifier };

export const FieldTypeNumber = "number";

function collectJoinParams(joins: Join[]): unknown[] {
  const params: unknown[] = [];
  for (const join of joins) {
    if (join.params && join.params.length > 0) {
      params.push(...join.params);
    }
    if (join.on?.params && join.on.params.length > 0) {
      params.push(...join.on.params);
    }
  }
  return params;
}

function injectJoins(sql: string, joins: Join[]): string {
  if (joins.length === 0) {
    return sql;
  }

  const lower = sql.toLowerCase();
  const fromIndex = lower.indexOf(" from ");
  if (fromIndex === -1) {
    return sql;
  }

  let insertAt = sql.length;
  const keywords = [" where ", " order by ", " group by ", " having ", " limit "];
  for (const keyword of keywords) {
    const idx = lower.indexOf(keyword, fromIndex + 6);
    if (idx >= 0 && idx < insertAt) {
      insertAt = idx;
    }
  }

  const joinSql = joins.map((join) => buildJoinSql(join)).join(" ");
  return `${sql.slice(0, insertAt)} ${joinSql}${sql.slice(insertAt)}`;
}

function buildJoinSql(join: Join): string {
  const tableSql = quoteTableName(join.tableName);
  const aliasSql = join.tableAlias ? ` {{${join.tableAlias}}}` : "";
  const onSql = join.on?.sql ? ` ON ${join.on.sql}` : "";
  return `LEFT JOIN ${tableSql}${aliasSql}${onSql}`;
}

function quoteTableName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    return trimmed;
  }
  if (trimmed.includes("(") || /\s/.test(trimmed) || trimmed.includes("{{") || trimmed.includes("[[")) {
    return trimmed;
  }
  return `{{${trimmed}}}`;
}

function ensureDistinct(sql: string): string {
  const normalized = sql.trimStart();
  if (normalized.toLowerCase().startsWith("select distinct")) {
    return sql;
  }
  if (normalized.toLowerCase().startsWith("select ")) {
    return sql.replace(/select\s+/i, "select distinct ");
  }
  return sql;
}

function appendWhere(baseSql: string, clause: string): string {
  if (!clause) {
    return baseSql;
  }
  if (/\bwhere\b/i.test(baseSql)) {
    return `${baseSql} AND ${clause}`;
  }
  return `${baseSql} WHERE ${clause}`;
}
