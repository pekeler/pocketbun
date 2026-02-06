// Ported from pocketbase/apis/record_helpers.go

import type { SQLQueryBindings } from "bun:sqlite";
import type { App } from "../core/app.ts";
import type { Collection } from "../core/collection_model.ts";
import type { RequestEvent, RequestInfo } from "../core/event_request.ts";
import { NewAuthOrigin } from "../core/auth_origin_model.ts";
import { RequestInfoContextExpand } from "../core/event_request.ts";
import { RecordAuthRequestEvent, RecordEnrichEvent } from "../core/events.ts";
import { NewMFA } from "../core/mfa_model.ts";
import { RecordFieldResolver } from "../core/record_field_resolver.ts";
import { Record as RecordModel } from "../core/record_model.ts";
import { SendRecordAuthAlert } from "../mails/record.ts";
import { buildFilterExpr } from "../tools/search/filter.ts";
import { DefaultFilterExprLimit, FilterQueryParam, SortQueryParam } from "../tools/search/types.ts";
import { MD5 } from "../tools/security/crypto.ts";
import { NowDateTime } from "../tools/types/index.ts";

const expandQueryParam = "expand";

export const ErrMFA = new Error("mfa required");

// Ported from pocketbase/apis/record_helpers.go (simplified for Bun response flow).
export async function execAfterSuccessTx(
  _checkTx: boolean,
  _app: App,
  fn: () => Response | Promise<Response>,
): Promise<Response> {
  return await fn();
}

const ruleQueryParams = [FilterQueryParam, SortQueryParam];
const superuserOnlyRuleFields = ["@collection.", "@request."];

// checkForSuperuserOnlyRuleFields loosely checks and returns an error if
// the provided RequestInfo contains rule fields that only the superuser can use.
export function checkForSuperuserOnlyRuleFields(requestInfo: RequestInfo): string | null {
  if (requestInfo.auth?.isSuperuser()) {
    return null;
  }

  let hasQuery = false;
  for (const _key in requestInfo.query) {
    hasQuery = true;
    break;
  }

  if (!hasQuery) {
    return null;
  }

  for (const param of ruleQueryParams) {
    const value = requestInfo.query[param];
    if (!value) {
      continue;
    }

    for (const field of superuserOnlyRuleFields) {
      if (value.includes(field)) {
        return `Only superusers can filter by ${field}`;
      }
    }
  }

  return null;
}

export async function RecordAuthResponse(
  event: RequestEvent,
  authRecord: RecordModel,
  authMethod: string,
  meta: unknown,
): Promise<Response> {
  let token = "";
  try {
    token = authRecord.NewAuthToken();
  } catch (error) {
    return internalServerError(event, "Failed to create auth token.", error);
  }

  return RecordAuthResponseWithToken(event, authRecord, token, authMethod, meta);
}

export async function RecordAuthResponseWithToken(
  event: RequestEvent,
  authRecord: RecordModel,
  token: string,
  authMethod: string,
  meta: unknown,
): Promise<Response> {
  const originalRequestInfo = await event.requestInfo();

  const [ok, accessErr] = event.app.CanAccessRecord(authRecord, originalRequestInfo, authRecord.collection().AuthRule);
  if (!ok) {
    if (accessErr) {
      return internalServerError(event, "The request doesn't satisfy the collection requirements to authenticate.", accessErr);
    }
    return forbidden(event, "The request doesn't satisfy the collection requirements to authenticate.");
  }

  const hookEvent = new RecordAuthRequestEvent(event, authRecord.collection(), authRecord);
  hookEvent.Token = token;
  hookEvent.Meta = meta;
  hookEvent.AuthMethod = authMethod;

  const out = await event.app.OnRecordAuthRequest().Trigger(hookEvent, async () => {
    const mfaResult = await checkMFA(event, authRecord, authMethod);
    if (mfaResult.response) {
      return mfaResult.response;
    }

    if (mfaResult.mfaId) {
      return event.json(401, { mfaId: mfaResult.mfaId });
    }

    const requestInfo: RequestInfo = {
      ...originalRequestInfo,
      auth: authRecord,
    };

    const enrichErr = triggerRecordEnrichHooks(event.app, requestInfo, [authRecord], () => {
      if (authRecord.isSuperuser()) {
        authRecord.Unhide(...authRecord.collection().Fields.FieldNames());
      }

      authRecord.IgnoreEmailVisibility(true);

      const expands = event.request.url.includes("?") ? event.requestUrl().searchParams.get(expandQueryParam) : null;
      const expandList = expands ? expands.split(",") : [];
      if (expandList.length > 0) {
        const failed = event.app.ExpandRecord(authRecord, expandList, expandFetch(event.app, requestInfo));
        if (Object.keys(failed).length > 0) {
          event.app.Logger().Warn("[recordAuthResponse] Failed to expand relations", failed);
        }
      }

      return null;
    });

    if (enrichErr) {
      return internalServerError(event, "Failed to apply auth record enrichments.", enrichErr);
    }

    if (authMethod && authRecord.collection().AuthAlert.Enabled) {
      const alertErr = await authAlert(event, authRecord);
      if (alertErr) {
        event.app.Logger().Warn("[recordAuthResponse] Failed to send login alert", "error", alertErr);
      }
    }

    const result: { meta?: unknown; record: RecordModel; token: string } = {
      token,
      record: authRecord,
    };
    if (meta != null) {
      result.meta = meta;
    }

    return event.json(200, result);
  });

  if (out instanceof Response) {
    return out;
  }

  return event.json(200, { token, record: authRecord, meta });
}

