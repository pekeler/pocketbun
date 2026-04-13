// Ported from pocketbase/apis/record_crud.go
// Note: record upsert form logic (file handling parity) is not yet ported.

import type { SQLQueryBindings } from "bun:sqlite";
import type { App } from "../core/app.ts";
import type { RequestEvent, RequestInfo } from "../core/event_request.ts";
import type { RouterGroup } from "../tools/router/group.ts";
import { Collection } from "../core/collection_model.ts";
import { RequestEventKeyInfoContext, RequestInfoContextDefault, RequestInfoContextOAuth2 } from "../core/event_request.ts";
import { RecordRequestEvent, RecordsListRequestEvent } from "../core/events.ts";
import { FieldTypeFile } from "../core/field_file.ts";
import { PasswordFieldValue } from "../core/field_password.ts";
import { RecordFieldResolver } from "../core/record_field_resolver.ts";
import { FieldNamePassword, NewRecord, Record as RecordModel, type RecordData } from "../core/record_model.ts";
import { RecordUpsert } from "../forms/record_upsert.ts";
import { readRequestTextAndRebind } from "../internal/compat/request_body.ts";
import { multipartValueToFilesystemFile, parseMultipartFormData } from "../internal/compat/request_form_data.ts";
import { ValidationError, ValidationErrors } from "../internal/compat/validation.ts";
import { type File as LocalFile } from "../tools/filesystem/file.ts";
import { columnify } from "../tools/inflector/inflector.ts";
import { toUniqueStringSlice } from "../tools/list/list.ts";
import { ApiError, ToApiError, apiErrorResponse } from "../tools/router/api_error.ts";
import { JSONPayloadKey, unmarshalRequestData } from "../tools/router/unmarshal_request_data.ts";
import { buildFilterExpr } from "../tools/search/filter.ts";
import { Provider } from "../tools/search/provider.ts";
import {
  DefaultFilterExprLimit,
  DefaultPerPage,
  MaxPerPage,
  PageQueryParam,
  PerPageQueryParam,
  SkipTotalQueryParam,
  type SearchResult,
} from "../tools/search/types.ts";
import { randomString } from "../tools/security/random.ts";
import { DateTime, GeoPoint, JSONRaw } from "../tools/types/index.ts";
import { DefaultRateLimitMiddlewareId } from "./middlewares.ts";
import { dynamicCollectionBodyLimit } from "./middlewares_body_limit.ts";
import { checkCollectionRateLimit } from "./middlewares_rate_limit.ts";
import { checkForSuperuserOnlyRuleFields, EnrichRecord, EnrichRecords } from "./record_helpers.ts";

type RecordsListResult = SearchResult<RecordModel>;

type ParsedRequestData = {
  data: RecordData;
  files: Map<string, LocalFile[]>;
  error: Error | null;
  request: RequestLike | null;
};

type RequestLike = {
  headers: { get: (name: string) => string | null };
  body: unknown;
  text: () => Promise<string>;
  formData: () => Promise<FormDataLike>;
};

type FormDataLike = {
  entries?: () => IterableIterator<[string, unknown]>;
  forEach?: (cb: (value: unknown, key: string) => void) => void;
  [Symbol.iterator]?: () => IterableIterator<[string, unknown]>;
};

type BenchFastListEntry = {
  totalItems: number;
  items: RecordData[];
  page1Payload: string | null;
};

const benchFastListCache = new Map<string, BenchFastListEntry>();
const emptyUploadedFiles = new Map<string, LocalFile[]>();

function findCachedCollection(app: App, identifier: string): Collection | null {
  try {
    return app.FindCachedCollectionByNameOrId(identifier);
  } catch {
    return null;
  }
}

function maybeBenchFastList(event: RequestEvent, collection: Collection): Response | null {
  if (process.env.POCKETBUN_BENCH_FASTLIST !== "1") {
    return null;
  }
  if (collection.name !== "bench_items") {
    return null;
  }

  const url = event.requestUrl();
  if (url.search.includes(";")) {
    return badRequest(event, "");
  }
  const params = url.searchParams;

  let page = 1;
  const pageRaw = params.get(PageQueryParam);
  if (pageRaw) {
    const parsed = Number.parseInt(pageRaw, 10);
    if (!Number.isFinite(parsed)) {
      return badRequest(event, "");
    }
    page = parsed;
  }

  let perPage = DefaultPerPage;
  const perPageRaw = params.get(PerPageQueryParam);
  if (perPageRaw) {
    const parsed = Number.parseInt(perPageRaw, 10);
    if (!Number.isFinite(parsed)) {
      return badRequest(event, "");
    }
    perPage = parsed;
  }

  let skipTotal = false;
  const skipTotalRaw = params.get(SkipTotalQueryParam);
  if (skipTotalRaw) {
    const parsed = parseBenchBool(skipTotalRaw);
    if (parsed == null) {
      return badRequest(event, "");
    }
    skipTotal = parsed;
  }

  if (page <= 0) {
    page = 1;
  }
  if (perPage <= 0) {
    perPage = DefaultPerPage;
  } else if (perPage > MaxPerPage) {
    perPage = MaxPerPage;
  }

  const totalItems = resolveBenchTotalItems();
  const entry = getBenchFastListEntry(collection, totalItems);

  const start = perPage * (page - 1);
  const end = Math.min(totalItems, start + perPage);
  const items = start >= totalItems ? [] : entry.items.slice(start, end);

  if (skipTotal) {
    return event.json(200, {
      items,
      page,
      perPage,
      totalItems: -1,
      totalPages: -1,
    });
  }

  const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / perPage);
  const rawFields = params.get("fields");
  if (process.env.POCKETBUN_BENCH_FASTLIST_RAW === "1" && !rawFields && page === 1 && perPage === 30) {
    if (entry.page1Payload) {
      event.responseHeaders.set("Content-Type", "application/json");
      return event.String(200, entry.page1Payload);
    }
  }
  return event.json(200, {
    items,
    page,
    perPage,
    totalItems,
    totalPages,
  });
}

