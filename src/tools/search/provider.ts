// Ported from pocketbase/tools/search/provider.go

// Note: upstream Provider calls FieldResolver.UpdateQuery to apply joins/aliases.
// This port uses UpdateQuery to inject joins into raw SQL strings.

import type { Database, SQLQueryBindings } from "bun:sqlite";
import type { FieldResolver } from "./field_resolver.ts";
import { columnify } from "../inflector/inflector.ts";
import { profileEnabled, recordProfile } from "../perf/profile.ts";
import { buildFilterExpr, type FilterData } from "./filter.ts";
import { buildSortExpr, parseSortFromString, type SortField } from "./sort.ts";
import {
  DefaultFilterExprLimit,
  DefaultPerPage,
  DefaultSortExprLimit,
  ErrEmptyQuery,
  ErrFilterLengthLimit,
  ErrSortExprLimit,
  ErrSortFieldLengthLimit,
  FilterQueryParam,
  MaxFilterLength,
  MaxPerPage,
  MaxSortFieldLength,
  PageQueryParam,
  PerPageQueryParam,
  SkipTotalQueryParam,
  SortQueryParam,
  type SearchQuery,
  type SearchResult,
} from "./types.ts";

// Provider represents a single configured search provider instance.
export class Provider {
  #fieldResolver: FieldResolver;
  #query: SearchQuery | null = null;
  #countCol = "id";
  #sort: SortField[] = [];
  #filter: FilterData[] = [];
  #page = 1;
  #perPage = DefaultPerPage;
  #skipTotal = false;
  #maxFilterExprLimit = DefaultFilterExprLimit;
  #maxSortExprLimit = DefaultSortExprLimit;
  #profilePrefix: string | null = null;

  constructor(fieldResolver: FieldResolver) {
    this.#fieldResolver = fieldResolver;
  }

  maxFilterExprLimit(max: number): this {
    this.#maxFilterExprLimit = max;
    return this;
  }

  maxSortExprLimit(max: number): this {
    this.#maxSortExprLimit = max;
    return this;
  }

  profilePrefix(prefix: string | null): this {
    this.#profilePrefix = prefix;
    return this;
  }

  query(query: SearchQuery): this {
    this.#query = query;
    return this;
  }

  skipTotal(skipTotal: boolean): this {
    this.#skipTotal = skipTotal;
    return this;
  }

  countCol(name: string): this {
    this.#countCol = name;
    return this;
  }

  page(page: number): this {
    this.#page = page;
    return this;
  }

  perPage(perPage: number): this {
    this.#perPage = perPage;
    return this;
  }

  sort(sort: SortField[]): this {
    this.#sort = sort;
    return this;
  }

  addSort(field: SortField): this {
    this.#sort.push(field);
    return this;
  }

  filter(filter: FilterData[]): this {
    this.#filter = filter;
    return this;
  }

  addFilter(filter: FilterData): this {
    if (filter !== "") {
      this.#filter.push(filter);
    }
    return this;
  }

  parse(urlQuery: string): this {
    return this.parseParams(new URLSearchParams(urlQuery), urlQuery);
  }

  parseParams(params: URLSearchParams, rawQuery?: string): this {
    if ((rawQuery ?? params.toString()).includes(";")) {
      throw new Error("invalid query");
    }

    const skipTotalRaw = params.get(SkipTotalQueryParam);
    if (skipTotalRaw) {
      this.skipTotal(parseBool(skipTotalRaw));
    }

    const pageRaw = params.get(PageQueryParam);
    if (pageRaw) {
      const parsed = Number.parseInt(pageRaw, 10);
      if (!Number.isFinite(parsed)) {
        throw new Error("invalid page value");
      }
      this.page(parsed);
    }

    const perPageRaw = params.get(PerPageQueryParam);
    if (perPageRaw) {
      const parsed = Number.parseInt(perPageRaw, 10);
      if (!Number.isFinite(parsed)) {
        throw new Error("invalid perPage value");
      }
      this.perPage(parsed);
    }

    const sortRaw = params.get(SortQueryParam);
    if (sortRaw) {
      for (const sortField of parseSortFromString(sortRaw)) {
        this.addSort(sortField);
      }
    }

    const filterRaw = params.get(FilterQueryParam);
    if (filterRaw) {
      this.addFilter(filterRaw);
    }

    return this;
  }

