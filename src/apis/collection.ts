// Ported from pocketbase/apis/collection.go

import type { App } from "../core/app.ts";
import type { RequestEvent } from "../core/event_request.ts";
import type { RouterGroup } from "../tools/router/group.ts";
import {
  Collection,
  NewAuthCollection,
  NewBaseCollection,
  NewViewCollection,
  applyCollectionData,
  collectionFromRow,
  parseCollectionFields,
} from "../core/collection_model.ts";
import { DefaultIdAlphabet } from "../core/db.ts";
import { CollectionRequestEvent, CollectionsListRequestEvent } from "../core/events.ts";
import { ValidationError, ValidationErrors } from "../internal/compat/validation.ts";
import { Provider } from "../tools/search/provider.ts";
import { SimpleFieldResolver } from "../tools/search/simple_field_resolver.ts";
import { randomStringWithAlphabet } from "../tools/security/random.ts";
import { collectionsImport } from "./collection_import.ts";

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

function findCachedCollection(app: App, identifier: string): Collection | null {
  try {
    return app.FindCachedCollectionByNameOrId(identifier);
  } catch {
    return null;
  }
}

// bindCollectionApi registers the collection api endpoints and the corresponding handlers.
export function bindCollectionApi(app: App, rg: RouterGroup<RequestEvent>): void {
  const group = rg.group("/collections");
  group.get("", (event) => collectionsList(app, event));
  group.post("", (event) => collectionCreate(app, event));
  group.get("/{collection}", (event) => collectionView(app, event));
  group.patch("/{collection}", (event) => collectionUpdate(app, event));
  group.delete("/{collection}", (event) => collectionDelete(app, event));
  group.delete("/{collection}/truncate", (event) => collectionTruncate(app, event));
  group.put("/import", (event) => collectionsImport(app, event));
  group.get("/meta/scaffolds", (event) => collectionScaffolds(app, event));
}

async function collectionsList(app: App, event: RequestEvent): Promise<Response> {
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
    const query = event.requestUrl().searchParams.toString();
    const result = provider.parseAndExec<CollectionRow>(query, app.db());
    const collections = result.items.map((row) => collectionFromRow(row));
    const responseBuilder = () =>
      ({
        ...result,
        items: collections.map(normalizeCollectionRow),
      }) as CollectionsListResult;

    const hookEvent = new CollectionsListRequestEvent(event, collections, result);
    const out = await app.OnCollectionsListRequest().Trigger(hookEvent, async () => event.json(200, responseBuilder()));
    if (out instanceof Response) {
      return out;
    }
    return event.json(200, responseBuilder());
  } catch {
    return badRequest(event, "");
  }
}

async function collectionView(app: App, event: RequestEvent): Promise<Response> {
  const authResponse = requireSuperuser(event);
  if (authResponse) {
    return authResponse;
  }

  const collectionId = event.params.collection ?? "";
  if (!collectionId) {
    return notFound(event);
  }

  const collection = findCachedCollection(app, collectionId);
  if (!collection) {
    return notFound(event);
  }

  const hookEvent = new CollectionRequestEvent(event, collection);
  const out = await app
    .OnCollectionViewRequest()
    .Trigger(hookEvent, async () => event.json(200, normalizeCollectionRow(hookEvent.Collection)));
  if (out instanceof Response) {
    return out;
  }
  return event.json(200, normalizeCollectionRow(hookEvent.Collection));
}

async function collectionCreate(app: App, event: RequestEvent): Promise<Response> {
  const authResponse = requireSuperuser(event);
  if (authResponse) {
    return authResponse;
  }

  const data = await readRequestData(event);
  const type = typeof data.type === "string" ? data.type : "base";
  const name = typeof data.name === "string" ? data.name : "";
  const collection = collectionFromData({ ...data, type, name });

  const hookEvent = new CollectionRequestEvent(event, collection);
  const out = await app.OnCollectionCreateRequest().Trigger(hookEvent, async () => {
    const err = await app.Save(hookEvent.Collection);
    if (err) {
      const validationErr = extractValidationErrors(err);
      if (validationErr) {
        return badRequest(event, "Failed to create collection.", validationErr);
      }
      return badRequest(event, `Failed to create collection. Raw error: \n${err.message}`, null);
    }
    const row = fetchCollectionRow(app, hookEvent.Collection.id);
    if (row) {
      return event.json(200, normalizeCollectionRow(row));
    }
    return event.json(200, normalizeCollectionRow(hookEvent.Collection));
  });
  if (out instanceof Response) {
    return out;
  }
  return badRequest(event, "Failed to create collection.");
}

