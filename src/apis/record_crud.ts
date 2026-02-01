// Ported from pocketbase/apis/record_crud.go
// Note: record upsert form logic (auth manage rules, file handling parity) is not yet ported.

import type { SQLQueryBindings } from "bun:sqlite";
import type { App } from "../core/app.ts";
import type { RequestEvent, RequestInfo } from "../core/event_request.ts";
import type { RouterGroup } from "../tools/router/group.ts";
import { Collection } from "../core/collection.ts";
import { RequestInfoContextOAuth2 } from "../core/event_request.ts";
import { RecordRequestEvent, RecordsListRequestEvent } from "../core/events.ts";
import { FieldTypeFile } from "../core/field_file.ts";
import { PasswordFieldValue } from "../core/field_password.ts";
import { FieldNamePassword, NewRecord, Record as RecordModel, type RecordData } from "../core/record.ts";
import { RecordFieldResolver } from "../core/record_field_resolver.ts";
import { RecordUpsert } from "../forms/record_upsert.ts";
import { ValidationError, ValidationErrors } from "../internal/compat/validation.ts";
import { NewFileFromBytes, type File as LocalFile } from "../tools/filesystem/file.ts";
import { columnify } from "../tools/inflector/inflector.ts";
import { toUniqueStringSlice } from "../tools/list/list.ts";
import { JSONPayloadKey, unmarshalRequestData } from "../tools/router/unmarshal_request_data.ts";
import { buildFilterExpr } from "../tools/search/filter.ts";
import { Provider } from "../tools/search/provider.ts";
import { DefaultFilterExprLimit } from "../tools/search/types.ts";
import { randomString } from "../tools/security/random.ts";
import { DateTime, GeoPoint, JSONRaw } from "../tools/types/index.ts";
import { checkForSuperuserOnlyRuleFields } from "./record_helpers.ts";

type RecordsListResult = {
  page: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
  items: Record<string, unknown>[];
};

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

export function bindRecordCrudApi(app: App, rg: RouterGroup<RequestEvent>): void {
  const group = rg.group("/collections/{collection}/records");
  group.get("", (event) => recordsList(app, event));
  group.get("/{id}", (event) => recordView(app, event));
  group.post("", (event) => recordCreate(app, event));
  group.patch("/{id}", (event) => recordUpdate(app, event));
  group.delete("/{id}", (event) => recordDelete(app, event));
}

async function recordsList(app: App, event: RequestEvent): Promise<Response> {
  const collectionId = event.params.collection ?? "";
  const collection = app.findCollectionByNameOrId(collectionId);
  if (!collection) {
    return notFound(event, "Missing collection context.");
  }

  const hookEvent = new RecordsListRequestEvent(event, collection);

  const out = await app.OnRecordsListRequest().Trigger(hookEvent, async () => {
    const requestInfo = await event.requestInfo();

    if (collection.listRule === null && !requestInfo.auth?.isSuperuser()) {
      return forbidden(event, "Only superusers can perform this action.");
    }

    const superuserFieldError = checkForSuperuserOnlyRuleFields(requestInfo);
    if (superuserFieldError) {
      return forbidden(event, superuserFieldError);
    }

    const resolver = new RecordFieldResolver(app, collection, requestInfo, true);

    let selectSql = `select * from {{${collection.name}}}`;
    let countSql = `select count(distinct [[${collection.name}.id]]) as total from {{${collection.name}}}`;
    if (collection.type !== "view") {
      countSql = `select count(distinct [[${collection.name}]].[[_rowid_]]) as total from {{${collection.name}}}`;
    }
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
      const records = result.items.map((row) => new RecordModel(collection, row));
      const response: RecordsListResult = {
        ...result,
        items: records.map((record) => record.publicExport()),
      };
      hookEvent.Records = records;
      hookEvent.Result = result;
      return event.json(200, response);
    } catch {
      return badRequest(event, "");
    }
  });

  if (out instanceof Response) {
    return out;
  }

  return badRequest(event, "");
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
    if (!requestInfo.auth?.isSuperuser() && collection.viewRule && collection.viewRule !== "") {
      const resolver = new RecordFieldResolver(app, collection, requestInfo, true);
      const ruleExpr = buildFilterExpr(collection.viewRule, resolver, DefaultFilterExprLimit);

      let selectSql = `select * from {{${collection.name}}}`;
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

      const record = new RecordModel(collection, row);
      const hookEvent = new RecordRequestEvent(event, collection, record);
      const out = await app.OnRecordViewRequest().Trigger(hookEvent, async () => {
        return event.json(200, record.publicExport());
      });

      if (out instanceof Response) {
        return out;
      }

      return event.json(200, record.publicExport());
    }

    const record = app.findRecordById(collection, recordId);
    if (!record) {
      return notFound(event, "");
    }

    const hookEvent = new RecordRequestEvent(event, collection, record);
    const out = await app.OnRecordViewRequest().Trigger(hookEvent, async () => {
      return event.json(200, record.publicExport());
    });

    if (out instanceof Response) {
      return out;
    }

    return event.json(200, record.publicExport());
  } catch {
    return notFound(event, "");
  }
}