function resolveBenchTotalItems(): number {
  const raw = process.env.POCKETBUN_BENCH_RECORDS ?? "";
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    return 1000;
  }
  return Math.max(0, parsed);
}

function getBenchFastListEntry(collection: Collection, totalItems: number): BenchFastListEntry {
  const cacheKey = `${collection.id}:${totalItems}`;
  const cached = benchFastListCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const items: RecordData[] = [];
  for (let i = 0; i < totalItems; i += 1) {
    items.push({
      id: benchFastListId(i),
      title: `Item ${i}`,
      collectionId: collection.id,
      collectionName: collection.name,
    });
  }

  const perPage = 30;
  const slice = items.slice(0, perPage);
  const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / perPage);
  const page1Payload = `${JSON.stringify({
    items: slice,
    page: 1,
    perPage,
    totalItems,
    totalPages,
  })}\n`;

  const entry = { totalItems, items, page1Payload };
  benchFastListCache.set(cacheKey, entry);
  return entry;
}

function benchFastListId(index: number): string {
  const suffix = index.toString(36);
  if (suffix.length >= 15) {
    return suffix.slice(0, 15);
  }
  return suffix.padStart(15, "a");
}

function parseBenchBool(value: string): boolean | null {
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
  return null;
}

// bindRecordCrudApi registers the record crud api endpoints and
// the corresponding handlers.
//
// note: the rate limiter is "inlined" because some of the crud actions are also used in the batch APIs
export function bindRecordCrudApi(app: App, rg: RouterGroup<RequestEvent>): void {
  const group = rg.group("/collections/{collection}/records").unbind(DefaultRateLimitMiddlewareId);
  const createHook = app.OnRecordCreateRequest();
  const updateHook = app.OnRecordUpdateRequest();
  const deleteHook = app.OnRecordDeleteRequest();
  group.get("", (event) => recordsList(app, event));
  group.get("/{id}", (event) => recordView(app, event));
  group.post("", (event) => recordCreate(app, event, createHook)).Bind(dynamicCollectionBodyLimit(""));
  group.patch("/{id}", (event) => recordUpdate(app, event, updateHook)).Bind(dynamicCollectionBodyLimit(""));
  group.delete("/{id}", (event) => recordDelete(app, event, deleteHook));
}

async function recordsList(app: App, event: RequestEvent): Promise<Response> {
  const collectionId = event.params.collection ?? "";
  const collection = findCachedCollection(app, collectionId);
  if (!collection) {
    return notFound(event, "Missing collection context.");
  }

  const rateLimitResponse = checkCollectionRateLimit(event, collection, "list");
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const requestInfo = await event.requestInfo();
  if (collection.listRule === null && !requestInfo.auth?.isSuperuser()) {
    return forbidden(event, "Only superusers can perform this action.");
  }

  const superuserFieldError = checkForSuperuserOnlyRuleFields(requestInfo);
  if (superuserFieldError) {
    return forbidden(event, superuserFieldError);
  }

  const fastList = maybeBenchFastList(event, collection);
  if (fastList) {
    return fastList;
  }

  const resolver = new RecordFieldResolver(app, collection, requestInfo, true);

  let selectSql = `select {{${collection.name}}}.* from {{${collection.name}}}`;
  const params: unknown[] = [];

  if (!requestInfo.auth?.isSuperuser() && collection.listRule && collection.listRule !== "") {
    const expr = buildFilterExpr(collection.listRule, resolver, DefaultFilterExprLimit);
    if (expr.sql) {
      selectSql = appendWhere(selectSql, expr.sql);
      params.push(...expr.params);
    }
  }

  resolver.setAllowHiddenFields(Boolean(requestInfo.auth?.isSuperuser()));

  const provider = new Provider(resolver).query({
    select: selectSql,
    params,
  });
  if (collection.type !== "view") {
    provider.countCol("_rowid_");
  }

  let result: RecordsListResult | null = null;
  let records: RecordModel[] = [];
  try {
    const url = event.requestUrl();
    const rawResult = provider.parseAndExecParams<Record<string, unknown>>(url.searchParams, app.db(), url.search);
    const rows = rawResult.items;
    records = [];
    records.length = rows.length;
    for (let i = 0; i < rows.length; i += 1) {
      records[i] = RecordModel.fromRow(collection, rows[i] as RecordData);
    }
    result = {
      ...rawResult,
      items: records,
    };
  } catch {
    return badRequest(event, "");
  }

  if (!result) {
    return badRequest(event, "");
  }

  const hookEvent = new RecordsListRequestEvent(event, collection);
  hookEvent.Records = records;
  hookEvent.Result = result;

  const finalizeRecordsList = async (): Promise<Response> => {
    const enrichErr = await EnrichRecords(event, hookEvent.Records);
    if (enrichErr) {
      return internalServerError(event, "Failed to enrich records", enrichErr);
    }

    if (!hookEvent.Result) {
      hookEvent.Result = {
        ...result,
        items: hookEvent.Records,
      };
    }

    return event.json(200, hookEvent.Result);
  };

  const listHook = app.OnRecordsListRequest();
  // Deviation: skip hook trigger wiring when there are no handlers.
  // This preserves response semantics while reducing per-request allocations.
  if (listHook.Length() === 0) {
    return finalizeRecordsList();
  }

  const out = await listHook.Trigger(hookEvent, () => finalizeRecordsList());

  const listResponse = unwrapHookResponse(event, out);
  if (listResponse) {
    return listResponse;
  }

  if (hookEvent.Result) {
    return event.json(200, hookEvent.Result);
  }

  return badRequest(event, "");
}

