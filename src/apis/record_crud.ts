// Ported from pocketbase/apis/record_crud.go @ v0.36.1 (9b036fb1)

import type { App } from "../core/app.ts";
import type { RequestEvent } from "../core/event_request.ts";
import { Record as RecordModel } from "../core/record.ts";
import type { RouterGroup } from "../tools/router/group.ts";
import { Provider } from "../tools/search/provider.ts";
import { SimpleFieldResolver } from "../tools/search/simple_field_resolver.ts";

const DEFAULT_SYSTEM_FIELDS = ["id", "created", "updated"];

type RecordsListResult = {
  page: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
  items: Record<string, unknown>[];
};

export function bindRecordCrudApi(app: App, rg: RouterGroup<RequestEvent>): void {
  const group = rg.group("/collections/{collection}/records");
  group.get("", (event) => recordsList(app, event));
  group.get("/{id}", (event) => recordView(app, event));
}

function recordsList(app: App, event: RequestEvent): Response {
  const collectionId = event.params.collection ?? "";
  const collection = app.findCollectionByNameOrId(collectionId);
  if (!collection) {
    return notFound(event, "Missing collection context.");
  }

  if (!event.auth || !event.auth.isSuperuser()) {
    return forbidden(event, "Only superusers can perform this action.");
  }

  const fields = collection.fields.map((field) => field.name).filter(Boolean);
  const allowedFields = fields.length > 0 ? fields : DEFAULT_SYSTEM_FIELDS;
  const resolver = new SimpleFieldResolver(...allowedFields);

  const provider = new Provider(resolver).query({
    select: `select * from {{${collection.name}}}`,
    count: `select count(*) as total from {{${collection.name}}}`,
  });

  try {
    const query = new URL(event.request.url).searchParams.toString();
    const result = provider.parseAndExec<Record<string, unknown>>(query, app.db());
    const items = result.items.map((row) => new RecordModel(collection, row).publicExport());
    const response: RecordsListResult = {
      ...result,
      items,
    };
    return event.json(200, response);
  } catch {
    return badRequest(event, "");
  }
}

function recordView(app: App, event: RequestEvent): Response {
  const collectionId = event.params.collection ?? "";
  const collection = app.findCollectionByNameOrId(collectionId);
  if (!collection) {
    return notFound(event, "Missing collection context.");
  }

  if (!event.auth || !event.auth.isSuperuser()) {
    return forbidden(event, "Only superusers can perform this action.");
  }

  const recordId = event.params.id ?? "";
  if (!recordId) {
    return notFound(event, "");
  }

  try {
    const record = app.findRecordById(collection, recordId);
    if (!record) {
      return notFound(event, "");
    }

    return event.json(200, record.publicExport());
  } catch {
    return notFound(event, "");
  }
}

function notFound(event: RequestEvent, message: string): Response {
  return event.json(404, {
    status: 404,
    message: message || "The requested resource wasn't found.",
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

function forbidden(event: RequestEvent, message: string): Response {
  return event.json(403, {
    status: 403,
    message,
    data: {},
  });
}
