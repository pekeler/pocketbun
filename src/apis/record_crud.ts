// Ported from pocketbase/apis/record_crud.go

import type { App } from "../core/app.ts";
import type { RequestEvent } from "../core/event_request.ts";
import { RecordFieldResolver } from "../core/record_field_resolver.ts";
import { Record as RecordModel } from "../core/record.ts";
import type { RouterGroup } from "../tools/router/group.ts";
import { buildFilterExpr } from "../tools/search/filter.ts";
import { Provider } from "../tools/search/provider.ts";
import { DefaultFilterExprLimit } from "../tools/search/types.ts";

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

async function recordsList(app: App, event: RequestEvent): Promise<Response> {
  const collectionId = event.params.collection ?? "";
  const collection = app.findCollectionByNameOrId(collectionId);
  if (!collection) {
    return notFound(event, "Missing collection context.");
  }

  const requestInfo = await event.requestInfo();

  if (collection.listRule === null && !requestInfo.auth?.isSuperuser()) {
    return forbidden(event, "Only superusers can perform this action.");
  }

  const resolver = new RecordFieldResolver(app, collection, requestInfo, true);

  let selectSql = `select * from {{${collection.name}}}`;
  let countSql = `select count(*) as total from {{${collection.name}}}`;
  const params: unknown[] = [];

  if (!requestInfo.auth?.isSuperuser() && collection.listRule && collection.listRule !== "") {
    const expr = buildFilterExpr(collection.listRule, resolver, DefaultFilterExprLimit);
    if (expr.sql) {
      selectSql = appendWhere(selectSql, expr.sql);
      countSql = appendWhere(countSql, expr.sql);
      params.push(...expr.params);
    }
  }

  resolver.setAllowHiddenFields(Boolean(requestInfo.auth?.isSuperuser()));

  const provider = new Provider(resolver).query({
    select: selectSql,
    count: countSql,
    params,
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

async function recordView(app: App, event: RequestEvent): Promise<Response> {
  const collectionId = event.params.collection ?? "";
  const collection = app.findCollectionByNameOrId(collectionId);
  if (!collection) {
    return notFound(event, "Missing collection context.");
  }

  const requestInfo = await event.requestInfo();
  if (collection.viewRule === null && !requestInfo.auth?.isSuperuser()) {
    return forbidden(event, "Only superusers can perform this action.");
  }

  const recordId = event.params.id ?? "";
  if (!recordId) {
    return notFound(event, "");
  }

  try {
    let ruleExpr = null;
    if (!requestInfo.auth?.isSuperuser() && collection.viewRule && collection.viewRule !== "") {
      const resolver = new RecordFieldResolver(app, collection, requestInfo, true);
      ruleExpr = buildFilterExpr(collection.viewRule, resolver, DefaultFilterExprLimit);
    }

    const record = app.findRecordById(collection, recordId, ruleExpr);
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

function appendWhere(baseSql: string, clause: string): string {
  if (!clause) {
    return baseSql;
  }
  if (/\bwhere\b/i.test(baseSql)) {
    return `${baseSql} AND ${clause}`;
  }
  return `${baseSql} WHERE ${clause}`;
}