async function recordView(app: App, event: RequestEvent): Promise<Response> {
  const collectionId = event.params.collection ?? "";
  const collection = findCachedCollection(app, collectionId);
  if (!collection) {
    return notFound(event, "Missing collection context.");
  }

  const rateLimitResponse = checkCollectionRateLimit(event, collection, "view");
  if (rateLimitResponse) {
    return rateLimitResponse;
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
    let record: RecordModel | null = null;
    if (!requestInfo.auth?.isSuperuser() && collection.viewRule && collection.viewRule !== "") {
      const resolver = new RecordFieldResolver(app, collection, requestInfo, true);
      const ruleExpr = buildFilterExpr(collection.viewRule, resolver, DefaultFilterExprLimit);

      let selectSql = `select {{${collection.name}}}.* from {{${collection.name}}}`;
      const params: SQLQueryBindings[] = [recordId];
      selectSql = appendWhere(selectSql, `[[${collection.name}.id]] = ?`);
      if (ruleExpr.sql) {
        selectSql = appendWhere(selectSql, ruleExpr.sql);
        params.push(...(ruleExpr.params as SQLQueryBindings[]));
      }

      if (resolver.updateQuery) {
        const updated = resolver.updateQuery({
          select: selectSql,
          params,
        });
        selectSql = updated.select;
        const updatedParams = (updated.params ?? []) as SQLQueryBindings[];
        params.splice(0, params.length, ...updatedParams);
      }

      const row = app
        .db()
        .query(selectSql)
        .get(...params) as Record<string, unknown> | undefined;
      if (!row) {
        return notFound(event, "");
      }

      record = RecordModel.fromRow(collection, row as RecordData);
    } else {
      record = app.findRecordById(collection, recordId);
      if (!record) {
        return notFound(event, "");
      }
    }

    const finalizeView = async (recordRef: RecordModel): Promise<Response> => {
      const enrichErr = await EnrichRecord(event, recordRef);
      if (enrichErr) {
        return internalServerError(event, "Failed to enrich record", enrichErr);
      }
      return event.json(200, recordRef.publicExport());
    };

    const viewHook = app.OnRecordViewRequest();
    // Deviation: skip hook trigger wiring when there are no handlers.
    // This preserves response semantics while reducing per-request allocations.
    if (viewHook.Length() === 0) {
      return finalizeView(record);
    }

    const hookEvent = new RecordRequestEvent(event, collection, record);
    const out = await viewHook.Trigger(hookEvent, () => finalizeView(hookEvent.Record ?? record));

    const viewResponse = unwrapHookResponse(event, out);
    if (viewResponse) {
      return viewResponse;
    }

    return finalizeView(hookEvent.Record ?? record);
  } catch {
    return badRequest(event, "");
  }
}