async function recordCreate(app: App, event: RequestEvent): Promise<Response> {
  const collectionId = event.params.collection ?? "";
  const collection = app.findCollectionByNameOrId(collectionId);
  if (!collection) {
    return notFound(event, "Missing collection context.");
  }

  if (collection.isView()) {
    return badRequest(event, "Unsupported collection type.", null);
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

  if (!hasSuperuser && collection.createRule && collection.createRule !== "") {
    const ruleErr = checkCreateRule(app, collection, record, requestInfo);
    if (ruleErr) {
      return badRequest(event, "Failed to create record", ruleErr);
    }
  }

  const hookEvent = new RecordRequestEvent(event, collection, record);
  const out = await app.OnRecordCreateRequest().Trigger(hookEvent, async () => {
    const recordRef = hookEvent.Record ?? record;
    form.SetApp(hookEvent.App);
    form.SetRecord(recordRef);

    const submitErr = form.Submit();
    if (submitErr) {
      return badRequest(event, "Failed to create record.", submitErr);
    }

    return event.json(200, recordRef.publicExport());
  });

  if (out instanceof Response) {
    return out;
  }

  return event.json(200, record.publicExport());
}

async function recordUpdate(app: App, event: RequestEvent): Promise<Response> {
  const collectionId = event.params.collection ?? "";
  const collection = app.findCollectionByNameOrId(collectionId);
  if (!collection) {
    return notFound(event, "Missing collection context.");
  }

  if (collection.isView()) {
    return badRequest(event, "Unsupported collection type.", null);
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

  const hookEvent = new RecordRequestEvent(event, collection, record);
  const out = await app.OnRecordUpdateRequest().Trigger(hookEvent, async () => {
    const recordRef = hookEvent.Record ?? record;
    form.SetApp(hookEvent.App);
    form.SetRecord(recordRef);

    const submitErr = form.Submit();
    if (submitErr) {
      return badRequest(event, "Failed to update record.", submitErr);
    }

    return event.json(200, recordRef.publicExport());
  });

  if (out instanceof Response) {
    return out;
  }

  return event.json(200, record.publicExport());
}

async function recordDelete(app: App, event: RequestEvent): Promise<Response> {
  const collectionId = event.params.collection ?? "";
  const collection = app.findCollectionByNameOrId(collectionId);
  if (!collection) {
    return notFound(event, "Missing collection context.");
  }

  if (collection.isView()) {
    return badRequest(event, "Unsupported collection type.", null);
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
    const deleteErr = app.Delete(recordRef);
    if (deleteErr) {
      return badRequest(
        event,
        "Failed to delete record. Make sure that the record is not part of a required relation reference.",
        deleteErr,
      );
    }

    return noContent(event);
  });

  if (out instanceof Response) {
    return out;
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

export function checkCreateRule(app: App, collection: Collection, record: RecordModel, requestInfo: RequestInfo): Error | null {
  const rule = collection.createRule;
  if (!rule || rule === "") {
    return null;
  }
  try {
    const dummyRecord = record.Clone();
    const randomPart = `__pb_create__${randomString(6)}`;
    if (!dummyRecord.Id) {
      dummyRecord.Id = `__temp_id__${randomPart}`;
    }
    dummyRecord.SetVerified(false);

    const dummyExport = dummyRecord.DBExport();

    const entries = Object.entries(dummyExport);
    const selects: string[] = [];
    const params: unknown[] = [];
    for (const [key, value] of entries) {
      const column = columnify(key);
      selects.push(`? as [[${column}]]`);
      params.push(normalizeDbValue(value));
    }

    const dummyCollection = cloneCollectionForRule(collection, randomPart);
    let selectSql = `WITH {{${dummyCollection.name}}} as (SELECT ${selects.join(
      ", ",
    )}) SELECT 1 FROM {{${dummyCollection.name}}}`;

    const resolver = new RecordFieldResolver(app, dummyCollection, requestInfo, true);
    const expr = buildFilterExpr(rule, resolver, DefaultFilterExprLimit);
    if (expr.sql) {
      selectSql = appendWhere(selectSql, expr.sql);
      params.push(...expr.params);
    }

    if (resolver.updateQuery) {
      const updated = resolver.updateQuery({ select: selectSql, params });
      selectSql = updated.select;
      params.splice(0, params.length, ...(updated.params ?? []));
    }

    const row = app
      .db()
      .query(selectSql)
      .get(...(params as SQLQueryBindings[]));
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

  let selectSql = `select * from {{${collection.name}}}`;
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
  return new RecordModel(collection, row);
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

function appendWhere(baseSql: string, clause: string): string {
  if (!clause) {
    return baseSql;
  }
  if (/\bwhere\b/i.test(baseSql)) {
    return `${baseSql} AND ${clause}`;
  }
  return `${baseSql} WHERE ${clause}`;
}
