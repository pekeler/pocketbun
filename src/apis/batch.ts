// Ported from pocketbase/apis/batch.go

import type { App } from "../core/app.ts";
import type { RouterGroup } from "../tools/router/group.ts";
import { RequestEvent } from "../core/event_request.ts";
import { RequestEventKeyInfoContext, RequestInfoContextBatch, RequestInfoContextDefault } from "../core/event_request.ts";
import { BatchRequestEvent, InternalRequest } from "../core/event_request_batch.ts";
import { ValidationError, ValidationErrors, newError, ErrRequired } from "../internal/compat/validation.ts";
import { NewFileFromBytes, File as LocalFile } from "../tools/filesystem/file.ts";
import { JSONPayloadKey, unmarshalRequestData } from "../tools/router/unmarshal_request_data.ts";
import { forbidden } from "./api_errors.ts";
import { applyBodyLimit, DefaultBodyLimitMiddlewareId } from "./middlewares_body_limit.ts";
import { recordCreate, recordDelete, recordUpdate } from "./record_crud.ts";

type BatchRequestResult = {
  body: unknown;
  status: number;
};

type ApiErrorResponse = {
  status: number;
  message: string;
  data: Record<string, unknown>;
};

type StopSignal = { stopped: boolean; error?: BatchStopError };

type PreparedAction = {
  handler: (event: RequestEvent) => Promise<Response>;
  params: Record<string, string>;
  pattern: string;
};

type RequestFormData = Awaited<ReturnType<Request["formData"]>>;

export function bindBatchApi(app: App, rg: RouterGroup<RequestEvent>): void {
  const sub = rg.group("/batch");
  sub.post("", (event) => batchTransaction(app, event)).Unbind(DefaultBodyLimitMiddlewareId);
}

class BatchStopError extends Error {}

class InternalRequestError extends Error {
  response: ApiErrorResponse;

  constructor(message: string, response: ApiErrorResponse) {
    super(message);
    this.response = response;
  }
}

class BatchResponseError extends Error {
  code: string;
  response: ApiErrorResponse;

  constructor(response: ApiErrorResponse) {
    super("Batch request failed.");
    this.code = "batch_request_failed";
    this.response = response;
  }
}

async function batchTransaction(app: App, event: RequestEvent): Promise<Response> {
  const batchSettings = app.settings().batch;
  const maxRequests = batchSettings.maxRequests;
  if (!batchSettings.enabled || maxRequests <= 0) {
    return forbidden(event, "Batch requests are not allowed.");
  }

  const timeoutSeconds = batchSettings.timeout > 0 ? batchSettings.timeout : 3;
  const maxBodySize = batchSettings.maxBodySize > 0 ? batchSettings.maxBodySize : 128 << 20;

  const limitResponse = await applyBodyLimit(event, maxBodySize);
  if (limitResponse) {
    return limitResponse;
  }

  const parsed = await readBatchRequests(event.request);
  if (parsed.error) {
    return badBatchRequest(event, "Failed to read the submitted batch data.", parsed.error);
  }

  const requests = parsed.requests;

  if (parsed.form) {
    for (let i = 0; i < requests.length; i += 1) {
      const ir = requests[i];
      if (!ir) {
        continue;
      }
      const files = await extractPrefixedFiles(parsed.form, `requests.${i}.`, `requests[${i}].`);
      if (files.size === 0) {
        continue;
      }
      if (!ir.Body) {
        ir.Body = {};
      }
      for (const [key, value] of files.entries()) {
        ir.Body[key] = value;
      }
    }
  }

  const validationErr = validateBatchRequests(requests, maxRequests);
  if (validationErr) {
    return badBatchRequest(event, "Invalid batch request data.", validationErr);
  }

  const hookEvent = new BatchRequestEvent(event, requests);
  const out = await app.OnBatchRequest().Trigger(hookEvent, async () => {
    const processor = new BatchProcessor(app, hookEvent.RequestEvent, RequestInfoContextBatch);
    const err = await processor.Process(hookEvent.Batch, timeoutSeconds * 1000);
    if (err) {
      return badBatchRequest(event, "Batch transaction failed.", err);
    }
    return event.json(200, processor.results);
  });

  if (out instanceof Response) {
    return out;
  }

  return event.json(200, []);
}

class BatchProcessor {
  app: App;
  baseEvent: RequestEvent;
  infoContext: string;
  results: BatchRequestResult[] = [];

  constructor(app: App, baseEvent: RequestEvent, infoContext: string) {
    this.app = app;
    this.baseEvent = baseEvent;
    this.infoContext = infoContext;
  }