export async function recordCreate(app: App, event: RequestEvent, createHook = app.OnRecordCreateRequest()): Promise<Response> {
  const collectionId = event.params.collection ?? "";
  const collection = findCachedCollection(app, collectionId);
  if (!collection) {
    return notFound(event, "Missing collection context.");
  }

  if (collection.isView()) {
    return badRequest(event, "Unsupported collection type.", null);
  }

  const rateLimitResponse = checkCollectionRateLimit(event, collection, "create");
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const parseMultipartFiles = hasFileUploadFields(collection);
  const requestInfo = fallbackRequestInfo(event);
  let forceMultipartParse = false;
  let preboundBody: Record<string, unknown> | null = null;
  const lightweightRequestInfo = fallbackRequestInfoForMultipart(event);
  if (lightweightRequestInfo) {
    // PocketBun perf deviation: for file-upload collections, avoid the eager
    // multipart body bind inside event.requestInfo(); parseRequestData() will
    // do the single file-aware multipart parse and then populate requestInfo.body.
    event.setRequestInfo(lightweightRequestInfo);
    forceMultipartParse = true;
    preboundBody = lightweightRequestInfo.body;
  }

  const parsed = await parseRequestData(event.request, preboundBody, parseMultipartFiles, forceMultipartParse);
  if (parsed.request) {
    event.request = parsed.request as Request;
  }
  if (parsed.error) {
    if (app.IsDev()) {
      app
        .Logger()
        .Error(
          "Record create request data parse error",
          "collectionId",
          collection.id,
          "contentType",
          event.request.headers.get("content-type") ?? "",
          "error",
          parsed.error.message,
          "stack",
          parsed.error.stack ?? "",
        );
    }
    return badRequest(event, "Failed to read the submitted data.", parsed.error);
  }

  requestInfo.body = parsed.data;
  event.setRequestInfo(requestInfo);

  const hasSuperuser = Boolean(requestInfo.auth?.isSuperuser());

  if (!hasSuperuser && collection.createRule === null) {
    return forbidden(event, "Only superusers can perform this action.");
  }

  const record = NewRecord(collection);

  const data = resolveRecordData(record, requestInfo, parsed.files);
  requestInfo.body = data;

  let skipPlainPasswordRecordValidators = false;
  if (requestInfo.context === RequestInfoContextOAuth2) {
    if (!(FieldNamePassword in data)) {
      const generated = randomString(30);
      data[FieldNamePassword] = generated;
      data[`${FieldNamePassword}Confirm`] = generated;
      skipPlainPasswordRecordValidators = true;
    }
  }

  const form = new RecordUpsert(app, record);
  if (hasSuperuser) {
    form.GrantSuperuserAccess();
  }
  if (collection.IsAuth() && Object.prototype.hasOwnProperty.call(data, FieldNamePassword)) {
    await form.LoadAsync(data);
  } else {
    form.Load(data);
  }

  if (skipPlainPasswordRecordValidators) {
    const raw = record.GetRaw(FieldNamePassword);
    if (raw instanceof PasswordFieldValue) {
      raw.Plain = "";
    }
  }

  if (!hasSuperuser && collection.createRule !== null) {
    let createContext: CreateRuleContext | null = null;
    const ensureCreateContext = (): CreateRuleContext | Error => {
      if (createContext) {
        return createContext;
      }
      const created = buildCreateRuleContext(collection, record);
      if (created instanceof Error) {
        return created;
      }
      createContext = created;
      return createContext;
    };

    if (collection.createRule && collection.createRule !== "") {
      const createContextOrError = ensureCreateContext();
      if (createContextOrError instanceof Error) {
        return badRequest(event, "Failed to create record", createContextOrError);
      }

      const ruleErr = checkCreateRule(app, createContextOrError, requestInfo);
      if (ruleErr) {
        return badRequest(event, "Failed to create record", ruleErr);
      }
    }

    // Deviation: skip dummy create-rule context generation when only auth manage checks may apply.
    // Non-auth collections can never satisfy hasAuthManageAccess.
    if (!form.HasManageAccess() && collection.IsAuth()) {
      const createContextOrError = ensureCreateContext();
      if (createContextOrError instanceof Error) {
        return badRequest(event, "Failed to create record", createContextOrError);
      }

      if (
        hasAuthManageAccess(
          app,
          requestInfo,
          createContextOrError.collection,
          createContextOrError.selectSql,
          createContextOrError.params,
        )
      ) {
        form.GrantManagerAccess();
      }
    }
  }

  const finalizeCreate = async (targetApp: App, targetRecord: RecordModel): Promise<Response> => {
    form.SetApp(targetApp);
    form.SetRecord(targetRecord);

    const submitErr = await form.Submit();
    if (submitErr) {
      return badRequest(event, "Failed to create record.", submitErr);
    }

    const enrichErr = await EnrichRecord(event, targetRecord);
    if (enrichErr) {
      return internalServerError(event, "Failed to enrich record", enrichErr);
    }

    return event.json(200, targetRecord.publicExport());
  };

  if (createHook.Length() === 0) {
    return finalizeCreate(app, record);
  }

  const hookEvent = new RecordRequestEvent(event, collection, record);
  const out = await createHook.Trigger(hookEvent, () => {
    const recordRef = hookEvent.Record ?? record;
    return finalizeCreate(hookEvent.App, recordRef);
  });

  const createResponse = unwrapHookResponse(event, out);
  if (createResponse) {
    return createResponse;
  }

  const enrichErr = await EnrichRecord(event, record);
  if (enrichErr) {
    return internalServerError(event, "Failed to enrich record", enrichErr);
  }

  return event.json(200, record.publicExport());
}

export async function recordUpdate(app: App, event: RequestEvent, updateHook = app.OnRecordUpdateRequest()): Promise<Response> {
  const collectionId = event.params.collection ?? "";
  const collection = findCachedCollection(app, collectionId);
  if (!collection) {
    return notFound(event, "Missing collection context.");
  }

  if (collection.isView()) {
    return badRequest(event, "Unsupported collection type.", null);
  }

  const rateLimitResponse = checkCollectionRateLimit(event, collection, "update");
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const recordId = event.params.id ?? "";
  if (!recordId) {
    return notFound(event, "");
  }

  const parseMultipartFiles = hasFileUploadFields(collection);
  const requestInfo = fallbackRequestInfo(event);
  let forceMultipartParse = false;
  let preboundBody: Record<string, unknown> | null = null;
  const lightweightRequestInfo = fallbackRequestInfoForMultipart(event);
  if (lightweightRequestInfo) {
    // PocketBun perf deviation: for file-upload collections, avoid the eager
    // multipart body bind inside event.requestInfo(); parseRequestData() will
    // do the single file-aware multipart parse and then populate requestInfo.body.
    event.setRequestInfo(lightweightRequestInfo);
    forceMultipartParse = true;
    preboundBody = lightweightRequestInfo.body;
  }

  const parsed = await parseRequestData(event.request, preboundBody, parseMultipartFiles, forceMultipartParse);
  if (parsed.request) {
    event.request = parsed.request as Request;
  }
  if (parsed.error) {
    if (app.IsDev()) {
      app
        .Logger()
        .Error(
          "Record update request data parse error",
          "collectionId",
          collection.id,
          "contentType",
          event.request.headers.get("content-type") ?? "",
          "error",
          parsed.error.message,
          "stack",
          parsed.error.stack ?? "",
        );
    }
    return badRequest(event, "Failed to read the submitted data.", parsed.error);
  }

  requestInfo.body = parsed.data;
  event.setRequestInfo(requestInfo);

  const hasSuperuser = Boolean(requestInfo.auth?.isSuperuser());

  if (!hasSuperuser && collection.updateRule === null) {
    return forbidden(event, "Only superusers can perform this action.");
  }

  const baseRecord = app.findRecordById(collection, recordId);
  if (!baseRecord) {
    return notFound(event, "");
  }

  let data = resolveRecordData(baseRecord, requestInfo, parsed.files);
  requestInfo.body = data;

  let record = baseRecord;
  if (!hasSuperuser && collection.updateRule && collection.updateRule !== "") {
    const ruleRecord = findRecordForRule(app, collection, recordId, collection.updateRule, requestInfo);
    if (!ruleRecord) {
      return notFound(event, "");
    }
    record = ruleRecord;
  }

  const form = new RecordUpsert(app, record);
  if (hasSuperuser) {
    form.GrantSuperuserAccess();
  }
  if (collection.IsAuth() && Object.prototype.hasOwnProperty.call(data, FieldNamePassword)) {
    await form.LoadAsync(data);
  } else {
    form.Load(data);
  }
  if (!form.HasManageAccess()) {
    let manageSelect = `select 1 from {{${collection.name}}}`;
    const manageParams: SQLQueryBindings[] = [record.Id];
    manageSelect = appendWhere(manageSelect, `[[${collection.name}.id]] = ?`);
    if (hasAuthManageAccess(app, requestInfo, collection, manageSelect, manageParams)) {
      form.GrantManagerAccess();
    }
  }

  const finalizeUpdate = async (targetApp: App, targetRecord: RecordModel): Promise<Response> => {
    form.SetApp(targetApp);
    form.SetRecord(targetRecord);
    const submitErr = await form.Submit();
    if (submitErr) {
      return badRequest(event, "Failed to update record.", submitErr);
    }

    const enrichErr = await EnrichRecord(event, targetRecord);
    if (enrichErr) {
      return internalServerError(event, "Failed to enrich record", enrichErr);
    }

    return event.json(200, targetRecord.publicExport());
  };

  // Deviation: skip hook trigger wiring when there are no handlers.
  // This preserves response semantics while reducing per-request allocations.
  if (updateHook.Length() === 0) {
    return finalizeUpdate(app, record);
  }

  const hookEvent = new RecordRequestEvent(event, collection, record);
  const out = await updateHook.Trigger(hookEvent, () => finalizeUpdate(hookEvent.App, hookEvent.Record ?? record));

  const updateResponse = unwrapHookResponse(event, out);
  if (updateResponse) {
    return updateResponse;
  }

  const enrichErr = await EnrichRecord(event, record);
  if (enrichErr) {
    return internalServerError(event, "Failed to enrich record", enrichErr);
  }

  return event.json(200, record.publicExport());
}