  exec<T>(db: Database): SearchResult<T> {
    if (!this.#query) {
      throw ErrEmptyQuery;
    }
    const profilePrefix = this.#profilePrefix;
    const doProfile = Boolean(profilePrefix) && profileEnabled();

    const baseParams = (this.#query.params ?? []) as SQLQueryBindings[];
    let selectSql = this.#query.select;
    // PocketBun perf deviation (behavior-compatible): when skipTotal is enabled, avoid count SQL
    // setup and rewrite work entirely on the list hot path.
    let countSql = this.#skipTotal ? "" : (this.#query.count ?? "");
    let params = baseParams;

    if (this.#filter.length > 0) {
      let filterParts: string[] | null = null;
      let filterParams: SQLQueryBindings[] | null = null;

      for (const filter of this.#filter) {
        if (filter.length > MaxFilterLength) {
          throw ErrFilterLengthLimit;
        }
        const expr = buildFilterExpr(filter, this.#fieldResolver, this.#maxFilterExprLimit);
        if (expr.sql) {
          filterParts ??= [];
          filterParts.push(`(${expr.sql})`);
          if (expr.params.length > 0) {
            filterParams ??= [];
            filterParams.push(...(expr.params as SQLQueryBindings[]));
          }
        }
      }

      if (filterParts && filterParts.length > 0) {
        const where = filterParts.join(" AND ");
        selectSql = appendWhere(selectSql, where);
        if (!this.#skipTotal && countSql) {
          countSql = appendWhere(countSql, where);
        }
      }

      if (filterParams && filterParams.length > 0) {
        params = [...params, ...filterParams];
      }
    }

    if (this.#sort.length > this.#maxSortExprLimit) {
      throw ErrSortExprLimit;
    }

    let sortParts: string[] | null = null;
    if (this.#sort.length > 0) {
      for (const sortField of this.#sort) {
        if (sortField.name.length > MaxSortFieldLength) {
          throw ErrSortFieldLengthLimit;
        }
        let expr = buildSortExpr(sortField, this.#fieldResolver);
        if (sortField.name === "@rowid" && !expr.includes(".")) {
          expr = prefixRowidExpr(expr, selectSql);
        }
        if (expr) {
          sortParts ??= [];
          sortParts.push(expr);
        }
      }
    }

    if (sortParts && sortParts.length > 0) {
      selectSql = appendOrderBy(selectSql, sortParts.join(", "));
    }

    if (this.#fieldResolver.updateQuery) {
      const updated = this.#fieldResolver.updateQuery({
        select: selectSql,
        count: countSql || undefined,
        params,
      });
      selectSql = updated.select;
      countSql = updated.count ?? "";
      params = (updated.params ?? params) as SQLQueryBindings[];
    }

    if (this.#page <= 0) {
      this.#page = 1;
    }

    if (this.#perPage <= 0) {
      this.#perPage = DefaultPerPage;
    } else if (this.#perPage > MaxPerPage) {
      this.#perPage = MaxPerPage;
    }

    const limit = this.#perPage;
    const offset = this.#perPage * (this.#page - 1);
    let pagedSql = `${selectSql} LIMIT ${limit}`;
    if (offset > 0) {
      pagedSql += ` OFFSET ${offset}`;
    }

    if (this.#skipTotal) {
      let items: T[];
      if (doProfile) {
        const itemsStart = performance.now();
        try {
          items = db.query(pagedSql).all(...params) as T[];
        } finally {
          recordProfile(`${profilePrefix}.db.items`, performance.now() - itemsStart);
        }
      } else {
        items = db.query(pagedSql).all(...params) as T[];
      }
      return {
        items,
        page: this.#page,
        perPage: this.#perPage,
        totalItems: -1,
        totalPages: -1,
      };
    }

    if (!countSql) {
      countSql = buildCountQuery(selectSql, this.#countCol);
    }

    let countRow: Record<string, unknown> | undefined;
    if (doProfile) {
      const countStart = performance.now();
      try {
        countRow = db.query(countSql).get(...params) as Record<string, unknown> | undefined;
      } finally {
        recordProfile(`${profilePrefix}.db.count`, performance.now() - countStart);
      }
    } else {
      countRow = db.query(countSql).get(...params) as Record<string, unknown> | undefined;
    }
    let totalItems = 0;
    if (countRow) {
      if ("total" in countRow) {
        totalItems = Number(countRow.total ?? 0);
      } else {
        for (const key in countRow) {
          if (Object.prototype.hasOwnProperty.call(countRow, key)) {
            totalItems = Number(countRow[key] ?? 0);
            break;
          }
        }
      }
    }
    const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / this.#perPage);

    let items: T[];
    if (doProfile) {
      const itemsStart = performance.now();
      try {
        items = db.query(pagedSql).all(...params) as T[];
      } finally {
        recordProfile(`${profilePrefix}.db.items`, performance.now() - itemsStart);
      }
    } else {
      items = db.query(pagedSql).all(...params) as T[];
    }

    return {
      items,
      page: this.#page,
      perPage: this.#perPage,
      totalItems,
      totalPages,
    };
  }

  parseAndExec<T>(urlQuery: string, db: Database): SearchResult<T> {
    this.parse(urlQuery);
    return this.exec<T>(db);
  }

  parseAndExecParams<T>(params: URLSearchParams, db: Database, rawQuery?: string): SearchResult<T> {
    this.parseParams(params, rawQuery);
    return this.exec<T>(db);
  }
}

function parseBool(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  switch (normalized) {
    case "1":
    case "t":
    case "true":
    case "y":
    case "yes":
    case "on":
      return true;
    case "0":
    case "f":
    case "false":
    case "n":
    case "no":
    case "off":
      return false;
  }
  throw new Error("invalid boolean value");
}

function appendWhere(baseSql: string, clause: string): string {
  if (!clause) {
    return baseSql;
  }
  const { head, tail } = splitSqlTail(baseSql);
  if (/\bwhere\b/i.test(head)) {
    return `${head} AND ${clause}${tail}`;
  }
  return `${head} WHERE ${clause}${tail}`;
}

function appendOrderBy(baseSql: string, clause: string): string {
  if (!clause) {
    return baseSql;
  }
  const orderMatch = /\border\s+by\b/i.exec(baseSql);
  if (!orderMatch) {
    const { head, tail } = splitSqlTail(baseSql);
    return `${head} ORDER BY ${clause}${tail}`;
  }

  const orderIndex = orderMatch.index;
  const before = baseSql.slice(0, orderIndex).trimEnd();
  const after = baseSql.slice(orderIndex).trimStart();

  const limitMatch = /\blimit\b|\boffset\b/i.exec(after);
  const orderSection = limitMatch ? after.slice(0, limitMatch.index).trimEnd() : after;
  const tail = limitMatch ? after.slice(limitMatch.index).trimStart() : "";

  const existingClause = orderSection.replace(/\border\s+by\b/i, "").trim();
  const combined = existingClause ? `${existingClause}, ${clause}` : clause;
  const tailSuffix = tail ? ` ${tail}` : "";

  return `${before} ORDER BY ${combined}${tailSuffix}`;
}

function splitSqlTail(baseSql: string): { head: string; tail: string } {
  const match = /\border\s+by\b|\blimit\b|\boffset\b/i.exec(baseSql);
  if (!match) {
    return { head: baseSql, tail: "" };
  }
  const index = match.index;
  const head = baseSql.slice(0, index).trimEnd();
  const tail = baseSql.slice(index).trimStart();
  return { head, tail: tail ? ` ${tail}` : "" };
}

function prefixRowidExpr(expr: string, selectSql: string): string {
  if (expr.includes(".")) {
    return expr;
  }
  const from = extractFromAlias(selectSql);
  if (!from) {
    return expr;
  }
  const prefix = columnify(from);
  return expr.replace("[[_rowid_]]", `[[${prefix}]].[[_rowid_]]`);
}

function buildCountQuery(selectSql: string, countCol: string): string {
  const { head } = splitSqlTail(selectSql);
  const fromMatch = /\bfrom\b/i.exec(head);
  if (!fromMatch) {
    return `SELECT COUNT(*) FROM (${selectSql})`;
  }

  const fromClause = head.slice(fromMatch.index);
  const target = columnify(countCol);
  if (!target) {
    return `SELECT COUNT(*) ${fromClause}`;
  }

  const fromAlias = extractFromAlias(head);
  const qualified = fromAlias && !target.includes(".") ? `${fromAlias}.${target}` : target;

  return `SELECT COUNT(DISTINCT [[${qualified}]]) ${fromClause}`;
}

function extractFromAlias(sql: string): string | null {
  const match = /\bfrom\s+([^\s,]+)(?:\s+(?:as\s+)?([^\s,]+))?/i.exec(sql);
  if (!match) {
    return null;
  }
  let candidate = match[2] ?? match[1] ?? "";
  const trimmed = candidate.trim();
  if (!trimmed || trimmed.startsWith("(")) {
    return null;
  }
  const lowered = trimmed.toLowerCase();
  if (isSqlKeyword(lowered)) {
    const fallback = match[1]?.trim() ?? "";
    if (!fallback || fallback.startsWith("(")) {
      return null;
    }
    return stripIdentifierQuotes(fallback);
  }
  return stripIdentifierQuotes(trimmed);
}

function stripIdentifierQuotes(value: string): string {
  if (value.startsWith("{{") && value.endsWith("}}")) {
    return value.slice(2, -2);
  }
  if (value.startsWith("[[") && value.endsWith("]]")) {
    return value.slice(2, -2);
  }
  if (value.startsWith("[") && value.endsWith("]")) {
    return value.slice(1, -1);
  }
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("`") && value.endsWith("`"))) {
    return value.slice(1, -1);
  }
  return value;
}

function isSqlKeyword(value: string): boolean {
  switch (value) {
    case "where":
    case "join":
    case "left":
    case "right":
    case "inner":
    case "outer":
    case "cross":
    case "group":
    case "order":
    case "limit":
    case "offset":
    case "having":
    case "union":
      return true;
    default:
      return false;
  }
}