  async Process(batch: InternalRequest[], timeoutMs: number): Promise<Error | null> {
    this.results = [];

    const stopSignal: StopSignal = { stopped: false };

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    if (timeoutMs > 0) {
      timeoutId = setTimeout(() => {
        if (!stopSignal.stopped) {
          stopSignal.stopped = true;
          stopSignal.error = new BatchStopError("batch transaction timeout");
        }
      }, timeoutMs);
    }

    const abortSignal = this.baseEvent.request.signal;
    const onAbort = () => {
      if (!stopSignal.stopped) {
        stopSignal.stopped = true;
        stopSignal.error = new BatchStopError("batch request interrupted");
      }
    };
    if (abortSignal) {
      if (abortSignal.aborted) {
        onAbort();
      } else {
        abortSignal.addEventListener("abort", onAbort, { once: true });
      }
    }

    try {
      const txErr = await this.app.RunInTransactionAsync(async (txApp) => {
        for (let i = 0; i < batch.length; i += 1) {
          if (stopSignal.stopped && stopSignal.error) {
            return stopSignal.error;
          }

          const ir = batch[i];
          if (!ir) {
            continue;
          }

          try {
            const result = await processInternalRequest(
              txApp,
              this.baseEvent,
              ir,
              this.infoContext || RequestInfoContextDefault,
              stopSignal,
            );
            this.results.push(result);
          } catch (error) {
            if (error instanceof BatchStopError) {
              return error;
            }

            const response =
              error instanceof InternalRequestError
                ? error.response
                : toApiErrorResponse(error instanceof Error ? error : new Error("unknown error"));

            return new ValidationErrors({
              requests: new ValidationErrors({
                [String(i)]: new BatchResponseError(response),
              }),
            });
          }
        }
        return null;
      });

      return txErr ?? null;
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (abortSignal) {
        abortSignal.removeEventListener("abort", onAbort);
      }
    }
  }
}

async function processInternalRequest(
  app: App,
  baseEvent: RequestEvent,
  ir: InternalRequest,
  infoContext: string,
  stopSignal: StopSignal,
): Promise<BatchRequestResult> {
  const prepared = prepareInternalAction(app, ir);
  if (!prepared) {
    throw new InternalRequestError(
      "unknown batch request action",
      toApiErrorResponse(new Error("unknown batch request action")),
    );
  }

  const { handler, params, pattern } = prepared;

  const multipart = await multipartDataFromInternalRequest(ir);
  const baseUrl = new URL(baseEvent.request.url);
  const requestUrl = new URL(ir.URL, baseUrl.origin);
  const headers = new Headers(baseEvent.request.headers);

  for (const [key, value] of Object.entries(ir.Headers)) {
    if (key.toLowerCase() === "authorization") {
      continue;
    }
    headers.set(key, value);
  }

  headers.set("content-type", multipart.contentType);

  const request = new Request(requestUrl.toString(), {
    method: ir.Method.toUpperCase(),
    headers,
    body: multipart.body,
  });

  const event = new RequestEvent({
    app,
    request,
    params,
    remoteAddress: baseEvent.remoteIP() || null,
    pattern,
  });
  event.auth = baseEvent.auth;
  event.SetAll(baseEvent.GetAll());
  event.Set(RequestEventKeyInfoContext, infoContext || RequestInfoContextDefault);
  event.setStopSignal(stopSignal);

  let response: Response;
  try {
    const result = await handler(event);
    response = result instanceof Response ? result : new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof BatchStopError) {
      throw error;
    }
    throw new InternalRequestError(
      "batch request failed",
      toApiErrorResponse(error instanceof Error ? error : new Error("unknown error")),
    );
  }

  const bodyText = await response.text();
  const body = parseJsonBody(bodyText);

  if (response.status >= 400) {
    throw new InternalRequestError("batch request failed", normalizeApiErrorResponse(body, response.status));
  }

  return {
    status: response.status,
    body,
  };
}