async function collectionUpdate(app: App, event: RequestEvent): Promise<Response> {
  const authResponse = requireSuperuser(event);
  if (authResponse) {
    return authResponse;
  }

  const collectionId = event.params.collection ?? "";
  const collection = findCachedCollection(app, collectionId);
  if (!collection) {
    return notFound(event);
  }

  const data = await readRequestData(event);
  applyCollectionData(collection, data);
  mergeDefaultFields(collection);

  const hookEvent = new CollectionRequestEvent(event, collection);
  const out = await app.OnCollectionUpdateRequest().Trigger(hookEvent, async () => {
    const err = await app.Save(hookEvent.Collection);
    if (err) {
      const validationErr = extractValidationErrors(err);
      if (validationErr) {
        return badRequest(event, "Failed to update collection.", validationErr);
      }
      return badRequest(event, `Failed to update collection. Raw error: \n${err.message}`, null);
    }
    const row = fetchCollectionRow(app, hookEvent.Collection.id);
    if (row) {
      return event.json(200, normalizeCollectionRow(row));
    }
    return event.json(200, normalizeCollectionRow(hookEvent.Collection));
  });
  if (out instanceof Response) {
    return out;
  }
  return badRequest(event, "Failed to update collection.");
}

async function collectionDelete(app: App, event: RequestEvent): Promise<Response> {
  const authResponse = requireSuperuser(event);
  if (authResponse) {
    return authResponse;
  }

  const collectionId = event.params.collection ?? "";
  const collection = findCachedCollection(app, collectionId);
  if (!collection) {
    return notFound(event);
  }

  const hookEvent = new CollectionRequestEvent(event, collection);
  const out = await app.OnCollectionDeleteRequest().Trigger(hookEvent, async () => {
    const err = await app.Delete(hookEvent.Collection);
    if (err) {
      let message = "Failed to delete collection.";
      const refs = app.FindCachedCollectionReferences(hookEvent.Collection, hookEvent.Collection.id);
      if (refs.size > 0) {
        const names = Array.from(refs.keys()).map((ref) => ref.name);
        message += ` probably due to existing reference in ${names.join(", ")}`;
      }
      if (err instanceof ValidationErrors) {
        return badRequest(event, message, err);
      }
      return badRequest(event, message, null);
    }
    return noContent(event);
  });
  if (out instanceof Response) {
    return out;
  }
  return noContent(event);
}

async function collectionTruncate(app: App, event: RequestEvent): Promise<Response> {
  const authResponse = requireSuperuser(event);
  if (authResponse) {
    return authResponse;
  }

  const collectionId = event.params.collection ?? "";
  const collection = findCachedCollection(app, collectionId);
  if (!collection) {
    return notFound(event);
  }

  if (collection.isView()) {
    return badRequest(event, "View collections cannot be truncated since they don't store their own records.");
  }

  const err = await app.TruncateCollection(collection);
  if (err) {
    return badRequest(
      event,
      "Failed to truncate collection (most likely due to required cascade delete record references).",
      null,
    );
  }

  return noContent(event);
}

function collectionScaffolds(app: App, event: RequestEvent): Response {
  const authResponse = requireSuperuser(event);
  if (authResponse) {
    return authResponse;
  }

  const randomId = randomStringWithAlphabet(10, DefaultIdAlphabet);
  const base = NewBaseCollection("", randomId);
  const auth = NewAuthCollection("", randomId);
  const view = NewViewCollection("", randomId);
  base.id = "";
  auth.id = "";
  view.id = "";
  return event.json(200, {
    base: normalizeCollectionRow(base),
    auth: normalizeCollectionRow(auth),
    view: normalizeCollectionRow(view),
  });
}

function normalizeCollectionRow(row: CollectionRow | Collection): CollectionResponse {
  const collection = row instanceof Collection ? row : collectionFromRow(row);
  return {
    id: collection.id,
    created: collection.created.toString(),
    updated: collection.updated.toString(),
    name: collection.name,
    system: collection.system,
    type: collection.type,
    fields: collection.Fields.toJSON(),
    indexes: [...collection.indexes],
    listRule: collection.listRule ?? null,
    viewRule: collection.viewRule ?? null,
    createRule: collection.createRule ?? null,
    updateRule: collection.updateRule ?? null,
    deleteRule: collection.deleteRule ?? null,
    options: collection.SafeOptions(),
  };
}

