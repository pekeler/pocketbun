// Ported from pocketbase/apis/collection.go

import type { App } from "../core/app.ts";
import type { RequestEvent } from "../core/event_request.ts";
import type { RouterGroup } from "../tools/router/group.ts";
import { Provider } from "../tools/search/provider.ts";
import { SimpleFieldResolver } from "../tools/search/simple_field_resolver.ts";

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

  const baseSql =
    "select id, created, updated, name, system, type, fields, indexes, listRule, viewRule, createRule, updateRule, deleteRule, options from _collections";
  const resolver = new SimpleFieldResolver(...COLLECTION_FIELDS);
  const provider = new Provider(resolver).query({
    select: baseSql,
    count: "select count(*) as total from _collections",
  });

  try {
    const query = new URL(event.request.url).searchParams.toString();
    const result = provider.parseAndExec<CollectionRow>(query, app.db());
    const response: CollectionsListResult = {
      ...result,
      items: result.items.map(normalizeCollectionRow),
    };
    return event.json(200, response);
  } catch {
    return badRequest(event, "");
  }
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
