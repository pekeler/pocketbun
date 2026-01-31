// Ported from pocketbase/tools/search/provider.go

// Note: upstream Provider calls FieldResolver.UpdateQuery to apply joins/aliases.
// This port uses UpdateQuery to inject joins into raw SQL strings.

import type { Database, SQLQueryBindings } from "bun:sqlite";
import { columnify } from "../inflector/inflector.ts";
import { buildFilterExpr, type FilterData } from "./filter.ts";
import type { FieldResolver } from "./field_resolver.ts";
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
    const params = new URLSearchParams(urlQuery);

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

    const baseParams = this.#query.params ?? [];
    let selectSql = this.#query.select;
    let countSql = this.#query.count ?? "";

    const filterParts: string[] = [];
    const filterParams: unknown[] = [];
    for (const filter of this.#filter) {
      if (filter.length > MaxFilterLength) {
        throw ErrFilterLengthLimit;
      }
      const expr = buildFilterExpr(filter, this.#fieldResolver, this.#maxFilterExprLimit);
      if (expr.sql) {
        filterParts.push(`(${expr.sql})`);
        filterParams.push(...expr.params);
      }
    }

    if (filterParts.length > 0) {
      const where = filterParts.join(" AND ");
      selectSql = appendWhere(selectSql, where);
      if (countSql) {
        countSql = appendWhere(countSql, where);
      }
    }

    if (this.#sort.length > this.#maxSortExprLimit) {
      throw ErrSortExprLimit;
    }

    const sortParts: string[] = [];
    for (const sortField of this.#sort) {
      if (sortField.name.length > MaxSortFieldLength) {
        throw ErrSortFieldLengthLimit;
      }
      let expr = buildSortExpr(sortField, this.#fieldResolver);
      if (sortField.name === "@rowid" && !expr.includes(".")) {
        expr = prefixRowidExpr(expr, selectSql);
      }
      if (expr) {
        sortParts.push(expr);
      }
    }

    if (sortParts.length > 0) {
      selectSql = appendOrderBy(selectSql, sortParts.join(", "));
    }

    let baseParamsWithFilter = [...baseParams, ...filterParams] as SQLQueryBindings[];

    if (this.#fieldResolver.updateQuery) {
      const updated = this.#fieldResolver.updateQuery({
        select: selectSql,
        count: countSql || undefined,
        params: baseParamsWithFilter,
      });
      selectSql = updated.select;
      countSql = updated.count ?? "";
      baseParamsWithFilter = updated.params as SQLQueryBindings[];
    }

    if (!countSql) {
      countSql = buildCountQuery(selectSql, this.#countCol);
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

    const items = db
      .query(`${selectSql} limit ? offset ?`)
      .all(...([...baseParamsWithFilter, limit, offset] as SQLQueryBindings[])) as T[];

    if (this.#skipTotal) {
      return {
        items,
        page: this.#page,
        perPage: this.#perPage,
        totalItems: -1,
        totalPages: -1,
      };
    }

    const countRow = db.query(countSql).get(...baseParamsWithFilter) as
      | { total?: number }
      | undefined;

    const totalItems = countRow?.total ?? 0;
    const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / this.#perPage);

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
}

function parseBool(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (["1", "t", "true", "y", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "f", "false", "n", "no", "off"].includes(normalized)) {
    return false;
  }
  throw new Error("invalid boolean value");
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

function appendOrderBy(baseSql: string, clause: string): string {
  if (!clause) {
    return baseSql;
  }
  if (/\border\s+by\b/i.test(baseSql)) {
    return `${baseSql}, ${clause}`;
  }
  return `${baseSql} ORDER BY ${clause}`;
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
  const target = columnify(countCol);
  if (!target) {
    return `select count(*) as total from (${selectSql})`;
  }
  return `select count(distinct [[${target}]]) as total from (${selectSql})`;
}

function extractFromAlias(sql: string): string | null {
  const match = /\bfrom\s+([^\s,]+)(?:\s+(?:as\s+)?([^\s,]+))?/i.exec(sql);
  if (!match) {
    return null;
  }
  const candidate = match[2] ?? match[1] ?? "";
  const trimmed = candidate.trim();
  if (!trimmed || trimmed.startsWith("(")) {
    return null;
  }
  return stripIdentifierQuotes(trimmed);
}

function stripIdentifierQuotes(value: string): string {
  if (value.startsWith("[[") && value.endsWith("]]")) {
    return value.slice(2, -2);
  }
  if (value.startsWith("[") && value.endsWith("]")) {
    return value.slice(1, -1);
  }
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("`") && value.endsWith("`"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}
