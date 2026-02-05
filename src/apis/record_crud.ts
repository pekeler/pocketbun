// Ported from pocketbase/apis/record_crud.go
// Note: record upsert form logic (file handling parity) is not yet ported.

import type { SQLQueryBindings } from "bun:sqlite";
import type { App } from "../core/app.ts";
import type { RequestEvent, RequestInfo } from "../core/event_request.ts";
import type { RouterGroup } from "../tools/router/group.ts";
import { Collection } from "../core/collection_model.ts";
import { RequestInfoContextOAuth2 } from "../core/event_request.ts";
import { RecordRequestEvent, RecordsListRequestEvent } from "../core/events.ts";
import { FieldTypeFile } from "../core/field_file.ts";
import { PasswordFieldValue } from "../core/field_password.ts";
import { RecordFieldResolver } from "../core/record_field_resolver.ts";
import { FieldNamePassword, NewRecord, Record as RecordModel, type RecordData } from "../core/record_model.ts";
import { RecordUpsert } from "../forms/record_upsert.ts";
import { ValidationError, ValidationErrors } from "../internal/compat/validation.ts";
import { NewFileFromBytes, type File as LocalFile } from "../tools/filesystem/file.ts";
import { columnify } from "../tools/inflector/inflector.ts";
import { toUniqueStringSlice } from "../tools/list/list.ts";
import { profileEnabled, recordProfile } from "../tools/perf/profile.ts";
import { ApiError, ToApiError, apiErrorResponse } from "../tools/router/api_error.ts";
import { JSONPayloadKey, unmarshalRequestData } from "../tools/router/unmarshal_request_data.ts";
import { buildFilterExpr } from "../tools/search/filter.ts";
import { Provider } from "../tools/search/provider.ts";
import { DefaultFilterExprLimit, type SearchResult } from "../tools/search/types.ts";
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
};

type RequestLike = {
  headers: { get: (name: string) => string | null };
  body: unknown;
  text: () => Promise<string>;
  formData: () => Promise<{ entries: () => IterableIterator<[string, unknown]> }>;
};

function findCachedCollection(app: App, identifier: string): Collection | null {
  try {
    return app.FindCachedCollectionByNameOrId(identifier);
  } catch {
    return null;
  }
}

// bindRecordCrudApi registers the record crud api endpoints and
// the corresponding handlers.
//
// note: the rate limiter is "inlined" because some of the crud actions are also used in the batch APIs
export function bindRecordCrudApi(app: App, rg: RouterGroup<RequestEvent>): void {
  const group = rg.group("/collections/{collection}/records").unbind(DefaultRateLimitMiddlewareId);
  group.get("", (event) => recordsList(app, event));
  group.get("/{id}", (event) => recordView(app, event));
  group.post("", (event) => recordCreate(app, event)).Bind(dynamicCollectionBodyLimit(""));
  group.patch("/{id}", (event) => recordUpdate(app, event)).Bind(dynamicCollectionBodyLimit(""));
  group.delete("/{id}", (event) => recordDelete(app, event));
}