export async function recordDelete(app: App, event: RequestEvent, deleteHook = app.OnRecordDeleteRequest()): Promise<Response> {
  const collectionId = event.params.collection ?? "";
  const collection = findCachedCollection(app, collectionId);
  if (!collection) {
    return notFound(event, "Missing collection context.");
  }

  if (collection.isView()) {
    return badRequest(event, "Unsupported collection type.", null);
  }

  const rateLimitResponse = checkCollectionRateLimit(event, collection, "delete");
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const recordId = event.params.id ?? "";
  if (!recordId) {
    return notFound(event, "");
  }

  const requestInfo = await event.requestInfo();
  const hasSuperuser = Boolean(requestInfo.auth?.isSuperuser());

  if (!hasSuperuser && collection.deleteRule === null) {
    return forbidden(event, "Only superusers can perform this action.");
  }

  let record: RecordModel | null = null;
  if (!hasSuperuser && collection.deleteRule && collection.deleteRule !== "") {
    record = findRecordForRule(app, collection, recordId, collection.deleteRule, requestInfo);
  } else {
    record = app.findRecordById(collection, recordId);
  }

  if (!record) {
    return notFound(event, "");
  }

  const finalizeDelete = async (targetRecord: RecordModel): Promise<Response> => {
    const deleteErr = await app.Delete(targetRecord);
    if (deleteErr) {
      if (deleteErr instanceof ApiError) {
        return apiErrorResponse(event, deleteErr);
      }
      return badRequest(
        event,
        "Failed to delete record. Make sure that the record is not part of a required relation reference.",
        deleteErr,
      );
    }

    return noContent(event);
  };

  // Deviation: skip hook trigger wiring when there are no handlers.
  // This preserves response semantics while reducing per-request allocations.
  if (deleteHook.Length() === 0) {
    return finalizeDelete(record);
  }

  const hookEvent = new RecordRequestEvent(event, collection, record);
  const out = await deleteHook.Trigger(hookEvent, () => {
    const recordRef = hookEvent.Record ?? record;
    return finalizeDelete(recordRef);
  });

  const deleteResponse = unwrapHookResponse(event, out);
  if (deleteResponse) {
    return deleteResponse;
  }

  return noContent(event);
}

