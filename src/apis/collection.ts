// Ported from pocketbase/apis/collection.go @ v0.36.1 (9b036fb1)

import type { App } from "../core/app.ts";
import type { RequestEvent } from "../core/event_request.ts";
import type { RouterGroup } from "../tools/router/group.ts";

const DEFAULT_PER_PAGE = 30;
const MAX_PER_PAGE = 1000;
const COLLECTION_FIELDS = new Set(["id", "created", "updated", "name", "system", "type"]);

type CollectionRow = {
  id: string;
  created: string;
  updated: string;
  name: string;
  system: number;
  type: string;
  fields: string;
  indexes: string;
  listRule: string | null;
  viewRule: string | null;
  createRule: string | null;
  updateRule: string | null;
  deleteRule: string | null;
  options: string;
};

type CollectionResponse = {
  id: string;
  created: string;
  updated: string;
  name: string;
  system: boolean;
  type: string;
  fields: unknown[];
  indexes: unknown[];
  listRule: string | null;
  viewRule: string | null;
  createRule: string | null;
  updateRule: string | null;
  deleteRule: string | null;
  options: Record<string, unknown>;
};

type CollectionsListResult = {
  page: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
  items: CollectionResponse[];
};

export function bindCollectionApi(app: App, rg: RouterGroup<RequestEvent>): void {
  const group = rg.group("/collections");
  group.get("", (event) => collectionsList(app, event));
  group.get("/{collection}", (event) => collectionView(app, event));
}

function collectionsList(app: App, event: RequestEvent): Response {
  const authResponse = requireSuperuser(event);
  if (authResponse) {
    return authResponse;
  }

  const params = new URL(event.request.url).searchParams;
  const page = parsePage(params.get("page"));
  const perPage = parsePerPage(params.get("perPage"));
  if (page.error || perPage.error) {
    return badRequest(event, "");
  }

  const filter = parseFilter(params.get("filter"));
  if (filter.error) {
    return badRequest(event, "");
  }

  const sort = parseSort(params.get("sort"));
  if (sort.error) {
    return badRequest(event, "");
  }

  const baseSql =
    "select id, created, updated, name, system, type, fields, indexes, listRule, viewRule, createRule, updateRule, deleteRule, options from _collections";
  const whereSql = filter.sql ? ` where ${filter.sql}` : "";
  const orderSql = sort.sql ? ` order by ${sort.sql}` : "";

  const countRow = app
    .db()
    .query(`select count(*) as total from _collections${whereSql}`)
    .get(...filter.params) as { total: number } | undefined;
  const totalItems = countRow?.total ?? 0;
  const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / perPage.value);

  const items = app
    .db()
    .query(`${baseSql}${whereSql}${orderSql} limit ? offset ?`)
    .all(...filter.params, perPage.value, perPage.value * (page.value - 1)) as CollectionRow[];

  const result: CollectionsListResult = {
    page: page.value,
    perPage: perPage.value,
    totalItems,
    totalPages,
    items: items.map(normalizeCollectionRow),
  };

  return event.json(200, result);
}

function collectionView(app: App, event: RequestEvent): Response {
  const authResponse = requireSuperuser(event);
  if (authResponse) {
    return authResponse;
  }

  const collectionId = event.params.collection ?? "";
  if (!collectionId) {
    return notFound(event);
  }

  const row = app
    .db()
    .query(
      "select id, created, updated, name, system, type, fields, indexes, listRule, viewRule, createRule, updateRule, deleteRule, options from _collections where id = ? or name = ?",
    )
    .get(collectionId, collectionId) as CollectionRow | undefined;
  if (!row) {
    return notFound(event);
  }

  return event.json(200, normalizeCollectionRow(row));
}

function normalizeCollectionRow(row: CollectionRow): CollectionResponse {
  return {
    id: row.id,
    created: row.created,
    updated: row.updated,
    name: row.name,
    system: Boolean(row.system),
    type: row.type,
    fields: parseJsonArray(row.fields),
    indexes: parseJsonArray(row.indexes),
    listRule: row.listRule ?? null,
    viewRule: row.viewRule ?? null,
    createRule: row.createRule ?? null,
    updateRule: row.updateRule ?? null,
    deleteRule: row.deleteRule ?? null,
    options: parseJsonObject(row.options),
  };
}

function parseJsonArray(value: string): unknown[] {
  if (!value) {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseJsonObject(value: string): Record<string, unknown> {
  if (!value) {
    return {};
  }
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // fallthrough
  }
  return {};
}

function requireSuperuser(event: RequestEvent): Response | null {
  if (!event.auth) {
    return unauthorized(event, "The request requires valid record authorization token.");
  }

  if (!event.auth.isSuperuser()) {
    return forbidden(event, "The authorized record is not allowed to perform this action.");
  }

  return null;
}

function parsePage(value: string | null): { value: number; error: boolean } {
  if (!value) {
    return { value: 1, error: false };
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return { value: 1, error: true };
  }

  return { value: Math.max(1, parsed), error: false };
}

function parsePerPage(value: string | null): { value: number; error: boolean } {
  if (!value) {
    return { value: DEFAULT_PER_PAGE, error: false };
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return { value: DEFAULT_PER_PAGE, error: true };
  }

  const normalized = Math.max(1, parsed);
  return { value: Math.min(MAX_PER_PAGE, normalized), error: false };
}

function parseSort(value: string | null): { sql: string; error: boolean } {
  if (!value) {
    return { sql: "", error: false };
  }

  const fields = value
    .split(",")
    .map((field) => field.trim())
    .filter((field) => field !== "");
  if (fields.length === 0) {
    return { sql: "", error: false };
  }

  const parts: string[] = [];
  for (const rawField of fields) {
    let name = rawField;
    let dir = "ASC";
    if (rawField.startsWith("-")) {
      name = rawField.slice(1);
      dir = "DESC";
    } else if (rawField.startsWith("+")) {
      name = rawField.slice(1);
    }

    if (!COLLECTION_FIELDS.has(name)) {
      return { sql: "", error: true };
    }

    parts.push(`${name} ${dir}`);
  }

  return { sql: parts.join(", "), error: false };
}

function parseFilter(value: string | null): { sql: string; params: string[]; error: boolean } {
  if (!value) {
    return { sql: "", params: [], error: false };
  }

  const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*(=|~)\s*'(.*)'\s*$/.exec(value);
  if (!match) {
    return { sql: "", params: [], error: true };
  }

  const field = match[1] ?? "";
  const operator = match[2] ?? "";
  const rawValue = match[3] ?? "";

  if (!COLLECTION_FIELDS.has(field)) {
    return { sql: "", params: [], error: true };
  }

  if (operator === "=") {
    return { sql: `${field} = ?`, params: [rawValue], error: false };
  }

  const escaped = escapeLike(rawValue);
  return { sql: `${field} LIKE ? ESCAPE '\\'`, params: [`%${escaped}%`], error: false };
}

function escapeLike(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function unauthorized(event: RequestEvent, message: string): Response {
  return event.json(401, {
    status: 401,
    message,
    data: {},
  });
}

function forbidden(event: RequestEvent, message: string): Response {
  return event.json(403, {
    status: 403,
    message,
    data: {},
  });
}

function notFound(event: RequestEvent): Response {
  return event.json(404, {
    status: 404,
    message: "The requested resource wasn't found.",
    data: {},
  });
}

function badRequest(event: RequestEvent, message: string): Response {
  return event.json(400, {
    status: 400,
    message: message || "Something went wrong while processing your request.",
    data: {},
  });
}