function parseJsonBody(bodyText: string): unknown {
  const trimmed = bodyText.trim();
  if (trimmed === "") {
    return null;
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}

function normalizeApiErrorResponse(body: unknown, status: number): ApiErrorResponse {
  if (body && typeof body === "object" && !Array.isArray(body)) {
    const record = body as Record<string, unknown>;
    const bodyStatus = typeof record.status === "number" ? record.status : status;
    const message = typeof record.message === "string" ? record.message : "Bad request.";
    const data =
      record.data && typeof record.data === "object" && !Array.isArray(record.data)
        ? (record.data as Record<string, unknown>)
        : {};
    return { data, message, status: bodyStatus };
  }
  return { data: {}, message: "Bad request.", status };
}

function toApiErrorResponse(_error: Error): ApiErrorResponse {
  return { data: {}, message: "Bad request.", status: 400 };
}

function prepareInternalAction(app: App, ir: InternalRequest): PreparedAction | null {
  const full = `${ir.Method.toUpperCase()} ${ir.URL}`;

  for (const action of validBatchActions) {
    const match = action.re.exec(full);
    if (!match) {
      continue;
    }
    const params = match.groups ? { ...match.groups } : {};

    if (action.type === "upsert") {
      const collectionId = params.collection ?? "";
      const bodyId = castToString(ir.Body?.id);
      if (bodyId && collectionId) {
        try {
          app.FindRecordById(collectionId, bodyId);
          params.id = bodyId;
          ir.Method = "PATCH";
          ir.URL = `/api/collections/${collectionId}/records/${bodyId}${params.query ?? ""}`;
          return {
            handler: (event) => recordUpdate(app, event),
            params,
            pattern: patternUpdate,
          };
        } catch {
          // record doesn't exist -> create
        }
      }

      ir.Method = "POST";
      ir.URL = `/api/collections/${collectionId}/records${params.query ?? ""}`;
      return {
        handler: (event) => recordCreate(app, event),
        params,
        pattern: patternCreate,
      };
    }

    return {
      handler: (event) => action.handler(app, event),
      params,
      pattern: action.pattern,
    };
  }

  return null;
}

const patternCreate = "POST /api/collections/{collection}/records";
const patternUpdate = "PATCH /api/collections/{collection}/records/{id}";
const patternDelete = "DELETE /api/collections/{collection}/records/{id}";

const validBatchActions: Array<{
  type: "upsert" | "create" | "update" | "delete";
  re: RegExp;
  pattern: string;
  handler: (app: App, event: RequestEvent) => Promise<Response>;
}> = [
  {
    type: "upsert",
    re: /^PUT \/api\/collections\/(?<collection>[^/?]+)\/records(?<query>\?.*)?$/,
    pattern: patternCreate,
    handler: (app, event) => recordCreate(app, event),
  },
  {
    type: "create",
    re: /^POST \/api\/collections\/(?<collection>[^/?]+)\/records(?<query>\?.*)?$/,
    pattern: patternCreate,
    handler: (app, event) => recordCreate(app, event),
  },
  {
    type: "update",
    re: /^PATCH \/api\/collections\/(?<collection>[^/?]+)\/records\/(?<id>[^/?]+)(?<query>\?.*)?$/,
    pattern: patternUpdate,
    handler: (app, event) => recordUpdate(app, event),
  },
  {
    type: "delete",
    re: /^DELETE \/api\/collections\/(?<collection>[^/?]+)\/records\/(?<id>[^/?]+)(?<query>\?.*)?$/,
    pattern: patternDelete,
    handler: (app, event) => recordDelete(app, event),
  },
];

async function multipartDataFromInternalRequest(ir: InternalRequest): Promise<{ body: Uint8Array; contentType: string }> {
  const form = new FormData();

  const regularFields: Record<string, unknown> = {};
  const fileFields: Array<{ key: string; file: LocalFile }> = [];

  for (const [key, rawValue] of Object.entries(ir.Body ?? {})) {
    if (rawValue instanceof LocalFile) {
      fileFields.push({ key, file: rawValue });
      continue;
    }
    if (Array.isArray(rawValue)) {
      const files = rawValue.filter((value) => value instanceof LocalFile) as LocalFile[];
      if (files.length > 0) {
        for (const file of files) {
          fileFields.push({ key, file });
        }
        continue;
      }
    }
    regularFields[key] = rawValue;
  }

  form.append(JSONPayloadKey, JSON.stringify(regularFields));

  for (const entry of fileFields) {
    const reader = entry.file.Reader?.Open();
    if (!reader) {
      continue;
    }
    const data = reader.readAll();
    reader.close();
    const file = new File([data], entry.file.Name);
    form.append(entry.key, file);
  }

  const req = new Request("http://localhost", { method: "POST", body: form });
  const contentType = req.headers.get("content-type") ?? "";
  const body = new Uint8Array(await req.arrayBuffer());

  return { body, contentType };
}

async function extractPrefixedFiles(form: RequestFormData, ...prefixes: string[]): Promise<Map<string, LocalFile[]>> {
  const result = new Map<string, LocalFile[]>();

  for (const [key, value] of form.entries()) {
    if (typeof value === "string") {
      continue;
    }

    for (const prefix of prefixes) {
      if (!key.startsWith(prefix)) {
        continue;
      }
      const resultKey = key.slice(prefix.length);
      const fileLike = value as File;
      const buffer = new Uint8Array(await fileLike.arrayBuffer());
      const local = NewFileFromBytes(buffer, fileLike.name);
      const current = result.get(resultKey) ?? [];
      current.push(local);
      result.set(resultKey, current);
    }
  }

  return result;
}

async function readBatchRequests(
  request: Request,
): Promise<{ requests: InternalRequest[]; form: RequestFormData | null; error: Error | null }> {
  const contentType = (request.headers.get("content-type") ?? "").toLowerCase();

  if (contentType.includes("multipart/form-data")) {
    try {
      // eslint-disable-next-line typescript-eslint/no-deprecated -- Bun's Request.formData keeps batch multipart parsing aligned with upstream.
      const form = await request.clone().formData();
      const raw: Record<string, string[]> = {};
      for (const [key, value] of form.entries()) {
        if (typeof value === "string") {
          (raw[key] ??= []).push(value);
        }
      }
      const data: Record<string, unknown> = {};
      const err = unmarshalRequestData(raw, data);
      if (err) {
        return { requests: [], form, error: err };
      }
      const requests = normalizeInternalRequests(data.requests);
      return { requests, form, error: null };
    } catch (error) {
      return { requests: [], form: null, error: error as Error };
    }
  }

  if (contentType.includes("application/x-www-form-urlencoded")) {
    try {
      const text = await request.clone().text();
      const params = new URLSearchParams(text);
      const raw: Record<string, string[]> = {};
      for (const [key, value] of params.entries()) {
        (raw[key] ??= []).push(value);
      }
      const data: Record<string, unknown> = {};
      const err = unmarshalRequestData(raw, data);
      if (err) {
        return { requests: [], form: null, error: err };
      }
      const requests = normalizeInternalRequests(data.requests);
      return { requests, form: null, error: null };
    } catch (error) {
      return { requests: [], form: null, error: error as Error };
    }
  }

  if (contentType.includes("application/json") || contentType === "") {
    try {
      const text = await request.clone().text();
      if (text.trim() === "") {
        return { requests: [], form: null, error: null };
      }
      const parsed = JSON.parse(text) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return { requests: [], form: null, error: new Error("invalid json") };
      }
      const record = parsed as Record<string, unknown>;
      const requests = normalizeInternalRequests(record.requests);
      return { requests, form: null, error: null };
    } catch (error) {
      return { requests: [], form: null, error: error as Error };
    }
  }

  return { requests: [], form: null, error: new Error("unsupported content type") };
}