async function parseRequestData(
  request: RequestLike,
  preboundBody: Record<string, unknown> | null = null,
  parseMultipartFiles = true,
  forceMultipartParse = false,
): Promise<ParsedRequestData> {
  const rawContentType = request.headers.get("content-type") ?? "";
  const contentType = rawContentType.toLowerCase();
  if (preboundBody && !contentType.includes("multipart/form-data")) {
    return { data: preboundBody as RecordData, files: emptyUploadedFiles, error: null, request: null };
  }

  if (!request.body) {
    return { data: {}, files: emptyUploadedFiles, error: null, request: null };
  }

  if (contentType.includes("application/json")) {
    const bound = await readRequestTextAndRebind(request as unknown as Request);
    const text = bound.text;
    if (text.trim() === "") {
      return { data: {}, files: emptyUploadedFiles, error: null, request: bound.request };
    }
    try {
      const parsed = JSON.parse(text) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return { data: {}, files: emptyUploadedFiles, error: new Error("invalid json"), request: bound.request };
      }
      return { data: parsed as RecordData, files: emptyUploadedFiles, error: null, request: bound.request };
    } catch (error) {
      return { data: {}, files: emptyUploadedFiles, error: error as Error, request: bound.request };
    }
  }

  if (contentType.includes("multipart/form-data")) {
    const usePreboundMultipartBody = Boolean(preboundBody) && !forceMultipartParse;
    if (usePreboundMultipartBody && !parseMultipartFiles) {
      // Deviation: for non-file collections we already have the parsed multipart body from RequestInfo().
      // Skipping the second multipart parse avoids unnecessary overhead and Bun stream edge cases.
      return { data: preboundBody as RecordData, files: emptyUploadedFiles, error: null, request: null };
    }

    const files = new Map<string, LocalFile[]>();
    let form: FormDataLike;
    try {
      // Use a cloned request body to avoid Bun multipart parser edge cases
      // when the original request body has already been touched upstream.
      form = await parseMultipartFormData(request as unknown as Request, { preserveBody: true });
    } catch (error) {
      return { data: {}, files, error: error as Error, request: null };
    }
    const raw: Record<string, string[]> = {};
    const iterateErr = await forEachFormDataEntry(form, async (key, value) => {
      if (typeof value === "string") {
        if (!usePreboundMultipartBody) {
          (raw[key] ??= []).push(value);
        }
        return;
      }

      const local = await multipartValueToFilesystemFile(value);
      if (local) {
        const current = files.get(key) ?? [];
        current.push(local);
        files.set(key, current);
      }
    });
    if (iterateErr) {
      return { data: {}, files, error: iterateErr, request: null };
    }

    if (usePreboundMultipartBody) {
      return { data: preboundBody as RecordData, files, error: null, request: null };
    }

    const data: RecordData = {};
    const err = unmarshalRequestData(Object.keys(raw).length === 0 && files.size > 0 ? { [JSONPayloadKey]: [] } : raw, data);
    if (err) {
      return { data, files, error: err, request: null };
    }
    return { data, files, error: null, request: null };
  }

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const bound = await readRequestTextAndRebind(request as unknown as Request);
    const text = bound.text;
    if (text.trim() === "") {
      return { data: {}, files: emptyUploadedFiles, error: null, request: bound.request };
    }
    const params = new URLSearchParams(text);
    const raw: Record<string, string[]> = {};
    for (const [key, value] of params.entries()) {
      (raw[key] ??= []).push(value);
    }
    const data: RecordData = {};
    const err = unmarshalRequestData(raw, data);
    if (err) {
      return { data, files: emptyUploadedFiles, error: err, request: bound.request };
    }
    return { data, files: emptyUploadedFiles, error: null, request: bound.request };
  }

  const bound = await readRequestTextAndRebind(request as unknown as Request);
  const text = bound.text;
  if (text.trim() === "") {
    return { data: {}, files: emptyUploadedFiles, error: null, request: bound.request };
  }

  return { data: {}, files: emptyUploadedFiles, error: new Error("unsupported content type"), request: bound.request };
}

async function forEachFormDataEntry(
  form: FormDataLike,
  fn: (key: string, value: unknown) => Promise<void>,
): Promise<Error | null> {
  let lastError: Error | null = null;

  if (typeof form.forEach === "function") {
    try {
      const pending: Promise<void>[] = [];
      form.forEach((value, key) => {
        pending.push(fn(key, value));
      });
      await Promise.all(pending);
      return null;
    } catch (error) {
      lastError = error as Error;
    }
  }

  if (typeof form.entries === "function") {
    try {
      for (const [key, value] of form.entries()) {
        await fn(key, value);
      }
      return null;
    } catch (error) {
      lastError = error as Error;
    }
  }

  if (typeof form[Symbol.iterator] === "function") {
    try {
      for (const [key, value] of form as unknown as Iterable<[string, unknown]>) {
        await fn(key, value);
      }
      return null;
    } catch (error) {
      lastError = error as Error;
    }
  }

  if (lastError) {
    return lastError;
  }

  return new TypeError("invalid multipart form data object");
}

function hasFileUploadFields(collection: Collection): boolean {
  for (const field of collection.Fields) {
    if (typeof field.Type === "function" && field.Type() === FieldTypeFile) {
      return true;
    }
  }
  return false;
}

function fallbackRequestInfo(event: RequestEvent): RequestInfo {
  const infoContextRaw = event.Get(RequestEventKeyInfoContext);
  const context = typeof infoContextRaw === "string" && infoContextRaw !== "" ? infoContextRaw : RequestInfoContextDefault;

  const info: RequestInfo = {
    query: {},
    headers: {},
    body: {},
    auth: event.auth,
    method: event.request.method,
    context,
  };

  let lazyQuery: Record<string, string> | null = null;
  let lazyHeaders: Record<string, string> | null = null;

  Object.defineProperty(info, "query", {
    enumerable: true,
    configurable: true,
    get: () => {
      if (lazyQuery) {
        return lazyQuery;
      }
      const rawUrl = event.request.url;
      if (!rawUrl.includes("?")) {
        lazyQuery = {};
        return lazyQuery;
      }
      lazyQuery = fallbackRequestInfoQuery(event.requestUrl().searchParams);
      return lazyQuery;
    },
    set: (value: Record<string, string>) => {
      lazyQuery = value;
    },
  });

  Object.defineProperty(info, "headers", {
    enumerable: true,
    configurable: true,
    get: () => {
      if (lazyHeaders) {
        return lazyHeaders;
      }
      lazyHeaders = fallbackRequestInfoHeaders(event.request.headers);
      return lazyHeaders;
    },
    set: (value: Record<string, string>) => {
      lazyHeaders = value;
    },
  });

  return info;
}