export async function EnrichRecord(
  event: RequestEvent,
  record: RecordModel,
  ...defaultExpands: string[]
): Promise<Error | null> {
  return EnrichRecords(event, [record], ...defaultExpands);
}

export async function EnrichRecords(
  event: RequestEvent,
  records: RecordModel[],
  ...defaultExpands: string[]
): Promise<Error | null> {
  if (records.length === 0) {
    return null;
  }

  const info = await event.requestInfo();

  return triggerRecordEnrichHooks(event.app, info, records, () => {
    let expands = defaultExpands;
    const queryExpand = info.query[expandQueryParam];
    if (queryExpand) {
      expands = expands.concat(queryExpand.split(","));
    }

    const err = defaultEnrichRecords(event.app, info, records, ...expands);
    if (err) {
      event.app.Logger().Warn("failed to apply default enriching", "error", err);
    }

    return null;
  });
}

export function triggerRecordEnrichHooks(
  app: App,
  requestInfo: RequestInfo,
  records: RecordModel[],
  finalizer: (() => Error | null) | null,
): Error | null {
  const hook = app.OnRecordEnrich();
  const event = new RecordEnrichEvent(app, requestInfo, null);

  const iterator = {
    index: 0,
    next(): RecordModel | null {
      if (this.index >= records.length) {
        return null;
      }
      const item = records[this.index] ?? null;
      this.index += 1;
      return item;
    },
  };

  const iterate = (record: RecordModel | null): Error | null => {
    if (!record) {
      return null;
    }

    event.Record = record;

    const result = hook.Trigger(event, (e) => {
      const next = iterator.next();
      if (!next) {
        return finalizer ? finalizer() : null;
      }

      const originalApp = event.App;
      event.App = e.App;
      event.Record = next;

      const err = iterate(next);

      event.App = originalApp;
      event.Record = record;

      return err;
    });

    return result instanceof Error ? result : null;
  };

  return iterate(iterator.next());
}

function defaultEnrichRecords(app: App, requestInfo: RequestInfo, records: RecordModel[], ...expands: string[]): Error | null {
  const flagsErr = autoResolveRecordsFlags(app, records, requestInfo);
  if (flagsErr) {
    return new Error(`failed to resolve records flags: ${flagsErr.message}`);
  }

  if (expands.length > 0) {
    const expandErrs = app.ExpandRecords(records, expands, expandFetch(app, requestInfo));
    if (Object.keys(expandErrs).length > 0) {
      return new Error("failed to expand records");
    }
  }

  return null;
}

// expandFetch is the records fetch function that is used to expand related records.
export function expandFetch(app: App, originalRequestInfo: RequestInfo) {
  const requestInfo: RequestInfo = {
    ...originalRequestInfo,
    context: RequestInfoContextExpand,
  };

  return (relCollection: Collection, relIds: string[]): RecordModel[] => {
    if (relIds.length === 0) {
      return [];
    }

    let records: RecordModel[] = [];
    if (requestInfo.auth && requestInfo.auth.isSuperuser()) {
      records = app.FindRecordsByIds(relCollection.Id, relIds);
    } else {
      if (relCollection.viewRule === null) {
        throw new Error(`only superusers can view collection ${JSON.stringify(relCollection.name)} records`);
      }

      let sql = `select {{${relCollection.name}}}.* from {{${relCollection.name}}}`;
      const params: SQLQueryBindings[] = [];
      sql = appendWhere(sql, inClause(`[[${relCollection.name}.id]]`, relIds.length));
      params.push(...relIds);

      if (relCollection.viewRule && relCollection.viewRule !== "") {
        const resolver = new RecordFieldResolver(app, relCollection, requestInfo, true);
        const expr = buildFilterExpr(relCollection.viewRule, resolver, DefaultFilterExprLimit);
        if (expr.sql) {
          sql = appendWhere(sql, expr.sql);
          params.push(...(expr.params as SQLQueryBindings[]));
        }

        const updated = resolver.updateQuery({ select: sql, params });
        sql = updated.select;
        params.splice(0, params.length, ...((updated.params ?? []) as SQLQueryBindings[]));
      }

      const rows = app
        .db()
        .query(sql)
        .all(...params) as Array<Record<string, unknown>>;
      records = rows.map((row) => RecordModel.fromRow(relCollection, row));
    }

    const enrichErr = triggerRecordEnrichHooks(app, requestInfo, records, () => {
      const err = autoResolveRecordsFlags(app, records, requestInfo);
      if (err) {
        app.Logger().Warn("Failed to apply autoResolveRecordsFlags for the expanded records", "error", err);
      }
      return null;
    });
    if (enrichErr) {
      throw enrichErr;
    }

    return records;
  };
}

