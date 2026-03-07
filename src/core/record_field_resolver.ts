// Ported from pocketbase/core/record_field_resolver.go

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
      // PocketBun perf deviation (behavior-compatible): avoid forcing
      // request query/headers extraction when rules don't access them.
      Object.defineProperty(this.staticRequestInfo, "query", {
        enumerable: true,
        configurable: true,
        get: () => this.requestInfo?.query ?? {},
      });
      Object.defineProperty(this.staticRequestInfo, "headers", {
        enumerable: true,
        configurable: true,
        get: () => this.requestInfo?.headers ?? {},
      });
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

  AllowedFields(): string[] {
    return [...this.allowedFields];
  }

  SetAllowedFields(newAllowedFields: string[]): void {
    this.allowedFields = [...newAllowedFields];
  }

  setAllowedFields(newAllowedFields: string[]): void {
    this.SetAllowedFields(newAllowedFields);
  }

  AllowHiddenFields(): boolean {
    return this.allowHiddenFields;
  }

  SetAllowHiddenFields(allowHiddenFields: boolean): void {
    this.allowHiddenFields = allowHiddenFields;
  }

  setAllowHiddenFields(allowHiddenFields: boolean): void {
    this.SetAllowHiddenFields(allowHiddenFields);
  }

  Resolve(fieldName: string): ResolverResult {
    return this.resolve(fieldName);
  }

  resolve(fieldName: string): ResolverResult {
    return parseAndRun(fieldName, this);
  }

  UpdateQuery(query: QueryUpdate): QueryUpdate {
    return this.updateQuery(query);
  }

  updateQuery(query: QueryUpdate): QueryUpdate {
    let selectSql = query.select;
    let countSql = query.count ?? "";
    const baseParams = query.params ?? [];
    const hasDirectJoins = this.joins.length > 0;
    const hasListRuleJoins = Boolean(this.listRuleJoins && this.listRuleJoins.size > 0);

    // PocketBun perf deviation (behavior-compatible): common list routes have no dynamic joins,
    // so skip join-map setup and param reassembly in that hot path.
    if (!hasDirectJoins && !hasListRuleJoins) {
      selectSql = normalizeSelectCase(selectSql);
      if (countSql) {
        countSql = normalizeSelectCase(countSql);
      }

      return {
        select: selectSql,
        count: countSql || undefined,
        params: baseParams,
      };
    }

    let joinMap: Map<string, Join> | null = null;
    if (hasDirectJoins) {
      joinMap = new Map<string, Join>();
      for (const join of this.joins) {
        joinMap.set(join.tableAlias, join);
      }
    }

    const listRuleParams: unknown[] = [];

    if (hasListRuleJoins && this.listRuleJoins) {
      for (const [alias, collection] of this.listRuleJoins.entries()) {
        if (!collection.listRule || collection.listRule === "") {
          continue;
        }

        const clone = new RecordFieldResolver(this.app, collection, this.requestInfo, true);
        clone.baseCollectionAlias = alias;
        clone.joinAliasSuffix = randomString(8);

        const expr = buildFilterExpr(`id='' || (\n${collection.listRule}\n)`, clone, DefaultFilterExprLimit);
        if (expr.sql) {
          const wrappedRule = `(${expr.sql})`;
          selectSql = appendWhere(selectSql, wrappedRule);
          if (countSql) {
            countSql = appendWhere(countSql, wrappedRule);
          }
          listRuleParams.push(...expr.params);
        }

        if (clone.joins.length > 0) {
          if (!joinMap) {
            joinMap = new Map<string, Join>();
          }
          for (const join of clone.joins) {
            joinMap.set(join.tableAlias, join);
          }
        }
      }
    }

    const joinList = joinMap ? Array.from(joinMap.values()) : [];
    let params = baseParams;

    if (joinList.length > 0) {
      const joinParams = collectJoinParams(joinList);
      if (joinParams.length > 0) {
        params = [...joinParams, ...params];
      }

      selectSql = ensureDistinct(selectSql);
      selectSql = injectJoins(selectSql, joinList);
      if (countSql) {
        countSql = injectJoins(countSql, joinList);
      }
    }

    if (listRuleParams.length > 0) {
      params = [...params, ...listRuleParams];
    }

    selectSql = normalizeSelectCase(selectSql);
    if (countSql) {
      countSql = normalizeSelectCase(countSql);
    }

    return {
      select: selectSql,
      count: countSql || undefined,
      params,
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
      const placeholder = `t${randomString(8)}`;
      return { identifier: `LOWER({:${placeholder}})`, params: [resultVal], nullFallback: "auto" };
    }

    const placeholder = `t${randomString(8)}`;
    return { identifier: `{:${placeholder}}`, params: [resultVal], nullFallback: "auto" };
  }

  loadCollection(collectionNameOrId: string): Collection | null {
    if (collectionNameOrId === this.baseCollection.name || collectionNameOrId === this.baseCollection.id) {
      return this.baseCollection;
    }
    try {
      return this.app.FindCachedCollectionByNameOrId(collectionNameOrId);
    } catch {
      return null;
    }
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

function normalizeSelectCase(sql: string): string {
  const trimmed = sql.trimStart();
  const offset = sql.length - trimmed.length;
  const lower = trimmed.toLowerCase();
  let normalized = sql;
  if (lower.startsWith("select distinct")) {
    normalized = `${sql.slice(0, offset)}SELECT DISTINCT${trimmed.slice("select distinct".length)}`;
  } else if (lower.startsWith("select")) {
    normalized = `${sql.slice(0, offset)}SELECT${trimmed.slice("select".length)}`;
  }
  return normalized.replace(/\sfrom\s/i, " FROM ");
}

function appendWhere(baseSql: string, clause: string): string {
  if (!clause) {
    return baseSql;
  }
  if (/\bwhere\b/i.test(baseSql)) {
    const lower = baseSql.toLowerCase();
    const whereIndex = lower.indexOf(" where ");
    if (whereIndex === -1) {
      return `${baseSql} AND ${clause}`;
    }
    const whereStart = whereIndex + " where ".length;
    let whereEnd = baseSql.length;
    const keywords = [" order by ", " group by ", " having ", " limit "];
    for (const keyword of keywords) {
      const idx = lower.indexOf(keyword, whereStart);
      if (idx >= 0 && idx < whereEnd) {
        whereEnd = idx;
      }
    }
    const head = baseSql.slice(0, whereIndex);
    const whereClause = baseSql.slice(whereStart, whereEnd).trim();
    const tail = baseSql.slice(whereEnd);
    return `${head} WHERE (${whereClause} AND ${clause})${tail}`;
  }
  return `${baseSql} WHERE ${clause}`;
}