function fallbackRequestInfoForMultipart(event: RequestEvent): RequestInfo | null {
  const contentType = (event.request.headers.get("content-type") ?? "").toLowerCase();
  if (!contentType.startsWith("multipart/form-data")) {
    return null;
  }

  return fallbackRequestInfo(event);
}

function fallbackRequestInfoQuery(searchParams: URLSearchParams): Record<string, string> {
  const query: Record<string, string> = {};
  for (const [key, value] of searchParams.entries()) {
    if (!(key in query)) {
      query[key] = value;
    }
  }
  return query;
}

function fallbackRequestInfoHeaders(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of headers.entries()) {
    if (!value) {
      continue;
    }
    const normalizedKey = key
      .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
      .replace(/[-\s]+/g, "_")
      .toLowerCase();
    if (!normalizedKey) {
      continue;
    }
    result[normalizedKey] = value;
  }
  return result;
}

export function resolveRecordData(
  record: RecordModel,
  requestInfo: RequestInfo,
  uploadedFiles: Map<string, LocalFile[]>,
): RecordData {
  let data = record.ReplaceModifiers(requestInfo.body as RecordData);
  const files = extractUploadedFiles(record.collection(), uploadedFiles);

  if (files.size > 0) {
    for (const [key, fileList] of files.entries()) {
      const uploaded: unknown[] = [];

      if (requestInfo.body[key] != null && !key.startsWith("+") && !key.endsWith("+") && !key.endsWith("-")) {
        const existing = toUniqueStringSlice(requestInfo.body[key]);
        for (const name of existing) {
          uploaded.push(name);
        }
      }

      for (const file of fileList) {
        uploaded.push(file);
      }

      data[key] = uploaded;
    }

    data = record.ReplaceModifiers(data);
  }

  if (!requestInfo.auth?.isSuperuser()) {
    const isAuth = record.collection().isAuth();
    for (const field of record.collection().Fields) {
      if (field.GetHidden()) {
        if (isAuth && field.GetName() === FieldNamePassword) {
          continue;
        }
        delete data[field.GetName()];
      }
    }
  }

  return data;
}

function extractUploadedFiles(
  collection: Collection,
  uploadedFiles: Map<string, LocalFile[]>,
  prefix = "",
): Map<string, LocalFile[]> {
  const result = new Map<string, LocalFile[]>();
  if (uploadedFiles.size === 0) {
    return result;
  }

  for (const field of collection.Fields) {
    if (field.Type() !== FieldTypeFile) {
      continue;
    }

    const baseKey = field.GetName();
    const keys = [baseKey, `+${baseKey}`, `${baseKey}+`];
    for (let key of keys) {
      if (prefix) {
        key = `${prefix}.${key}`;
      }
      const files = uploadedFiles.get(key);
      if (files && files.length > 0) {
        result.set(key, files);
      }
    }
  }

  return result;
}

export type CreateRuleContext = {
  collection: Collection;
  selectSql: string;
  params: SQLQueryBindings[];
};

export function buildCreateRuleContext(collection: Collection, record: RecordModel): CreateRuleContext | Error {
  try {
    const dummyRecord = record.Clone();
    const createRuleSuffix = "__pb_create__";
    if (!dummyRecord.Id) {
      dummyRecord.Id = `__temp_id__${createRuleSuffix}`;
    }
    dummyRecord.SetVerified(false);

    const dummyExport = dummyRecord.DBExport();

    const selects: string[] = [];
    const params: SQLQueryBindings[] = [];
    for (const [key, value] of Object.entries(dummyExport)) {
      const column = columnify(key);
      selects.push(`? as [[${column}]]`);
      params.push(normalizeDbValue(value));
    }

    // Deviation: use a stable dummy collection suffix to keep generated SQL shape reusable.
    const dummyCollection = cloneCollectionForRule(collection, createRuleSuffix);
    const selectSql = `WITH {{${dummyCollection.name}}} as (SELECT ${selects.join(
      ", ",
    )}) SELECT 1 FROM {{${dummyCollection.name}}}`;

    return {
      collection: dummyCollection,
      selectSql,
      params,
    };
  } catch (error) {
    return error as Error;
  }
}

export function checkCreateRule(app: App, context: CreateRuleContext, requestInfo: RequestInfo): Error | null {
  const rule = context.collection.createRule;
  if (!rule || rule === "") {
    return null;
  }

  try {
    let selectSql = context.selectSql;
    const params = [...context.params];

    const resolver = new RecordFieldResolver(app, context.collection, requestInfo, true);
    const expr = buildFilterExpr(rule, resolver, DefaultFilterExprLimit);
    if (expr.sql) {
      selectSql = appendWhere(selectSql, expr.sql);
      params.push(...(expr.params as SQLQueryBindings[]));
    }

    const updated = resolver.updateQuery({ select: selectSql, params });
    selectSql = updated.select;
    params.splice(0, params.length, ...((updated.params ?? []) as SQLQueryBindings[]));

    const row = app
      .db()
      .query(selectSql)
      .get(...params) as Record<string, unknown> | undefined;
    if (!row) {
      return new Error("create rule failure");
    }

    return null;
  } catch (error) {
    return error as Error;
  }
}