// autoResolveRecordsFlags resolves various visibility flags of the provided records.
//
// Currently it enables:
// - export of hidden fields if the current auth model is a superuser
// - email export ignoring the emailVisibity checks if the current auth model is superuser, owner or a "manager".
//
// Note: Expects all records to be from the same collection!
function autoResolveRecordsFlags(app: App, records: RecordModel[], requestInfo: RequestInfo): Error | null {
  if (records.length === 0) {
    return null;
  }

  if (requestInfo.auth && requestInfo.auth.isSuperuser()) {
    const hiddenFields = records[0]?.collection().Fields.FieldNames() ?? [];
    for (const record of records) {
      record.Unhide(...hiddenFields);
      record.IgnoreEmailVisibility(true);
    }
  }

  const collection = records[0]?.collection();
  if (!collection || !collection.IsAuth()) {
    return null;
  }

  const mappedRecords = new Map<string, RecordModel>();
  const recordIds: string[] = [];
  for (const record of records) {
    mappedRecords.set(record.Id, record);
    recordIds.push(record.Id);
  }

  if (requestInfo.auth && mappedRecords.has(requestInfo.auth.Id)) {
    mappedRecords.get(requestInfo.auth.Id)?.IgnoreEmailVisibility(true);
  }

  if (!collection.ManageRule || collection.ManageRule === "") {
    return null;
  }

  let sql = `select [[${collection.name}.id]] as id from {{${collection.name}}}`;
  const params: SQLQueryBindings[] = [];
  sql = appendWhere(sql, inClause(`[[${collection.name}.id]]`, recordIds.length));
  params.push(...recordIds);

  const resolver = new RecordFieldResolver(app, collection, requestInfo, true);
  const expr = buildFilterExpr(collection.ManageRule, resolver, DefaultFilterExprLimit);
  if (expr.sql) {
    sql = appendWhere(sql, expr.sql);
    params.push(...(expr.params as SQLQueryBindings[]));
  }

  const updated = resolver.updateQuery({ select: sql, params });
  sql = updated.select;
  params.splice(0, params.length, ...((updated.params ?? []) as SQLQueryBindings[]));

  const rows = app
    .db()
    .query(sql)
    .all(...params) as Array<{ id?: string }>;
  for (const row of rows) {
    const id = row?.id;
    if (typeof id === "string") {
      mappedRecords.get(id)?.IgnoreEmailVisibility(true);
    }
  }

  return null;
}

async function wantsMFA(event: RequestEvent, record: RecordModel): Promise<[boolean, Error | null]> {
  const rule = record.collection().MFA.Rule;
  if (!rule) {
    return [true, null];
  }

  const requestInfo = await event.requestInfo();

  let sql = `select (1) as ok from {{${record.collection().name}}}`;
  const params: SQLQueryBindings[] = [];
  sql = appendWhere(sql, `[[${record.collection().name}.id]] = ?`);
  params.push(record.Id);

  const resolver = new RecordFieldResolver(event.app, record.collection(), requestInfo, true);
  try {
    const expr = buildFilterExpr(rule, resolver, DefaultFilterExprLimit);
    if (expr.sql) {
      sql = appendWhere(sql, expr.sql);
      params.push(...(expr.params as SQLQueryBindings[]));
    }

    const updated = resolver.updateQuery({ select: sql, params });
    sql = updated.select;
    params.splice(0, params.length, ...((updated.params ?? []) as SQLQueryBindings[]));
  } catch (error) {
    return [true, error as Error];
  }

  const row = event.app
    .db()
    .query(sql)
    .get(...params) as { ok?: number } | undefined;
  return [Boolean(row?.ok), null];
}

type MFAResult = { mfaId: string; response: Response | null };

