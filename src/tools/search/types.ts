// Ported from pocketbase/tools/search/provider.go @ v0.36.1 (9b036fb1)

export const DefaultPerPage = 30;
export const DefaultFilterExprLimit = 200;
export const DefaultSortExprLimit = 8;
export const MaxPerPage = 1000;
export const MaxFilterLength = 3500;
export const MaxSortFieldLength = 255;

export const PageQueryParam = "page";
export const PerPageQueryParam = "perPage";
export const SortQueryParam = "sort";
export const FilterQueryParam = "filter";
export const SkipTotalQueryParam = "skipTotal";

export type SearchResult<T> = {
  items: T[];
  page: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
};

export type SearchQuery = {
  select: string;
  count: string;
  params?: unknown[];
};

export type SqlExpr = {
  sql: string;
  params: unknown[];
};

export class SearchError extends Error {}

export const ErrEmptyQuery = new SearchError("search query is not set");
export const ErrSortExprLimit = new SearchError("max sort expressions limit reached");
export const ErrFilterExprLimit = new SearchError("max filter expressions limit reached");
export const ErrFilterLengthLimit = new SearchError("max filter length limit reached");
export const ErrSortFieldLengthLimit = new SearchError("max sort field length limit reached");