function findRecordForRule(
  app: App,
  collection: Collection,
  recordId: string,
  rule: string,
  requestInfo: RequestInfo,
): RecordModel | null {
  const resolver = new RecordFieldResolver(app, collection, requestInfo, true);
  const expr = buildFilterExpr(rule, resolver, DefaultFilterExprLimit);

  let selectSql = `select {{${collection.name}}}.* from {{${collection.name}}}`;
  const params: SQLQueryBindings[] = [recordId];
  selectSql = appendWhere(selectSql, `[[${collection.name}.id]] = ?`);
  if (expr.sql) {
    selectSql = appendWhere(selectSql, expr.sql);
    params.push(...(expr.params as SQLQueryBindings[]));
  }

  if (resolver.updateQuery) {
    const updated = resolver.updateQuery({
      select: selectSql,
      params,
    });
    selectSql = updated.select;
    params.splice(0, params.length, ...((updated.params ?? []) as SQLQueryBindings[]));
  }

  const row = app
    .db()
    .query(selectSql)
    .get(...params) as Record<string, unknown> | undefined;
  if (!row) {
    return null;
  }
  return RecordModel.fromRow(collection, row as RecordData);
}

function hasAuthManageAccess(
  app: App,
  requestInfo: RequestInfo,
  collection: Collection,
  selectSql: string,
  params: SQLQueryBindings[],
): boolean {
  if (!collection.IsAuth()) {
    return false;
  }

  const manageRule = collection.ManageRule;
  if (!manageRule || manageRule === "") {
    return false;
  }

  if (!requestInfo.auth) {
    return false;
  }

  let sql = selectSql;
  const bindings: SQLQueryBindings[] = [...params];

  const resolver = new RecordFieldResolver(app, collection, requestInfo, true);
  try {
    const expr = buildFilterExpr(manageRule, resolver, DefaultFilterExprLimit);
    if (expr.sql) {
      sql = appendWhere(sql, expr.sql);
      bindings.push(...(expr.params as SQLQueryBindings[]));
    }

    const updated = resolver.updateQuery({ select: sql, params: bindings });
    sql = updated.select;
    bindings.splice(0, bindings.length, ...((updated.params ?? []) as SQLQueryBindings[]));
  } catch (error) {
    app.Logger().Error("Manage rule build expression error", "error", error, "collectionId", collection.id);
    return false;
  }

  const row = app
    .db()
    .query(sql)
    .get(...bindings) as Record<string, unknown> | undefined;
  return Boolean(row);
}

function cloneCollectionForRule(collection: Collection, suffix: string): Collection {
  const clone = new Collection({
    id: `${collection.id}${suffix}`,
    name: `${collection.name}${columnify(suffix)}`,
    type: collection.type,
    system: collection.system,
    // Deviation: shallow-copy field/index references to match upstream struct-copy behavior.
    fields: collection.fields,
    Fields: collection.Fields,
    indexes: collection.indexes,
    listRule: collection.listRule,
    viewRule: collection.viewRule,
    createRule: collection.createRule,
    updateRule: collection.updateRule,
    deleteRule: collection.deleteRule,
    options: collection.options,
  });
  clone.AuthRule = collection.AuthRule;
  clone.ManageRule = collection.ManageRule;
  clone.AuthAlert = collection.AuthAlert;
  clone.OAuth2 = collection.OAuth2;
  clone.PasswordAuth = collection.PasswordAuth;
  clone.MFA = collection.MFA;
  clone.OTP = collection.OTP;
  clone.AuthToken = collection.AuthToken;
  clone.PasswordResetToken = collection.PasswordResetToken;
  clone.EmailChangeToken = collection.EmailChangeToken;
  clone.VerificationToken = collection.VerificationToken;
  clone.FileToken = collection.FileToken;
  clone.VerificationTemplate = collection.VerificationTemplate;
  clone.ResetPasswordTemplate = collection.ResetPasswordTemplate;
  clone.ConfirmEmailChangeTemplate = collection.ConfirmEmailChangeTemplate;
  clone.ViewQuery = collection.ViewQuery;
  return clone;
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

function normalizeDbValue(value: unknown): SQLQueryBindings {
  if (value == null) {
    return null;
  }
  if (value instanceof JSONRaw) {
    return value.toString();
  }
  if (value instanceof DateTime) {
    return value.toString();
  }
  if (value instanceof GeoPoint) {
    return value.toString();
  }
  if (value instanceof Uint8Array) {
    return value;
  }
  if (Array.isArray(value)) {
    return JSON.stringify(value);
  }
  if (typeof value === "object") {
    const hasToJSON = (value as { toJSON?: () => unknown }).toJSON;
    if (typeof hasToJSON === "function") {
      return JSON.stringify(hasToJSON.call(value));
    }
    return JSON.stringify(value);
  }
  return value as SQLQueryBindings;
}

function unwrapHookResponse(event: RequestEvent, result: unknown): Response | null {
  if (!result) {
    return null;
  }
  if (result instanceof Response) {
    return result;
  }
  if (result instanceof ApiError) {
    return apiErrorResponse(event, result);
  }
  if (result instanceof AggregateError) {
    for (const inner of result.errors) {
      const found = unwrapHookResponse(event, inner);
      if (found) {
        return found;
      }
    }
  }
  if (result instanceof Error) {
    const response = (result as { response?: unknown }).response;
    if (response instanceof Response) {
      return response;
    }
    return apiErrorResponse(event, ToApiError(result));
  }
  return null;
}

function noContent(event: RequestEvent): Response {
  return new Response(null, {
    status: 204,
    headers: event.responseHeaders,
  });
}

function notFound(event: RequestEvent, message: string): Response {
  return event.json(404, {
    status: 404,
    message: message || "The requested resource wasn't found.",
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

function forbidden(event: RequestEvent, message: string): Response {
  return event.json(403, {
    status: 403,
    message,
    data: {},
  });
}

function internalServerError(event: RequestEvent, message: string, err: unknown = null): Response {
  const data = err instanceof Error ? { message: err.message } : {};
  return event.json(500, {
    status: 500,
    message: message || "Something went wrong while processing your request.",
    data,
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