async function recordsList(app: App, event: RequestEvent): Promise<Response> {
  const doProfile = profileEnabled();
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
    const query = event.requestUrl().searchParams.toString();
    const queryStart = doProfile ? performance.now() : 0;
    const rawResult = provider.parseAndExec<Record<string, unknown>>(query, app.db());
    if (doProfile) {
      recordProfile("records_list.query", performance.now() - queryStart);
    }
    records = rawResult.items.map((row) => RecordModel.fromRow(collection, row as RecordData));
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

  const out = await app.OnRecordsListRequest().Trigger(hookEvent, async () => {
    const enrichStart = doProfile ? performance.now() : 0;
    const enrichErr = await EnrichRecords(event, hookEvent.Records);
    if (doProfile) {
      recordProfile("records_list.enrich", performance.now() - enrichStart);
    }
    if (enrichErr) {
      return internalServerError(event, "Failed to enrich records", enrichErr);
    }

    if (!hookEvent.Result) {
      hookEvent.Result = {
        ...result,
        items: hookEvent.Records,
      };
    }

    const responseStart = doProfile ? performance.now() : 0;
    const response = event.json(200, hookEvent.Result);
    if (doProfile) {
      recordProfile("records_list.response", performance.now() - responseStart);
    }
    return response;
  });

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

    const hookEvent = new RecordRequestEvent(event, collection, record);
    const out = await app.OnRecordViewRequest().Trigger(hookEvent, async () => {
      const recordRef = hookEvent.Record ?? record;
      const enrichErr = await EnrichRecord(event, recordRef);
      if (enrichErr) {
        return internalServerError(event, "Failed to enrich record", enrichErr);
      }
      return event.json(200, recordRef.publicExport());
    });

    const viewResponse = unwrapHookResponse(event, out);
    if (viewResponse) {
      return viewResponse;
    }

    const recordRef = hookEvent.Record ?? record;
    const enrichErr = await EnrichRecord(event, recordRef);
    if (enrichErr) {
      return internalServerError(event, "Failed to enrich record", enrichErr);
    }

    return event.json(200, recordRef.publicExport());
  } catch {
    return badRequest(event, "");
  }
}

