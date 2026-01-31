// Ported from pocketbase/apis/collection.go

import type { App } from "../core/app.ts";
import type { RequestEvent } from "../core/event_request.ts";
import {
  Collection,
  NewAuthCollection,
  NewBaseCollection,
  NewViewCollection,
  parseCollectionFields,
} from "../core/collection.ts";
import { CollectionRequestEvent, CollectionsImportRequestEvent, CollectionsListRequestEvent } from "../core/events.ts";
import { FieldsList } from "../core/fields_list.ts";
import { ValidationError, ValidationErrors } from "../internal/compat/validation.ts";
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
    const query = new URL(event.request.url).searchParams.toString();
    const result = provider.parseAndExec<CollectionRow>(query, app.db());
    const collections = result.items.map((row) => collectionFromRow(row));
    const responseBuilder = () =>
      ({
        ...result,
        items: collections.map(normalizeCollectionRow),
      }) as CollectionsListResult;

    const hookEvent = new CollectionsListRequestEvent(event, collections, result);
    const out = await app.OnCollectionsListRequest().Trigger(hookEvent, async () =>
      event.json(200, responseBuilder()),
    );
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

  const collection = app.findCollectionByNameOrId(collectionId);
  if (!collection) {
    return notFound(event);
  }

  const hookEvent = new CollectionRequestEvent(event, collection);
  const out = await app.OnCollectionViewRequest().Trigger(hookEvent, async () =>
    event.json(200, normalizeCollectionRow(toCollectionRow(hookEvent.Collection))),
  );
  if (out instanceof Response) {
    return out;
  }
  return event.json(200, normalizeCollectionRow(toCollectionRow(hookEvent.Collection)));
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
    const err = app.Save(hookEvent.Collection);
    if (err) {
      return badRequest(event, "Failed to create collection.", err);
    }
    const row = fetchCollectionRow(app, hookEvent.Collection.id);
    if (row) {
      return event.json(200, normalizeCollectionRow(row));
    }
    return event.json(200, normalizeCollectionRow(toCollectionRow(hookEvent.Collection)));
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
  const collection = app.findCollectionByNameOrId(collectionId);
  if (!collection) {
    return notFound(event);
  }

  const data = await readRequestData(event);
  applyCollectionData(collection, data);
  mergeDefaultFields(collection);

  const hookEvent = new CollectionRequestEvent(event, collection);
  const out = await app.OnCollectionUpdateRequest().Trigger(hookEvent, async () => {
    const err = app.Save(hookEvent.Collection);
    if (err) {
      return badRequest(event, "Failed to update collection.", err);
    }
    const row = fetchCollectionRow(app, hookEvent.Collection.id);
    if (row) {
      return event.json(200, normalizeCollectionRow(row));
    }
    return event.json(200, normalizeCollectionRow(toCollectionRow(hookEvent.Collection)));
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
  const collection = app.findCollectionByNameOrId(collectionId);
  if (!collection) {
    return notFound(event);
  }

  const hookEvent = new CollectionRequestEvent(event, collection);
  const out = await app.OnCollectionDeleteRequest().Trigger(hookEvent, async () => {
    const err = app.Delete(hookEvent.Collection);
    if (err) {
      return badRequest(event, "Failed to delete collection.", err);
    }
    return noContent(event);
  });
  if (out instanceof Response) {
    return out;
  }
  return noContent(event);
}

function collectionTruncate(app: App, event: RequestEvent): Response {
  const authResponse = requireSuperuser(event);
  if (authResponse) {
    return authResponse;
  }

  const collectionId = event.params.collection ?? "";
  const collection = app.findCollectionByNameOrId(collectionId);
  if (!collection) {
    return notFound(event);
  }

  if (collection.isView()) {
    return badRequest(
      event,
      "View collections cannot be truncated since they don't store their own records.",
    );
  }

  const err = app.TruncateCollection(collection);
  if (err) {
    return badRequest(
      event,
      "Failed to truncate collection (most likely due to required cascade delete record references).",
      err,
    );
  }

  return noContent(event);
}

async function collectionsImport(app: App, event: RequestEvent): Promise<Response> {
  const authResponse = requireSuperuser(event);
  if (authResponse) {
    return authResponse;
  }

  const data = await readRequestData(event);
  const collections = Array.isArray(data.collections) ? data.collections : null;
  if (!collections) {
    return badRequest(event, "An error occurred while validating the submitted data.", {
      collections: new ValidationError("validation_required", "Cannot be blank."),
    });
  }

  const deleteMissing = Boolean(data.deleteMissing);
  const hookEvent = new CollectionsImportRequestEvent(
    event,
    collections as Array<Record<string, unknown>>,
    deleteMissing,
  );

  const out = await app.OnCollectionsImportRequest().Trigger(hookEvent, async () => {
    const err = app.ImportCollections(hookEvent.CollectionsData, hookEvent.DeleteMissing);
    if (err) {
      return badRequest(event, "Failed to import collections.", err);
    }
    return noContent(event);
  });
  if (out instanceof Response) {
    return out;
  }
  return noContent(event);
}

function collectionScaffolds(app: App, event: RequestEvent): Response {
  const authResponse = requireSuperuser(event);
  if (authResponse) {
    return authResponse;
  }

  const base = NewBaseCollection("", "");
  const auth = NewAuthCollection("", "");
  const view = NewViewCollection("", "");
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
  const source = row instanceof Collection ? toCollectionRow(row) : row;
  return {
    id: source.id,
    created: source.created,
    updated: source.updated,
    name: source.name,
    system: Boolean(source.system),
    type: source.type,
    fields: parseJsonArray(source.fields),
    indexes: parseJsonArray(source.indexes),
    listRule: source.listRule ?? null,
    viewRule: source.viewRule ?? null,
    createRule: source.createRule ?? null,
    updateRule: source.updateRule ?? null,
    deleteRule: source.deleteRule ?? null,
    options: parseJsonObject(source.options),
  };
}

function collectionFromRow(row: CollectionRow): Collection {
  const options = parseJsonObject(row.options);
  const fieldsRaw = parseJsonArray(row.fields);
  let fieldsList = new FieldsList();
  try {
    fieldsList = FieldsList.fromJSON(row.fields);
  } catch {
    fieldsList = new FieldsList();
  }
  const indexes = parseJsonArray(row.indexes).filter((value) => typeof value === "string") as string[];

  return new Collection({
    id: row.id,
    name: row.name,
    type: row.type,
    system: Boolean(row.system),
    fields: parseCollectionFields(fieldsRaw),
    Fields: fieldsList,
    indexes,
    listRule: row.listRule ?? null,
    viewRule: row.viewRule ?? null,
    createRule: row.createRule ?? null,
    updateRule: row.updateRule ?? null,
    deleteRule: row.deleteRule ?? null,
    options,
  });
}

function toCollectionRow(collection: Collection): CollectionRow {
  return {
    id: collection.id,
    created: "",
    updated: "",
    name: collection.name,
    system: collection.system ? 1 : 0,
    type: collection.type,
    fields: JSON.stringify(collection.Fields.toJSON()),
    indexes: JSON.stringify(collection.indexes ?? []),
    listRule: collection.listRule ?? null,
    viewRule: collection.viewRule ?? null,
    createRule: collection.createRule ?? null,
    updateRule: collection.updateRule ?? null,
    deleteRule: collection.deleteRule ?? null,
    options: JSON.stringify(collection.options ?? {}),
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

async function readRequestData(event: RequestEvent): Promise<Record<string, unknown>> {
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

function applyCollectionData(collection: Collection, data: Record<string, unknown>): void {
  if (typeof data.name === "string") {
    collection.name = data.name;
  }
  if (typeof data.type === "string") {
    collection.type = data.type;
  }
  if (typeof data.system === "boolean") {
    collection.system = data.system;
  }
  if (Array.isArray(data.fields)) {
    try {
      collection.Fields = FieldsList.fromJSON(JSON.stringify(data.fields));
    } catch {
      collection.Fields = new FieldsList();
    }
  }
  if (Array.isArray(data.indexes)) {
    collection.indexes = data.indexes.filter((value) => typeof value === "string") as string[];
  }
  if (typeof data.listRule === "string") {
    collection.listRule = data.listRule;
  }
  if (typeof data.viewRule === "string") {
    collection.viewRule = data.viewRule;
  }
  if (typeof data.createRule === "string") {
    collection.createRule = data.createRule;
  }
  if (typeof data.updateRule === "string") {
    collection.updateRule = data.updateRule;
  }
  if (typeof data.deleteRule === "string") {
    collection.deleteRule = data.deleteRule;
  }
  if (typeof data.options === "object" && data.options) {
    collection.options = data.options as any;
  }
}

function mergeDefaultFields(collection: Collection): void {
  let defaults: Collection;
  if (collection.isAuth()) {
    defaults = NewAuthCollection(collection.name, collection.id);
  } else if (collection.isView()) {
    defaults = NewViewCollection(collection.name, collection.id);
  } else {
    defaults = NewBaseCollection(collection.name, collection.id);
  }

  const merged = new FieldsList();
  merged.Add(...defaults.Fields);
  merged.Add(...collection.Fields);
  collection.Fields = merged;
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