function normalizeInternalRequests(value: unknown): InternalRequest[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((entry) => new InternalRequest((entry ?? {}) as Record<string, unknown>));
}

function validateBatchRequests(requests: InternalRequest[], maxRequests: number): Error | null {
  if (requests.length === 0) {
    return new ValidationErrors({ requests: ErrRequired });
  }

  if (requests.length > maxRequests) {
    return new ValidationErrors({
      requests: newError("validation_length_too_long", `The length must be no more than ${maxRequests}.`),
    });
  }

  const requestErrors: Record<string, Error> = {};

  for (let i = 0; i < requests.length; i += 1) {
    const err = requests[i]?.Validate();
    if (err) {
      requestErrors[String(i)] = err;
    }
  }

  return Object.keys(requestErrors).length > 0 ? new ValidationErrors({ requests: new ValidationErrors(requestErrors) }) : null;
}

function castToString(value: unknown): string {
  if (value == null) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  return "";
}

function badBatchRequest(event: RequestEvent, message: string, err: Error): Response {
  return event.json(400, {
    status: 400,
    message: message || "Something went wrong while processing your request.",
    data: safeErrorsData(err),
  });
}

function safeErrorsData(err: Error): Record<string, unknown> {
  if (!err) {
    return {};
  }

  if (err instanceof AggregateError) {
    for (const inner of err.errors) {
      if (inner instanceof ValidationErrors || inner instanceof ValidationError || inner instanceof BatchResponseError) {
        return safeErrorsData(inner as Error);
      }
    }
    for (const inner of err.errors) {
      if (inner instanceof Error) {
        return safeErrorsData(inner);
      }
    }
    return {};
  }

  if (err instanceof ValidationErrors) {
    return resolveSafeErrorsMap(err.errors);
  }

  if (err instanceof ValidationError) {
    return resolveSafeErrorItem(err);
  }

  if (err instanceof BatchResponseError) {
    return resolveSafeErrorItem(err);
  }

  if (err instanceof Error) {
    return {};
  }

  if (typeof err === "object") {
    return resolveSafeErrorsMap(err as Record<string, unknown>);
  }

  return {};
}

function resolveSafeErrorsMap(data: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(data)) {
    if (isNestedError(value)) {
      result[name] = safeErrorsData(value as Error);
    } else {
      result[name] = resolveSafeErrorItem(value);
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
  if (err instanceof BatchResponseError) {
    return false;
  }
  if (err instanceof Error) {
    return false;
  }
  return typeof err === "object" && !Array.isArray(err);
}

function resolveSafeErrorItem(err: unknown): Record<string, unknown> {
  if (err instanceof BatchResponseError) {
    return {
      code: err.code,
      message: err.message,
      response: err.response,
    };
  }

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
  } else if (err instanceof Error && err.message) {
    data.message = err.message;
  }

  return data;
}