function fetchCollectionRow(app: App, identifier: string): CollectionRow | null {
  const row = app
    .db()
    .query(
      "select id, created, updated, name, system, type, fields, indexes, listRule, viewRule, createRule, updateRule, deleteRule, options from _collections where id = ? or name = ?",
    )
    .get(identifier, identifier) as CollectionRow | undefined;
  return row ?? null;
}

export async function readRequestData(event: RequestEvent): Promise<Record<string, unknown>> {
  try {
    if (!event.request.body) {
      return {};
    }
    const contentType = event.request.headers.get("Content-Type") ?? "";
    if (contentType.includes("application/json")) {
      const parsed = await event.request.json();
      return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
    }
  } catch {
    return {};
  }
  return {};
}

function collectionFromData(data: Record<string, unknown>): Collection {
  const name = typeof data.name === "string" ? data.name : "";
  const type = typeof data.type === "string" ? data.type : "base";
  let collection: Collection;
  if (type === "auth") {
    collection = NewAuthCollection(name);
  } else if (type === "view") {
    collection = NewViewCollection(name);
  } else {
    collection = NewBaseCollection(name);
  }

  applyCollectionData(collection, data);
  mergeDefaultFields(collection);
  return collection;
}

function mergeDefaultFields(collection: Collection): void {
  collection.initDefaultFields();
  collection.fields = parseCollectionFields(collection.Fields.toJSON());
}

function safeErrorsData(data: unknown): Record<string, unknown> {
  if (!data) {
    return {};
  }
  if (data instanceof ValidationErrors) {
    return resolveSafeErrorsMap(data.errors);
  }
  if (data instanceof ValidationError) {
    return { "": resolveSafeErrorItem(data) };
  }
  if (typeof data === "object" && !Array.isArray(data)) {
    return resolveSafeErrorsMap(data as Record<string, unknown>);
  }
  return {};
}

function resolveSafeErrorsMap(data: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [name, err] of Object.entries(data)) {
    if (isNestedError(err)) {
      result[name] = safeErrorsData(err);
    } else {
      result[name] = resolveSafeErrorItem(err);
    }
  }
  return result;
}

export function extractValidationErrors(err: unknown): ValidationErrors | null {
  if (err instanceof ValidationErrors) {
    return err;
  }
  if (err instanceof AggregateError) {
    for (const inner of err.errors) {
      const found = extractValidationErrors(inner);
      if (found) {
        return found;
      }
    }
    return null;
  }
  if (err && typeof err === "object") {
    const maybeErrors = (err as { errors?: unknown }).errors;
    if (Array.isArray(maybeErrors)) {
      for (const inner of maybeErrors) {
        const found = extractValidationErrors(inner);
        if (found) {
          return found;
        }
      }
    }
  }
  return null;
}

function isNestedError(err: unknown): boolean {
  if (!err) {
    return false;
  }
  if (err instanceof ValidationErrors) {
    return true;
  }
  if (err instanceof ValidationError) {
    return false;
  }
  if (err instanceof Error) {
    return false;
  }
  return typeof err === "object" && !Array.isArray(err);
}

function resolveSafeErrorItem(err: unknown): Record<string, unknown> {
  const data: Record<string, unknown> = {
    code: "validation_invalid_value",
    message: "Invalid value.",
  };

  if (err instanceof ValidationError) {
    data.code = err.code;
    data.message = err.message;
    if (err.params && Object.keys(err.params).length > 0) {
      data.params = err.params;
    }
  }

  if (err instanceof Error && !(err instanceof ValidationError)) {
    data.message = err.message;
  }

  return data;
}

export function requireSuperuser(event: RequestEvent): Response | null {
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

function badRequest(event: RequestEvent, message: string, errData: unknown = null): Response {
  return event.json(400, {
    status: 400,
    message: message || "Something went wrong while processing your request.",
    data: safeErrorsData(errData),
  });
}

function noContent(event: RequestEvent): Response {
  return new Response(null, {
    status: 204,
    headers: event.responseHeaders,
  });
}