export async function recordCreate(app: App, event: RequestEvent): Promise<Response> {
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

  const parsed = await parseRequestData(event.request.clone());
  if (parsed.error) {
    return badRequest(event, "Failed to read the submitted data.", parsed.error);
  }

  const requestInfo = await event.requestInfo();
  const hasSuperuser = Boolean(requestInfo.auth?.isSuperuser());

  if (!hasSuperuser && collection.createRule === null) {
    return forbidden(event, "Only superusers can perform this action.");
  }

  const record = NewRecord(collection);

  requestInfo.body = parsed.data;
  let data = resolveRecordData(record, requestInfo, parsed.files);
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
  form.Load(data);

  if (skipPlainPasswordRecordValidators) {
    const raw = record.GetRaw(FieldNamePassword);
    if (raw instanceof PasswordFieldValue) {
      raw.Plain = "";
    }
  }

  if (!hasSuperuser && collection.createRule !== null) {
    const createContext = buildCreateRuleContext(collection, record);
    if (createContext instanceof Error) {
      return badRequest(event, "Failed to create record", createContext);
    }

    if (collection.createRule && collection.createRule !== "") {
      const ruleErr = checkCreateRule(app, createContext, requestInfo);
      if (ruleErr) {
        return badRequest(event, "Failed to create record", ruleErr);
      }
    }

    if (
      !form.HasManageAccess() &&
      hasAuthManageAccess(app, requestInfo, createContext.collection, createContext.selectSql, createContext.params)
    ) {
      form.GrantManagerAccess();
    }
  }

  const hookEvent = new RecordRequestEvent(event, collection, record);
  const out = await app.OnRecordCreateRequest().Trigger(hookEvent, async () => {
    const recordRef = hookEvent.Record ?? record;
    form.SetApp(hookEvent.App);
    form.SetRecord(recordRef);

    const submitErr = await form.Submit();
    if (submitErr) {
      return badRequest(event, "Failed to create record.", submitErr);
    }

    const enrichErr = await EnrichRecord(event, recordRef);
    if (enrichErr) {
      return internalServerError(event, "Failed to enrich record", enrichErr);
    }

    return event.json(200, recordRef.publicExport());
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

export async function recordUpdate(app: App, event: RequestEvent): Promise<Response> {
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

  const parsed = await parseRequestData(event.request.clone());
  if (parsed.error) {
    return badRequest(event, "Failed to read the submitted data.", parsed.error);
  }

  const requestInfo = await event.requestInfo();
  const hasSuperuser = Boolean(requestInfo.auth?.isSuperuser());

  if (!hasSuperuser && collection.updateRule === null) {
    return forbidden(event, "Only superusers can perform this action.");
  }

  const baseRecord = app.findRecordById(collection, recordId);
  if (!baseRecord) {
    return notFound(event, "");
  }

  requestInfo.body = parsed.data;
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
  form.Load(data);
  if (!form.HasManageAccess()) {
    let manageSelect = `select 1 from {{${collection.name}}}`;
    const manageParams: SQLQueryBindings[] = [record.Id];
    manageSelect = appendWhere(manageSelect, `[[${collection.name}.id]] = ?`);
    if (hasAuthManageAccess(app, requestInfo, collection, manageSelect, manageParams)) {
      form.GrantManagerAccess();
    }
  }

  const hookEvent = new RecordRequestEvent(event, collection, record);
  const out = await app.OnRecordUpdateRequest().Trigger(hookEvent, async () => {
    const recordRef = hookEvent.Record ?? record;
    form.SetApp(hookEvent.App);
    form.SetRecord(recordRef);

    const submitErr = await form.Submit();
    if (submitErr) {
      return badRequest(event, "Failed to update record.", submitErr);
    }

    const enrichErr = await EnrichRecord(event, recordRef);
    if (enrichErr) {
      return internalServerError(event, "Failed to enrich record", enrichErr);
    }

    return event.json(200, recordRef.publicExport());
  });

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

export async function recordDelete(app: App, event: RequestEvent): Promise<Response> {
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

  const hookEvent = new RecordRequestEvent(event, collection, record);
  const out = await app.OnRecordDeleteRequest().Trigger(hookEvent, async () => {
    const recordRef = hookEvent.Record ?? record;
    const deleteErr = await app.Delete(recordRef);
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
  });

  const deleteResponse = unwrapHookResponse(event, out);
  if (deleteResponse) {
    return deleteResponse;
  }

  return noContent(event);
}

async function parseRequestData(request: RequestLike): Promise<ParsedRequestData> {
  const contentType = (request.headers.get("content-type") ?? "").toLowerCase();
  const files = new Map<string, LocalFile[]>();

  if (!request.body) {
    return { data: {}, files, error: null };
  }

  if (contentType.includes("application/json")) {
    const text = await request.text();
    if (text.trim() === "") {
      return { data: {}, files, error: null };
    }
    try {
      const parsed = JSON.parse(text) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return { data: {}, files, error: new Error("invalid json") };
      }
      return { data: parsed as RecordData, files, error: null };
    } catch (error) {
      return { data: {}, files, error: error as Error };
    }
  }

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const raw: Record<string, string[]> = {};

    for (const [key, value] of form.entries()) {
      if (typeof value === "string") {
        (raw[key] ??= []).push(value);
        continue;
      }

      const fileLike = value as { arrayBuffer?: () => Promise<ArrayBuffer>; name?: string };
      if (typeof fileLike.arrayBuffer === "function" && typeof fileLike.name === "string") {
        try {
          const buffer = new Uint8Array(await fileLike.arrayBuffer());
          const local = NewFileFromBytes(buffer, fileLike.name);
          const current = files.get(key) ?? [];
          current.push(local);
          files.set(key, current);
        } catch (error) {
          return { data: {}, files, error: error as Error };
        }
      }
    }

    const data: RecordData = {};
    const err = unmarshalRequestData(Object.keys(raw).length === 0 && files.size > 0 ? { [JSONPayloadKey]: [] } : raw, data);
    if (err) {
      return { data, files, error: err };
    }
    return { data, files, error: null };
  }

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const text = await request.text();
    if (text.trim() === "") {
      return { data: {}, files, error: null };
    }
    const params = new URLSearchParams(text);
    const raw: Record<string, string[]> = {};
    for (const [key, value] of params.entries()) {
      (raw[key] ??= []).push(value);
    }
    const data: RecordData = {};
    const err = unmarshalRequestData(raw, data);
    if (err) {
      return { data, files, error: err };
    }
    return { data, files, error: null };
  }

  const text = await request.text();
  if (text.trim() === "") {
    return { data: {}, files, error: null };
  }

  return { data: {}, files, error: new Error("unsupported content type") };
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
    const randomPart = `__pb_create__${randomString(6)}`;
    if (!dummyRecord.Id) {
      dummyRecord.Id = `__temp_id__${randomPart}`;
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

    const dummyCollection = cloneCollectionForRule(collection, randomPart);
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
    fields: collection.fields,
    Fields: collection.Fields.Clone(),
    indexes: [...collection.indexes],
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