async function checkMFA(event: RequestEvent, authRecord: RecordModel, currentAuthMethod: string): Promise<MFAResult> {
  if (!authRecord.collection().MFA.Enabled || !currentAuthMethod) {
    return { mfaId: "", response: null };
  }

  const [ok, err] = await wantsMFA(event, authRecord);
  if (err) {
    return { mfaId: "", response: badRequest(event, "Failed to authenticate.", err) };
  }
  if (!ok) {
    return { mfaId: "", response: null };
  }

  let mfaId = event.requestUrl().searchParams.get("mfaId") ?? "";
  if (!mfaId) {
    const data = { mfaId: "" };
    try {
      await event.bindBody(data);
    } catch (error) {
      return { mfaId: "", response: badRequest(event, "Failed to read MFA Id", error as Error) };
    }
    mfaId = data.mfaId;
  }

  if (!mfaId) {
    const mfa = NewMFA(event.app);
    mfa.SetCollectionRef(authRecord.collection().Id);
    mfa.SetRecordRef(authRecord.Id);
    mfa.SetMethod(currentAuthMethod);
    const saveErr = await event.app.Save(mfa);
    if (saveErr) {
      return { mfaId: "", response: internalServerError(event, "Failed to create MFA record", saveErr) };
    }
    return { mfaId: mfa.Id, response: null };
  }

  let mfa = null;
  try {
    mfa = event.app.FindMFAById(mfaId);
  } catch (_error) {
    mfa = null;
  }

  const deleteMFA = async () => {
    if (mfa) {
      const err = await event.app.Delete(mfa);
      if (err) {
        event.app.Logger().Warn("Failed to delete expired MFA record", "error", err, "mfaId", mfa.Id);
      }
    }
  };

  if (!mfa || mfa.HasExpired(authRecord.collection().MFA.DurationTime() * 1000)) {
    await deleteMFA();
    return { mfaId: "", response: badRequest(event, "Invalid or expired MFA session.") };
  }

  if (mfa.RecordRef() !== authRecord.Id || mfa.CollectionRef() !== authRecord.collection().Id) {
    return { mfaId: "", response: badRequest(event, "Invalid MFA session.") };
  }

  if (mfa.Method() === currentAuthMethod) {
    return { mfaId: "", response: badRequest(event, "A different authentication method is required.") };
  }

  await deleteMFA();

  return { mfaId: "", response: null };
}

const maxAuthOrigins = 5;

async function authAlert(event: RequestEvent, authRecord: RecordModel): Promise<Error | null> {
  const ip = event.realIP();

  let userAgent = event.request.headers.get("User-Agent") ?? "";
  if (userAgent.length > 200) {
    userAgent = `${userAgent.slice(0, 200)}...`;
  }

  const fingerprint = MD5(ip + userAgent);
  const alertInfo = `${NowDateTime().toString()} - ${ip} ${userAgent}`;

  let origins: ReturnType<App["FindAllAuthOriginsByRecord"]> = [];
  try {
    origins = event.app.FindAllAuthOriginsByRecord(authRecord);
  } catch (error) {
    return error as Error;
  }

  const isFirstLogin = origins.length === 0;

  let currentOrigin = origins.find((origin) => origin.Fingerprint() === fingerprint) ?? null;
  if (!currentOrigin) {
    currentOrigin = NewAuthOrigin(event.app);
    currentOrigin.SetCollectionRef(authRecord.collection().Id);
    currentOrigin.SetRecordRef(authRecord.Id);
    currentOrigin.SetFingerprint(fingerprint);
  }

  if (!isFirstLogin && currentOrigin.IsNew() && authRecord.Email() !== "") {
    const sendErr = await SendRecordAuthAlert(event.app, authRecord, alertInfo);
    if (sendErr) {
      return sendErr;
    }
  }

  if (currentOrigin.IsNew() && origins.length >= maxAuthOrigins) {
    for (let i = origins.length - 1; i >= maxAuthOrigins - 1; i -= 1) {
      const origin = origins[i];
      if (!origin) {
        continue;
      }
      const err = await event.app.Delete(origin);
      if (err) {
        event.app.Logger().Warn("Failed to delete old AuthOrigin record", "error", err, "authOriginId", origin.Id);
      }
    }
  }

  return await event.app.Save(currentOrigin);
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

function inClause(column: string, count: number): string {
  if (count <= 0) {
    return "1=0";
  }
  return `${column} IN (${Array.from({ length: count }, () => "?").join(", ")})`;
}

function badRequest(event: RequestEvent, message: string, errData: unknown = null): Response {
  return event.json(400, {
    status: 400,
    message: message || "Something went wrong while processing your request.",
    data: errData && errData instanceof Error ? { message: errData.message } : {},
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
  const data = err && err instanceof Error ? { message: err.message } : {};
  return event.json(500, {
    status: 500,
    message: message || "Something went wrong while processing your request.",
    data,
  });
}
