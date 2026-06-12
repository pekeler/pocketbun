// Ported from pocketbase/plugins/jsvm/binds.go (Bun-native hooks bindings).

import { AsyncLocalStorage } from "node:async_hooks";
import {
  lstatSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  renameSync,
  truncateSync,
} from "node:fs";
import {
  mkdir as mkdirAsync,
  readFile as readFileAsync,
  readdir as readdirAsync,
  rename as renameAsync,
  rm as rmAsync,
  stat as statAsync,
  truncate as truncateAsync,
  writeFile as writeFileAsync,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, extname, isAbsolute, join, relative, sep, normalize } from "node:path";
import type { App } from "../../core/app.ts";
import type { ServeEvent } from "../../core/events.ts";
import { Static } from "../../apis/base.ts";
import {
  RequireAuth,
  RequireGuestOnly,
  RequireSuperuserAuth,
  RequireSuperuserOrOwnerAuth,
  SkipSuccessActivityLog,
} from "../../apis/middlewares.ts";
import { BodyLimit } from "../../apis/middlewares_body_limit.ts";
import { DefaultMaxBodySize } from "../../apis/middlewares_body_limit.ts";
import { Gzip } from "../../apis/middlewares_gzip.ts";
import { RecordAuthResponse, EnrichRecord, EnrichRecords } from "../../apis/record_helpers.ts";
import {
  Collection,
  NewAuthCollection,
  NewBaseCollection,
  NewCollection,
  NewViewCollection,
} from "../../core/collection_model.ts";
import { RequestInfoContextDefault, type RequestInfo as RequestInfoShape } from "../../core/event_request.ts";
import { AutodateField } from "../../core/field_autodate.ts";
import { BoolField } from "../../core/field_bool.ts";
import { DateField } from "../../core/field_date.ts";
import { EditorField } from "../../core/field_editor.ts";
import { EmailField } from "../../core/field_email.ts";
import { FileField } from "../../core/field_file.ts";
import { GeoPointField } from "../../core/field_geo_point.ts";
import { JSONField } from "../../core/field_json.ts";
import { NumberField } from "../../core/field_number.ts";
import { PasswordField } from "../../core/field_password.ts";
import { RelationField } from "../../core/field_relation.ts";
import { SelectField } from "../../core/field_select.ts";
import { TextField } from "../../core/field_text.ts";
import { URLField } from "../../core/field_url.ts";
import { FieldsList, NewFieldsList } from "../../core/fields_list.ts";
import { Record as RecordModel } from "../../core/record_model.ts";
import { AppleClientSecretCreate } from "../../forms/apple_client_secret_create.ts";
import { RecordUpsert } from "../../forms/record_upsert.ts";
import { TestEmailSend } from "../../forms/test_email_send.ts";
import { TestS3Filesystem } from "../../forms/test_s3_filesystem.ts";
import { globMatch, scanGlobSync } from "../../internal/compat/bun_glob.ts";
import { ValidationError } from "../../internal/compat/validation.ts";
import {
  SendRecordAuthAlert,
  SendRecordChangeEmail,
  SendRecordOTP,
  SendRecordPasswordReset,
  SendRecordVerification,
} from "../../mails/record.ts";
import {
  HashExp,
  NewExp,
  Not,
  And,
  Or,
  In,
  NotIn,
  Like,
  OrLike,
  NotLike,
  OrNotLike,
  Exists,
  NotExists,
  Between,
  NotBetween,
} from "../../tools/dbx/expr.ts";
import { NewFileFromBytes, NewFileFromMultipart, NewFileFromPath, NewFileFromPathAsync } from "../../tools/filesystem/file.ts";
import { NewLocal, NewS3 } from "../../tools/filesystem/filesystem.ts";
import {
  ApiError,
  NewBadRequestError,
  NewForbiddenError,
  NewInternalServerError,
  NewNotFoundError,
  NewTooManyRequestsError,
  NewUnauthorizedError,
} from "../../tools/router/api_error.ts";
import { MD5, SHA256, SHA512, HS256, HS512, Equal } from "../../tools/security/crypto.ts";
import { decrypt, encrypt } from "../../tools/security/encrypt.ts";
import { parseJWT, parseUnverifiedJWT, newJWT } from "../../tools/security/jwt.ts";
import {
  randomStringByRegex,
  randomStringWithAlphabet,
  pseudorandomString,
  pseudorandomStringWithAlphabet,
  randomString,
} from "../../tools/security/random.ts";
import { JSONRaw, JSONArray, JSONMap, DateTime, NowDateTime } from "../../tools/types/index.ts";
import { FormData as HooksFormData } from "./form_data.ts";
import { convertGoToJSName } from "./mapper.ts";

const DynamicModelShapeKey = "__pbDynamicModelShape";
const DynamicModelFactoryKey = "__pbDynamicModelFactory";

type BindTarget = Record<string, unknown>;

type DynamicShape = Record<string, DynamicShapeValue>;
type DynamicShapeValue =
  | string
  | number
  | boolean
  | null
  | JSONArray<unknown>
  | JSONMap<unknown>
  | JSONRaw
  | unknown[]
  | Record<string, unknown>
  | NullPlaceholder;

class NullPlaceholder {
  kind: string;
  constructor(kind: string) {
    this.kind = kind;
  }
}

const hooksStorage = new AsyncLocalStorage<App>();

function runWithApp<T>(app: App, fn: () => T | Promise<T>): T | Promise<T> {
  return hooksStorage.run(app, fn);
}

function defineAppAccessor(target: BindTarget, app: App): void {
  Object.defineProperty(target, "$app", {
    configurable: true,
    enumerable: false,
    get() {
      const current = hooksStorage.getStore() ?? app;
      return wrapApp(current as unknown as object);
    },
    set(value) {
      if (value) {
        app = value as App;
      }
    },
  });
}

export function appBinds(target: BindTarget, app: App): void {
  defineAppAccessor(target, app);
}

const appFacadeCache = new WeakMap<object, object>();
const eventFacadeCache = new WeakMap<object, object>();
const boundValueFacadeCache = new WeakMap<object, object>();
const boundValueTargetCache = new WeakMap<object, object>();

// App is an interface, so app values returned through events or forMigrations()
// need a runtime check to keep the app-specific sync wrappers.
function isAppLike(value: unknown): value is App {
  return (
    !!value &&
    typeof value === "object" &&
    "SaveSync" in value &&
    "RunInTransactionSync" in value &&
    "FindCollectionByNameOrId" in value
  );
}

const appSaveOverrides: Record<string, { sync: string; async: string; modelArgIndex: number }> = {
  save: { sync: "SaveSync", async: "Save", modelArgIndex: 0 },
  saveNoValidate: { sync: "SaveNoValidateSync", async: "SaveNoValidate", modelArgIndex: 0 },
  saveWithContext: { sync: "SaveWithContextSync", async: "SaveWithContext", modelArgIndex: 1 },
  saveNoValidateWithContext: {
    sync: "SaveNoValidateWithContextSync",
    async: "SaveNoValidateWithContext",
    modelArgIndex: 1,
  },
  auxSave: { sync: "AuxSaveSync", async: "AuxSave", modelArgIndex: 0 },
  auxSaveNoValidate: { sync: "AuxSaveNoValidateSync", async: "AuxSaveNoValidate", modelArgIndex: 0 },
  auxSaveWithContext: { sync: "AuxSaveWithContextSync", async: "AuxSaveWithContext", modelArgIndex: 1 },
  auxSaveNoValidateWithContext: {
    sync: "AuxSaveNoValidateWithContextSync",
    async: "AuxSaveNoValidateWithContext",
    modelArgIndex: 1,
  },
};

const appSyncOverrides: Record<string, string> = {
  delete: "DeleteSync",
  deleteWithContext: "DeleteWithContextSync",
  auxDelete: "AuxDeleteSync",
  auxDeleteWithContext: "AuxDeleteWithContextSync",
  importCollections: "ImportCollectionsSync",
  importCollectionsByMarshaledJSON: "ImportCollectionsByMarshaledJSONSync",
  validate: "ValidateSync",
  saveView: "SaveViewSync",
  createViewFields: "CreateViewFieldsSync",
};

const appTransactionOverrides: Record<string, string> = {
  runInTransaction: "RunInTransactionSync",
  auxRunInTransaction: "AuxRunInTransactionSync",
};

type FacadeOptions = {
  protectedNames?: Set<string | symbol>;
};

function wrapApp<T extends object>(app: T): T {
  const existing = appFacadeCache.get(app);
  if (existing) {
    return existing as T;
  }

  const facade = Object.create(app) as T & Record<string, unknown>;
  const protectedNames = new Set<string | symbol>();

  appFacadeCache.set(app, facade);
  boundValueTargetCache.set(facade, app);

  defineAppOverrides(facade, app, protectedNames);
  defineFacadeMembers(facade, app, { protectedNames });

  return facade as T;
}

function defineAppOverrides(facade: Record<string, unknown>, app: object, protectedNames: Set<string | symbol>): void {
  for (const [name, override] of Object.entries(appSaveOverrides)) {
    const syncMethod = (app as Record<string, unknown>)[override.sync];
    if (typeof syncMethod !== "function") {
      continue;
    }

    protectedNames.add(name);
    defineFacadeMethod(facade, name, (...args: unknown[]) => {
      const unwrappedArgs = args.map((arg) => unwrapBoundValue(arg));
      const model = unwrappedArgs[override.modelArgIndex];
      const asyncMethod = (app as Record<string, unknown>)[override.async];
      const result =
        typeof asyncMethod === "function" && hasAsyncSaveInterceptors(model)
          ? normalizeAsyncErrorResult((asyncMethod as (...input: unknown[]) => unknown).apply(app, unwrappedArgs))
          : (syncMethod as (...input: unknown[]) => unknown).apply(app, unwrappedArgs);

      return wrapInvocationResult(result);
    });
  }

  for (const [name, methodName] of Object.entries(appSyncOverrides)) {
    const method = (app as Record<string, unknown>)[methodName];
    if (typeof method !== "function") {
      continue;
    }

    protectedNames.add(name);
    defineFacadeMethod(facade, name, (...args: unknown[]) =>
      invokeBoundFunction(app, method as (...input: unknown[]) => unknown, args),
    );
  }

  for (const [name, methodName] of Object.entries(appTransactionOverrides)) {
    const method = (app as Record<string, unknown>)[methodName];
    if (typeof method !== "function") {
      continue;
    }

    protectedNames.add(name);
    defineFacadeMethod(facade, name, (fn: unknown) => {
      const result = (method as (callback: (txApp: App) => unknown) => unknown).call(app, (txApp: App) => {
        if (typeof fn !== "function") {
          return null;
        }
        return (fn as (txApp: App) => unknown)(wrapApp(txApp as unknown as object) as App);
      });

      return wrapInvocationResult(result);
    });
  }
}

const asyncSaveInterceptorCollections = new WeakSet<object>();

function hasAsyncSaveInterceptors(model: unknown): boolean {
  if (!(model instanceof RecordModel)) {
    return false;
  }

  const collection = model.collection();
  const collectionObject = collection as unknown as object;
  if (asyncSaveInterceptorCollections.has(collectionObject)) {
    return true;
  }

  for (const field of collection.Fields) {
    // FileField.Intercept is async and always part of save execution actions.
    if (field instanceof FileField) {
      asyncSaveInterceptorCollections.add(collectionObject);
      return true;
    }

    const interceptor = field as unknown as { Intercept?: unknown };
    if (typeof interceptor.Intercept !== "function") {
      continue;
    }

    if (interceptor.Intercept.constructor?.name === "AsyncFunction") {
      asyncSaveInterceptorCollections.add(collectionObject);
      return true;
    }
  }

  return false;
}

function normalizeAsyncErrorResult(result: unknown): unknown {
  if (result instanceof Error) {
    throw result;
  }
  if (!isPromiseLike(result)) {
    return result;
  }
  return (result as Promise<unknown>).then((value) => {
    if (value instanceof Error) {
      throw value;
    }
    return value;
  });
}

function isPromiseLike(value: unknown): value is Promise<unknown> {
  if (value == null) {
    return false;
  }
  return (typeof value === "object" || typeof value === "function") && typeof (value as { then?: unknown }).then === "function";
}

function wrapEvent<T extends object>(event: T): T {
  const existing = eventFacadeCache.get(event);
  if (existing) {
    return existing as T;
  }

  const facade = Object.create(event) as T & Record<string, unknown>;
  const protectedNames = new Set<string | symbol>();

  eventFacadeCache.set(event, facade);
  boundValueTargetCache.set(facade, event);

  if (isRouteRequestContext(event)) {
    protectedNames.add("request");
    Object.defineProperty(facade, "request", {
      configurable: true,
      enumerable: true,
      get() {
        return wrapRouteRequest(event);
      },
      set(value) {
        event.request = unwrapBoundValue(value) as Request;
      },
    });
  }

  defineFacadeMembers(facade, event, { protectedNames });
  return facade as T;
}

type RouteRequestContext = {
  request: Request;
  params?: Record<string, string>;
  requestUrl?: () => URL;
};

const requestCompatCache = new WeakMap<object, object>();
const requestUrlCompatCache = new WeakMap<object, object>();
const headersCompatCache = new WeakMap<object, object>();
const queryCompatCache = new WeakMap<object, object>();

function isRouteRequestContext(value: unknown): value is RouteRequestContext {
  if (!value || typeof value !== "object") {
    return false;
  }
  const raw = value as { request?: unknown };
  return raw.request instanceof Request;
}

function wrapRouteRequest(event: RouteRequestContext): object {
  const eventObject = event as unknown as object;
  const cached = requestCompatCache.get(eventObject);
  if (cached) {
    return cached;
  }

  const adapter = new RouteRequestCompat(event);
  requestCompatCache.set(eventObject, adapter);
  return adapter;
}

function wrapRouteRequestURL(event: RouteRequestContext): object {
  const eventObject = event as unknown as object;
  const cached = requestUrlCompatCache.get(eventObject);
  if (cached) {
    return cached;
  }

  const adapter = new RouteRequestURLCompat(event);
  requestUrlCompatCache.set(eventObject, adapter);
  return adapter;
}

function getRouteRequestURL(event: RouteRequestContext): URL {
  if (typeof event.requestUrl === "function") {
    return event.requestUrl();
  }

  return new URL(event.request.url);
}

function wrapHeaderValues(headers: Headers): object {
  const headersObject = headers as unknown as object;
  const cached = headersCompatCache.get(headersObject);
  if (cached) {
    return cached;
  }

  const adapter = new HeaderValuesCompat(headers);
  headersCompatCache.set(headersObject, adapter);
  return adapter;
}

class RouteRequestCompat {
  private readonly event: RouteRequestContext;
  // Keep explicit setPathValue overrides raw so pathValue can roundtrip "%"-containing values.
  // Lazily initialized to avoid per-request allocation when setPathValue is unused.
  private overriddenPathValues: Map<string, string> | null = null;

  constructor(event: RouteRequestContext) {
    this.event = event;
  }

  private get request(): Request {
    return this.event.request;
  }

  get header(): object {
    return wrapHeaderValues(this.request.headers);
  }

  get headers(): Headers {
    return this.request.headers;
  }

  get url(): object {
    return wrapRouteRequestURL(this.event);
  }

  get raw(): Request {
    return this.request;
  }

  get method(): string {
    return this.request.method;
  }

  get body(): ReadableStream<Uint8Array> | null {
    return this.request.body;
  }

  get bodyUsed(): boolean {
    return this.request.bodyUsed;
  }

  get cache(): unknown {
    return (this.request as unknown as { cache: unknown }).cache;
  }

  get credentials(): unknown {
    return (this.request as unknown as { credentials: unknown }).credentials;
  }

  get destination(): unknown {
    return (this.request as unknown as { destination: unknown }).destination;
  }

  get integrity(): string {
    return this.request.integrity;
  }

  get keepalive(): boolean {
    return this.request.keepalive;
  }

  get mode(): unknown {
    return (this.request as unknown as { mode: unknown }).mode;
  }

  get redirect(): unknown {
    return (this.request as unknown as { redirect: unknown }).redirect;
  }

  get referrer(): string {
    return this.request.referrer;
  }

  get referrerPolicy(): unknown {
    return (this.request as unknown as { referrerPolicy: unknown }).referrerPolicy;
  }

  get signal(): AbortSignal {
    return this.request.signal;
  }

  pathValue(name: string): string {
    const key = toPrimitiveString(name);
    if (this.overriddenPathValues?.has(key)) {
      return this.overriddenPathValues.get(key) ?? "";
    }

    const raw = this.event.params?.[key] ?? "";
    if (raw === "") {
      return "";
    }

    // Fast path: avoid decode work when route param has no escape sequences.
    if (!raw.includes("%")) {
      return raw;
    }

    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }

  setPathValue(name: string, value: string): void {
    const key = toPrimitiveString(name);
    const normalizedValue = toPrimitiveString(value);
    if (!this.event.params) {
      this.event.params = {};
    }
    this.event.params[key] = normalizedValue;
    if (!this.overriddenPathValues) {
      this.overriddenPathValues = new Map<string, string>();
    }
    this.overriddenPathValues.set(key, normalizedValue);
  }

  arrayBuffer(): Promise<ArrayBuffer> {
    return this.request.arrayBuffer();
  }

  blob(): Promise<Blob> {
    return this.request.blob();
  }

  bytes(): Promise<Uint8Array> {
    const bytes = (this.request as Request & { bytes?: () => Promise<Uint8Array> }).bytes;
    if (typeof bytes === "function") {
      return bytes.call(this.request);
    }
    return this.request.arrayBuffer().then((buffer) => new Uint8Array(buffer));
  }

  clone(): unknown {
    return this.request.clone();
  }

  formData(): Promise<unknown> {
    const formData = (this.request as unknown as Record<"formData", () => Promise<unknown>>)["formData"];
    return formData.call(this.request);
  }

  json(): Promise<unknown> {
    return this.request.json();
  }

  text(): Promise<string> {
    return this.request.text();
  }
}

class RouteRequestURLCompat {
  private readonly event: RouteRequestContext;

  constructor(event: RouteRequestContext) {
    this.event = event;
  }

  private get url(): URL {
    return getRouteRequestURL(this.event);
  }

  get path(): string {
    return this.url.pathname;
  }

  set path(value: string) {
    this.url.pathname = toPrimitiveString(value);
  }

  get rawQuery(): string {
    const search = this.url.search;
    return search.startsWith("?") ? search.slice(1) : search;
  }

  set rawQuery(value: string) {
    const raw = toPrimitiveString(value);
    this.url.search = raw === "" || raw.startsWith("?") ? raw : `?${raw}`;
  }

  get scheme(): string {
    return this.url.protocol.replace(/:$/, "");
  }

  set scheme(value: string) {
    const raw = toPrimitiveString(value);
    this.url.protocol = raw.endsWith(":") ? raw : `${raw}:`;
  }

  get hash(): string {
    return this.url.hash;
  }

  set hash(value: string) {
    this.url.hash = toPrimitiveString(value);
  }

  get host(): string {
    return this.url.host;
  }

  set host(value: string) {
    this.url.host = toPrimitiveString(value);
  }

  get hostname(): string {
    return this.url.hostname;
  }

  set hostname(value: string) {
    this.url.hostname = toPrimitiveString(value);
  }

  get href(): string {
    return this.url.href;
  }

  set href(value: string) {
    this.url.href = toPrimitiveString(value);
  }

  get origin(): string {
    return this.url.origin;
  }

  get password(): string {
    return this.url.password;
  }

  set password(value: string) {
    this.url.password = toPrimitiveString(value);
  }

  get pathname(): string {
    return this.url.pathname;
  }

  set pathname(value: string) {
    this.url.pathname = toPrimitiveString(value);
  }

  get port(): string {
    return this.url.port;
  }

  set port(value: string) {
    this.url.port = toPrimitiveString(value);
  }

  get protocol(): string {
    return this.url.protocol;
  }

  set protocol(value: string) {
    this.url.protocol = toPrimitiveString(value);
  }

  get search(): string {
    return this.url.search;
  }

  set search(value: string) {
    this.url.search = toPrimitiveString(value);
  }

  get searchParams(): URLSearchParams {
    return this.url.searchParams;
  }

  get username(): string {
    return this.url.username;
  }

  set username(value: string) {
    this.url.username = toPrimitiveString(value);
  }

  query(): object {
    return wrapQueryValues(this.url.searchParams);
  }

  string(): string {
    return this.url.toString();
  }

  toJSON(): string {
    return this.url.toJSON();
  }

  toString(): string {
    return this.url.toString();
  }
}

class HeaderValuesCompat {
  private readonly headers: Headers;

  constructor(headers: Headers) {
    this.headers = headers;
  }

  append(name: string, value: string): void {
    this.headers.append(toPrimitiveString(name), toPrimitiveString(value));
  }

  delete(name: string): void {
    this.headers.delete(toPrimitiveString(name));
  }

  entries(): ReturnType<Headers["entries"]> {
    return this.headers.entries();
  }

  forEach(callback: Parameters<Headers["forEach"]>[0], thisArg?: unknown): void {
    return this.headers.forEach(callback, thisArg);
  }

  get(name: string): string {
    return this.headers.get(toPrimitiveString(name)) ?? "";
  }

  has(name: string): boolean {
    return this.headers.has(toPrimitiveString(name));
  }

  keys(): ReturnType<Headers["keys"]> {
    return this.headers.keys();
  }

  set(name: string, value: string): void {
    this.headers.set(toPrimitiveString(name), toPrimitiveString(value));
  }

  toJSON(): Record<string, string[]> {
    return headerValuesToJSON(this.headers);
  }

  values(name: string): string[] {
    return splitHeaderValues(this.headers.get(toPrimitiveString(name)));
  }

  [Symbol.iterator](): ReturnType<Headers[typeof Symbol.iterator]> {
    return this.headers[Symbol.iterator]();
  }
}

function splitHeaderValues(raw: string | null): string[] {
  if (!raw) {
    return [];
  }

  return raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part !== "");
}

function headerValuesToJSON(headers: Headers): Record<string, string[]> {
  const out: Record<string, string[]> = {};

  for (const [key, value] of headers.entries()) {
    out[key] = splitHeaderValues(value);
  }

  return out;
}

function wrapQueryValues(query: URLSearchParams): object {
  const queryObject = query as unknown as object;
  const cached = queryCompatCache.get(queryObject);
  if (cached) {
    return cached;
  }

  const adapter = new QueryValuesCompat(query);
  queryCompatCache.set(queryObject, adapter);
  return adapter;
}

class QueryValuesCompat {
  private readonly query: URLSearchParams;

  constructor(query: URLSearchParams) {
    this.query = query;
  }

  append(name: string, value: string): void {
    this.query.append(toPrimitiveString(name), toPrimitiveString(value));
  }

  delete(name: string): void {
    this.query.delete(toPrimitiveString(name));
  }

  del(name: string): void {
    this.query.delete(toPrimitiveString(name));
  }

  entries(): ReturnType<URLSearchParams["entries"]> {
    return this.query.entries();
  }

  forEach(callback: (value: string, key: string, parent: URLSearchParams) => void, thisArg?: unknown): void {
    return this.query.forEach(callback, thisArg);
  }

  get(name: string): string {
    return this.query.get(toPrimitiveString(name)) ?? "";
  }

  getAll(name: string): string[] {
    return this.query.getAll(toPrimitiveString(name));
  }

  has(name: string): boolean {
    return this.query.has(toPrimitiveString(name));
  }

  keys(): ReturnType<URLSearchParams["keys"]> {
    return this.query.keys();
  }

  set(name: string, value: string): void {
    this.query.set(toPrimitiveString(name), toPrimitiveString(value));
  }

  sort(): void {
    this.query.sort();
  }

  string(): string {
    return this.query.toString();
  }

  toJSON(): Record<string, string[]> {
    return queryValuesToJSON(this.query);
  }

  toString(): string {
    return this.query.toString();
  }

  values(): ReturnType<URLSearchParams["values"]> {
    return this.query.values();
  }

  [Symbol.iterator](): ReturnType<URLSearchParams[typeof Symbol.iterator]> {
    return this.query[Symbol.iterator]();
  }
}

function queryValuesToJSON(query: URLSearchParams): Record<string, string[]> {
  const out: Record<string, string[]> = {};

  for (const [key, value] of query.entries()) {
    const existing = out[key];
    if (existing) {
      existing.push(value);
    } else {
      out[key] = [value];
    }
  }

  return out;
}

// wrapBoundValue maps bound Go-style names to the JS style expected by jsvm scripts
// (eg. `Fields.Add` <-> `fields.add`) and applies recursively to returned objects.
function wrapBoundValue<T>(value: T): T {
  return wrapBoundValueInternal(value, false);
}

function wrapBoundObjectValue<T>(value: T): T {
  return wrapBoundValueInternal(value, true);
}

function wrapBoundValueInternal<T>(value: T, wrapErrors: boolean): T {
  if (!value || (typeof value !== "object" && typeof value !== "function")) {
    return value;
  }

  if ((!wrapErrors && value instanceof Error) || isPromiseLike(value) || value instanceof Date || value instanceof RegExp) {
    return value;
  }

  if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
    return value;
  }

  if (
    value instanceof Request ||
    value instanceof Response ||
    value instanceof Headers ||
    value instanceof URL ||
    value instanceof URLSearchParams ||
    value instanceof FormData
  ) {
    return value;
  }

  const objectValue = value as unknown as object;
  if (isAppLike(objectValue)) {
    return wrapApp(objectValue) as T;
  }

  if (Array.isArray(value)) {
    exposeArrayElements(value as unknown[]);
    if (Object.getPrototypeOf(value) === Array.prototype) {
      return value;
    }
  }

  const existing = boundValueFacadeCache.get(objectValue);
  if (existing) {
    return existing as T;
  }

  const facade = Object.create(objectValue) as object;
  boundValueFacadeCache.set(objectValue, facade);
  boundValueTargetCache.set(facade, objectValue);
  defineFacadeMembers(facade, objectValue);
  return facade as T;
}

function unwrapBoundValue<T>(value: T): T {
  if (!value || (typeof value !== "object" && typeof value !== "function")) {
    return value;
  }

  const target = boundValueTargetCache.get(value as unknown as object);
  if (target) {
    return target as T;
  }

  if (Array.isArray(value)) {
    unwrapArrayElements(value as unknown[]);
    return value;
  }

  return value;
}

function exposeArrayElements(values: unknown[]): void {
  for (let i = 0; i < values.length; i += 1) {
    values[i] = wrapBoundValue(values[i]);
  }
}

function unwrapArrayElements(values: unknown[]): void {
  for (let i = 0; i < values.length; i += 1) {
    values[i] = unwrapBoundValue(values[i]);
  }
}

function defineFacadeMembers(facade: object, target: object, options: FacadeOptions = {}): void {
  let source: object | null = target;
  while (source && source !== Object.prototype) {
    for (const key of Reflect.ownKeys(source)) {
      if (key === "constructor" || options.protectedNames?.has(key)) {
        continue;
      }

      const descriptor = Object.getOwnPropertyDescriptor(source, key);
      if (!descriptor) {
        continue;
      }

      defineForwardingMember(facade, target, key, key, descriptor, {
        override: false,
        protectedNames: options.protectedNames,
      });

      if (typeof key !== "string") {
        continue;
      }

      const jsName = convertGoToJSName(key);
      if (jsName === key || options.protectedNames?.has(jsName)) {
        continue;
      }

      defineForwardingMember(facade, target, jsName, key, descriptor, {
        override: true,
        protectedNames: options.protectedNames,
      });
    }
    source = Object.getPrototypeOf(source);
  }
}

function defineForwardingMember(
  facade: object,
  target: object,
  exposedKey: string | symbol,
  sourceKey: string | symbol,
  descriptor: PropertyDescriptor,
  options: { override: boolean; protectedNames?: Set<string | symbol> },
): void {
  if (options.protectedNames?.has(exposedKey)) {
    return;
  }

  const existing = Object.getOwnPropertyDescriptor(facade, exposedKey);
  if (existing && !options.override) {
    return;
  }
  if (existing && existing.configurable === false) {
    return;
  }

  const enumerable = descriptor.enumerable === true;
  if ("value" in descriptor && typeof descriptor.value === "function") {
    defineFacadeMethod(facade as Record<string | symbol, unknown>, exposedKey, (...args: unknown[]) =>
      invokeBoundFunction(target, descriptor.value as (...input: unknown[]) => unknown, args, sourceKey),
    );
    return;
  }

  Object.defineProperty(facade, exposedKey, {
    configurable: true,
    enumerable,
    get() {
      const value = Reflect.get(target, sourceKey, target);
      return wrapBoundValue(value);
    },
    set(value) {
      const unwrapped = unwrapBoundValue(value);
      if (descriptor.set || Reflect.has(target, sourceKey)) {
        Reflect.set(target, sourceKey, unwrapped, target);
        return;
      }
      (target as Record<string, unknown>)[String(sourceKey)] = unwrapped;
    },
  });
}

function defineFacadeMethod(
  facade: Record<string | symbol, unknown>,
  key: string | symbol,
  method: (...args: unknown[]) => unknown,
): void {
  Object.defineProperty(facade, key, {
    configurable: true,
    enumerable: false,
    writable: true,
    value: method,
  });
}

function invokeBoundFunction(
  target: object,
  method: (...args: unknown[]) => unknown,
  args: unknown[],
  sourceKey?: string | symbol,
): unknown {
  const result = method.apply(
    target,
    args.map((arg) => unwrapBoundValue(arg)),
  );

  if (Array.isArray(target) && typeof sourceKey === "string" && shouldReturnPlainArray(sourceKey) && Array.isArray(result)) {
    return Array.from(result, (item) => wrapBoundValue(item));
  }

  return wrapInvocationResult(result);
}

function shouldReturnPlainArray(methodName: string): boolean {
  return (
    methodName === "concat" ||
    methodName === "filter" ||
    methodName === "flat" ||
    methodName === "flatMap" ||
    methodName === "map" ||
    methodName === "slice" ||
    methodName === "splice" ||
    methodName === "toReversed" ||
    methodName === "toSorted" ||
    methodName === "toSpliced"
  );
}

function wrapInvocationResult(result: unknown): unknown {
  if (result instanceof Error) {
    throw result;
  }
  return wrapBoundValue(result);
}

function toBytes(raw: unknown, _maxReaderBytes = DefaultMaxBodySize): number[] {
  if (raw == null) {
    return [];
  }
  if (typeof raw === "string") {
    return Array.from(new TextEncoder().encode(raw));
  }
  if (typeof raw === "number" || typeof raw === "boolean" || typeof raw === "bigint") {
    return Array.from(new TextEncoder().encode(String(raw)));
  }
  if (raw instanceof Uint8Array) {
    return Array.from(raw);
  }
  if (raw instanceof ArrayBuffer) {
    return Array.from(new Uint8Array(raw));
  }
  if (raw instanceof JSONRaw) {
    const jsonVal = raw.toJSON();
    if (Array.isArray(jsonVal)) {
      return jsonVal.map((item) => Number(item));
    }
    return Array.from(new TextEncoder().encode(raw.toString()));
  }
  if (Array.isArray(raw) && raw.every((item) => typeof item === "number")) {
    return raw as number[];
  }
  const json = JSON.stringify(raw);
  return Array.from(new TextEncoder().encode(json));
}

function toPrimitiveString(value: unknown): string {
  return String(value as string | number | boolean | bigint | symbol);
}

function toErrorValue(value: unknown): Error {
  if (value instanceof Error) {
    return value;
  }
  return new Error(String(value));
}

function toStringValue(raw: unknown, _maxReaderBytes = DefaultMaxBodySize): string {
  if (raw == null) {
    return "";
  }
  if (typeof raw === "string") {
    return raw;
  }
  if (raw instanceof Uint8Array) {
    return new TextDecoder().decode(raw);
  }
  if (raw instanceof ArrayBuffer) {
    return new TextDecoder().decode(new Uint8Array(raw));
  }
  if (raw instanceof JSONRaw) {
    return raw.toString();
  }
  if (typeof raw === "object") {
    return JSON.stringify(raw);
  }
  return toPrimitiveString(raw);
}

function sleep(ms: number): void {
  const buf = new SharedArrayBuffer(4);
  const arr = new Int32Array(buf);
  Atomics.wait(arr, 0, 0, ms);
}

function unmarshal(data: unknown, dst: Record<string, unknown>): void {
  const raw = JSON.stringify(data ?? {});
  const target = unwrapBoundValue(dst);
  const err = unmarshalJSONIntoTarget(raw, target);
  if (err) {
    throw err;
  }
}

function unmarshalJSONIntoTarget(raw: string, target: unknown): Error | null {
  if (target && typeof target === "object") {
    const unmarshalJSON = (target as { UnmarshalJSON?: unknown }).UnmarshalJSON;
    if (typeof unmarshalJSON === "function") {
      const err = unmarshalJSON.call(target, raw);
      if (err instanceof Error) {
        return err;
      }
      return null;
    }
  }

  const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  if (target && typeof target === "object" && parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    for (const [key, value] of Object.entries(parsed)) {
      (target as Record<string, unknown>)[key] = value;
    }
  }

  return null;
}

class Context {
  #parent: Context | null;
  #key: unknown;
  #value: unknown;

  constructor(parent: Context | null, key: unknown, value: unknown) {
    this.#parent = parent;
    this.#key = key;
    this.#value = value;
  }

  value(key: unknown): unknown {
    if (this.#key === key) {
      return this.#value;
    }
    return this.#parent ? this.#parent.value(key) : null;
  }
}

function createDynamicModel(shape: DynamicShape): Record<string, unknown> {
  const model: Record<string, unknown> = {};
  const meta: Record<string, string> = {};

  const keys = Object.keys(shape).sort();
  for (const key of keys) {
    const rawValue = shape[key];

    if (rawValue instanceof NullPlaceholder) {
      meta[key] = rawValue.kind;
      model[key] = null;
      continue;
    }

    if (Array.isArray(rawValue)) {
      meta[key] = "array";
      model[key] = new JSONArray(...rawValue);
      continue;
    }

    if (rawValue instanceof JSONArray) {
      meta[key] = "array";
      model[key] = new JSONArray(...rawValue);
      continue;
    }

    if (rawValue instanceof JSONMap) {
      meta[key] = "object";
      model[key] = new JSONMap(rawValue.toJSON());
      continue;
    }

    if (rawValue && typeof rawValue === "object") {
      meta[key] = "object";
      model[key] = new JSONMap(rawValue as Record<string, unknown>);
      continue;
    }

    if (typeof rawValue === "string") {
      meta[key] = "string";
      model[key] = rawValue;
      continue;
    }

    if (typeof rawValue === "boolean") {
      meta[key] = "bool";
      model[key] = rawValue;
      continue;
    }

    if (typeof rawValue === "number") {
      meta[key] = "number";
      model[key] = rawValue;
      continue;
    }

    model[key] = rawValue as unknown;
  }

  Object.defineProperty(model, DynamicModelShapeKey, {
    value: meta,
    enumerable: false,
    configurable: false,
  });

  return model;
}

class Timezone {
  name: string;

  constructor(name = "UTC") {
    this.name = isValidTimeZone(name) ? name : "UTC";
  }

  string(): string {
    return this.name;
  }
}

const millisecondsPerHour = 60 * 60 * 1000;

function isValidTimeZone(name: string): boolean {
  if (!name) {
    return false;
  }
  if (goTimeZoneAliasOffsetMs(name, new Date()) !== null) {
    return true;
  }
  try {
    Intl.DateTimeFormat("en-US", { timeZone: name }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function parseZonedDate(raw: string, timeZone: string): Date {
  const hasOffset = /[+-]\d{2}:?\d{2}$/.test(raw) || raw.endsWith("Z");
  if (hasOffset) {
    const normalized = raw.replace(" ", "T").replace(/ ([+-]\d{2}:?\d{2})$/, "$1");
    return new Date(normalized);
  }

  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?$/);
  if (!match) {
    return new Date(raw.replace(" ", "T"));
  }

  const [_, yearStr, monthStr, dayStr, hourStr, minuteStr, secondStr, msStr] = match;
  const year = Number(yearStr);
  const month = Number(monthStr) - 1;
  const day = Number(dayStr);
  const hour = Number(hourStr);
  const minute = Number(minuteStr);
  const second = Number(secondStr);
  const millisecond = msStr ? Number(msStr.padEnd(3, "0").slice(0, 3)) : 0;

  const utcDate = new Date(Date.UTC(year, month, day, hour, minute, second, millisecond));
  const targetParts = { year, month: month + 1, day, hour, minute, second };

  const candidateOffsets = [
    getTimeZoneOffsetMs(timeZone, utcDate),
    getTimeZoneOffsetMs(timeZone, new Date(utcDate.getTime() - 60 * 60 * 1000)),
    getTimeZoneOffsetMs(timeZone, new Date(utcDate.getTime() + 60 * 60 * 1000)),
  ];

  const candidates: Array<{ date: Date; offset: number }> = [];
  for (const offset of candidateOffsets) {
    const candidate = new Date(utcDate.getTime() - offset);
    const parts = getTimeZoneParts(timeZone, candidate);
    if (
      parts.year === targetParts.year &&
      parts.month === targetParts.month &&
      parts.day === targetParts.day &&
      parts.hour === targetParts.hour &&
      parts.minute === targetParts.minute &&
      parts.second === targetParts.second
    ) {
      candidates.push({ date: candidate, offset });
    }
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => b.offset - a.offset);
    return candidates[0]!.date;
  }

  const offset = candidateOffsets[0] ?? 0;
  return new Date(utcDate.getTime() - offset);
}

function getTimeZoneParts(
  timeZone: string,
  date: Date,
): { year: number; month: number; day: number; hour: number; minute: number; second: number } {
  const aliasOffset = goTimeZoneAliasOffsetMs(timeZone, date);
  if (aliasOffset !== null) {
    return getUtcDateParts(new Date(date.getTime() + aliasOffset));
  }

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const parts = formatter.formatToParts(date);
  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") {
      map[part.type] = part.value;
    }
  }

  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

function getTimeZoneOffsetMs(timeZone: string, date: Date): number {
  const aliasOffset = goTimeZoneAliasOffsetMs(timeZone, date);
  if (aliasOffset !== null) {
    return aliasOffset;
  }

  const parts = getTimeZoneParts(timeZone, date);
  const zoned = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return zoned - date.getTime();
}

function getUtcDateParts(date: Date): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes(),
    second: date.getUTCSeconds(),
  };
}

function goTimeZoneAliasOffsetMs(name: string, date: Date): number | null {
  if (name !== "EET") {
    return null;
  }

  // Bun/Linux Intl doesn't expose every tzdb name Go can load. Keep the
  // upstream JSVM Timezone("EET") behavior with the European EET/EEST rule.
  const year = date.getUTCFullYear();
  const dstStart = lastSundayUtcMs(year, 2, 1);
  const dstEnd = lastSundayUtcMs(year, 9, 1);
  return date.getTime() >= dstStart && date.getTime() < dstEnd ? 3 * millisecondsPerHour : 2 * millisecondsPerHour;
}

function lastSundayUtcMs(year: number, month: number, hour: number): number {
  const date = new Date(Date.UTC(year, month + 1, 0, hour, 0, 0, 0));
  date.setUTCDate(date.getUTCDate() - date.getUTCDay());
  return date.getTime();
}

class Cookie {
  name = "";
  value = "";
  path = "";
  domain = "";
  maxAge = 0;
  secure = false;
  httpOnly = false;
  sameSite = 0;

  constructor(init: Partial<Cookie> = {}) {
    Object.assign(this, init);
  }

  string(): string {
    const parts: string[] = [];
    parts.push(`${this.name}=${this.value}`);
    if (this.path) {
      parts.push(`Path=${this.path}`);
    }
    if (this.domain) {
      parts.push(`Domain=${this.domain}`);
    }
    if (this.maxAge) {
      parts.push(`Max-Age=${this.maxAge}`);
    }
    if (this.httpOnly) {
      parts.push("HttpOnly");
    }
    if (this.secure) {
      parts.push("Secure");
    }
    const sameSite = sameSiteValue(this.sameSite);
    if (sameSite) {
      parts.push(`SameSite=${sameSite}`);
    }
    return parts.join("; ");
  }
}

function sameSiteValue(mode: number): string {
  switch (mode) {
    case 2:
      return "Lax";
    case 3:
      return "Strict";
    case 4:
      return "None";
    default:
      return "";
  }
}

class Middleware {
  func: (event: unknown) => unknown;
  priority?: number;
  id?: string;

  constructor(func: (event: unknown) => unknown, priority?: number, id?: string) {
    this.func = func;
    this.priority = priority;
    this.id = id;
  }

  get Func(): (event: unknown) => unknown {
    return this.func;
  }

  set Func(value: (event: unknown) => unknown) {
    this.func = value;
  }

  get Priority(): number | undefined {
    return this.priority;
  }

  set Priority(value: number | undefined) {
    this.priority = value;
  }

  get Id(): string | undefined {
    return this.id;
  }

  set Id(value: string | undefined) {
    this.id = value;
  }
}

class RequestInfo implements RequestInfoShape {
  query: Record<string, string> = {};
  headers: Record<string, string> = {};
  body: Record<string, unknown> = {};
  auth: RecordModel | null = null;
  method = "";
  context = RequestInfoContextDefault;

  constructor(data: Partial<RequestInfoShape> = {}) {
    Object.assign(this, data);
  }
}

type MailerAddress = {
  Name?: string;
  Address: string;
};

function normalizeMailerAddress(raw: unknown): MailerAddress {
  const normalized = {} as MailerAddress;
  if (raw && typeof raw === "object") {
    const source = raw as Record<string, unknown>;
    const name = source.Name ?? source.name ?? "";
    const address = source.Address ?? source.address ?? "";
    if (name) {
      normalized.Name = toPrimitiveString(name);
    }
    normalized.Address = toPrimitiveString(address ?? "");
  } else {
    normalized.Address = "";
  }
  Object.defineProperty(normalized, "name", {
    enumerable: false,
    configurable: true,
    get() {
      return normalized.Name ?? "";
    },
    set(value) {
      normalized.Name = toPrimitiveString(value ?? "");
    },
  });
  Object.defineProperty(normalized, "address", {
    enumerable: false,
    configurable: true,
    get() {
      return normalized.Address;
    },
    set(value) {
      normalized.Address = toPrimitiveString(value ?? "");
    },
  });
  return normalized;
}

function normalizeMailerAddressList(raw: unknown): MailerAddress[] {
  if (!raw) {
    return [];
  }
  if (Array.isArray(raw)) {
    return raw.map(normalizeMailerAddress);
  }
  return [normalizeMailerAddress(raw)];
}

function assignStructValues(target: Record<string, unknown>, values: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(values)) {
    if (key in target) {
      target[key] = value;
      continue;
    }
    const candidate = `${key.slice(0, 1).toUpperCase()}${key.slice(1)}`;
    if (candidate in target) {
      (target as Record<string, unknown>)[candidate] = value;
      continue;
    }
    target[key] = value;
  }
}

type StructCtor = new (...args: any[]) => object;

function wrapFieldCtor(Ctor: StructCtor): StructCtor {
  return class extends Ctor {
    constructor(...args: unknown[]) {
      super(...args);
      const values = (args[0] ?? {}) as Record<string, unknown>;
      assignStructValues(this as Record<string, unknown>, values);
      return wrapBoundValue(this as unknown as object) as object;
    }
  } as StructCtor;
}

function wrapStructCtor(Ctor: StructCtor, options: { wrapErrors?: boolean } = {}): StructCtor {
  return class extends Ctor {
    constructor(...args: unknown[]) {
      super(...args.map((arg) => unwrapBoundValue(arg)));
      return options.wrapErrors
        ? (wrapBoundObjectValue(this as unknown as object) as object)
        : (wrapBoundValue(this as unknown as object) as object);
    }
  } as StructCtor;
}

function wrapFactory<T extends (...args: any[]) => object>(factory: T, options: { wrapErrors?: boolean } = {}): T {
  return function wrappedFactory(...args: Parameters<T>): ReturnType<T> {
    const result = factory(...(args.map((arg) => unwrapBoundValue(arg)) as Parameters<T>));
    return (options.wrapErrors ? wrapBoundObjectValue(result) : wrapBoundValue(result)) as ReturnType<T>;
  } as unknown as T;
}

export function baseBinds(target: BindTarget): void {
  target.readerToString = (reader: unknown, maxBytes = DefaultMaxBodySize): string => {
    return toStringValue(reader, maxBytes);
  };
  target.toBytes = (raw: unknown, maxBytes = DefaultMaxBodySize): number[] => toBytes(raw, maxBytes);
  target["toString"] = (raw: unknown, maxBytes = DefaultMaxBodySize): string => toStringValue(raw, maxBytes);
  target.sleep = (milliseconds: number): void => sleep(milliseconds);
  target.arrayOf = (model: unknown): unknown[] => {
    const list: unknown[] = [];
    if (model && typeof model === "object") {
      const shape = (model as Record<string, unknown>)[DynamicModelShapeKey];
      if (shape && typeof shape === "object") {
        Object.defineProperty(list, DynamicModelShapeKey, { value: shape, enumerable: false });
        Object.defineProperty(list, DynamicModelFactoryKey, {
          value: () => createDynamicModelWithShape(shape as Record<string, string>),
          enumerable: false,
        });
      }
    }
    return list;
  };
  target.unmarshal = (data: unknown, dst: Record<string, unknown>): void => unmarshal(data, dst);
  target.Context = Context;
  target.DynamicModel = class DynamicModel {
    constructor(shape: DynamicShape) {
      if (!shape || typeof shape !== "object" || Object.keys(shape).length === 0) {
        throw new Error("[DynamicModel] missing shape data");
      }
      const model = createDynamicModel(shape);
      Object.assign(this, model);
      Object.defineProperty(this, DynamicModelShapeKey, {
        value: (model as Record<string, unknown>)[DynamicModelShapeKey],
        enumerable: false,
      });
    }
  };
  target.nullString = (): NullPlaceholder => new NullPlaceholder("string");
  target.nullFloat = (): NullPlaceholder => new NullPlaceholder("number");
  target.nullInt = (): NullPlaceholder => new NullPlaceholder("number");
  target.nullBool = (): NullPlaceholder => new NullPlaceholder("bool");
  target.nullArray = (): NullPlaceholder => new NullPlaceholder("array");
  target.nullObject = (): NullPlaceholder => new NullPlaceholder("object");
  target.Record = class RecordWrapper extends RecordModel {
    constructor(collection?: Collection, data?: Record<string, unknown>) {
      if (collection instanceof Collection) {
        super(collection, data ?? {}, true);
      } else {
        super(new Collection(), {}, true);
      }
      return wrapBoundValue(this as unknown as object) as RecordWrapper;
    }
  };
  target.Collection = class CollectionWrapper extends Collection {
    constructor(values?: Record<string, unknown>) {
      super();
      if (values !== undefined) {
        const err = this.UnmarshalJSON(JSON.stringify(values));
        if (err) {
          throw err;
        }
      }
      return wrapBoundValue(this as unknown as object) as CollectionWrapper;
    }
  };
  target.FieldsList = class FieldsListWrapper extends FieldsList {
    constructor(values: unknown[] = []) {
      super();
      if (Array.isArray(values) && values.length > 0) {
        this.AddMarshaledJSON(JSON.stringify(values));
      }
      return wrapBoundValue(this as unknown as object) as FieldsListWrapper;
    }
  };
  target.Field = class FieldWrapper {
    constructor(values: Record<string, unknown> = {}) {
      const raw = JSON.stringify([values]);
      const list = NewFieldsList();
      list.unmarshalJSON(raw);
      if (list.length === 0) {
        throw new Error("invalid field data");
      }
      return wrapBoundValue(list[0]) as unknown as FieldWrapper;
    }
  };
  target.newCollection = (typ: string, name: string, ...optId: string[]): Collection =>
    wrapBoundValue(NewCollection(typ, name, optId[0] ?? ""));
  target.newBaseCollection = (name: string, ...optId: string[]): Collection =>
    wrapBoundValue(NewBaseCollection(name, optId[0] ?? ""));
  target.newViewCollection = (name: string, ...optId: string[]): Collection =>
    wrapBoundValue(NewViewCollection(name, optId[0] ?? ""));
  target.newAuthCollection = (name: string, ...optId: string[]): Collection =>
    wrapBoundValue(NewAuthCollection(name, optId[0] ?? ""));
  target.NumberField = wrapFieldCtor(NumberField);
  target.BoolField = wrapFieldCtor(BoolField);
  target.TextField = wrapFieldCtor(TextField);
  target.URLField = wrapFieldCtor(URLField);
  target.EmailField = wrapFieldCtor(EmailField);
  target.EditorField = wrapFieldCtor(EditorField);
  target.PasswordField = wrapFieldCtor(PasswordField);
  target.DateField = wrapFieldCtor(DateField);
  target.AutodateField = wrapFieldCtor(AutodateField);
  target.JSONField = wrapFieldCtor(JSONField);
  target.RelationField = wrapFieldCtor(RelationField);
  target.SelectField = wrapFieldCtor(SelectField);
  target.FileField = wrapFieldCtor(FileField);
  target.GeoPointField = wrapFieldCtor(GeoPointField);
  target.MailerMessage = class MailerMessage {
    From: MailerAddress = normalizeMailerAddress(null);
    To: MailerAddress[] = [];
    Bcc: MailerAddress[] = [];
    Cc: MailerAddress[] = [];
    Subject = "";
    HTML = "";
    Text = "";
    Headers: Record<string, string> | null = null;
    Attachments: Record<string, unknown> | null = null;
    InlineAttachments: Record<string, unknown> | null = null;

    constructor(values: Record<string, unknown> = {}) {
      const source = values ?? {};

      if ("From" in source || "from" in source) {
        this.From = normalizeMailerAddress(source.From ?? source.from);
      }
      if ("To" in source || "to" in source) {
        this.To = normalizeMailerAddressList(source.To ?? source.to);
      }
      if ("Bcc" in source || "bcc" in source) {
        this.Bcc = normalizeMailerAddressList(source.Bcc ?? source.bcc);
      }
      if ("Cc" in source || "cc" in source) {
        this.Cc = normalizeMailerAddressList(source.Cc ?? source.cc);
      }
      if ("Subject" in source || "subject" in source) {
        this.Subject = toPrimitiveString(source.Subject ?? source.subject ?? "");
      }
      if ("HTML" in source || "html" in source) {
        this.HTML = toPrimitiveString(source.HTML ?? source.html ?? "");
      }
      if ("Text" in source || "text" in source) {
        this.Text = toPrimitiveString(source.Text ?? source.text ?? "");
      }
      if ("Headers" in source || "headers" in source) {
        this.Headers = (source.Headers ?? source.headers ?? null) as Record<string, string> | null;
      }
      if ("Attachments" in source || "attachments" in source) {
        this.Attachments = (source.Attachments ?? source.attachments ?? null) as Record<string, unknown> | null;
      }
      if ("InlineAttachments" in source || "inlineAttachments" in source) {
        this.InlineAttachments = (source.InlineAttachments ?? source.inlineAttachments ?? null) as Record<
          string,
          unknown
        > | null;
      }
    }

    get from(): MailerAddress {
      return this.From;
    }

    set from(value: MailerAddress) {
      this.From = normalizeMailerAddress(value);
    }

    get to(): MailerAddress[] {
      return this.To;
    }

    set to(value: MailerAddress[]) {
      this.To = normalizeMailerAddressList(value);
    }

    get bcc(): MailerAddress[] {
      return this.Bcc;
    }

    set bcc(value: MailerAddress[]) {
      this.Bcc = normalizeMailerAddressList(value);
    }

    get cc(): MailerAddress[] {
      return this.Cc;
    }

    set cc(value: MailerAddress[]) {
      this.Cc = normalizeMailerAddressList(value);
    }

    get subject(): string {
      return this.Subject;
    }

    set subject(value: string) {
      this.Subject = toPrimitiveString(value ?? "");
    }

    get html(): string {
      return this.HTML;
    }

    set html(value: string) {
      this.HTML = toPrimitiveString(value ?? "");
    }

    get text(): string {
      return this.Text;
    }

    set text(value: string) {
      this.Text = toPrimitiveString(value ?? "");
    }

    get headers(): Record<string, string> | null {
      return this.Headers;
    }

    set headers(value: Record<string, string> | null) {
      this.Headers = value ?? null;
    }

    get attachments(): Record<string, unknown> | null {
      return this.Attachments;
    }

    set attachments(value: Record<string, unknown> | null) {
      this.Attachments = value ?? null;
    }

    get inlineAttachments(): Record<string, unknown> | null {
      return this.InlineAttachments;
    }

    set inlineAttachments(value: Record<string, unknown> | null) {
      this.InlineAttachments = value ?? null;
    }

    toJSON(): Record<string, unknown> {
      return {
        from: this.From,
        to: this.To,
        bcc: this.Bcc,
        cc: this.Cc,
        subject: this.Subject,
        html: this.HTML,
        text: this.Text,
        headers: this.Headers,
        attachments: this.Attachments,
        inlineAttachments: this.InlineAttachments,
      };
    }
  };
  target.Command = class Command {
    use = "";
    run?: (cmd: unknown, args: unknown[]) => void;

    constructor(values: Record<string, unknown> = {}) {
      Object.assign(this, values);
    }
  };
  target.RequestInfo = RequestInfo;
  target.Middleware = Middleware;
  target.Timezone = Timezone;
  target.DateTime = class DateTimeWrapper extends DateTime {
    constructor(raw?: string, timezoneName?: string) {
      if (!raw) {
        super(NowDateTime().time());
        return;
      }
      if (timezoneName) {
        const tz = isValidTimeZone(timezoneName) ? timezoneName : "UTC";
        super(parseZonedDate(raw, tz));
        return;
      }
      super(new Date(raw.replace(" ", "T")));
    }
  };
  target.ValidationError = wrapStructCtor(
    class ValidationErrorWrapper extends ValidationError {
      constructor(code = "", message = "") {
        super(code, message);
      }
    },
    { wrapErrors: true },
  );
  target.Cookie = Cookie;
  target.SubscriptionMessage = class SubscriptionMessageWrapper {
    name = "";
    data: Uint8Array<ArrayBufferLike> = new Uint8Array();

    constructor(values: { name?: string; data?: string | Uint8Array } = {}) {
      this.name = values.name ?? "";
      const raw = values.data ?? new Uint8Array();
      this.data = typeof raw === "string" ? new TextEncoder().encode(raw) : (raw as Uint8Array);
    }
  };
}

function createDynamicModelWithShape(shape: Record<string, string>): Record<string, unknown> {
  const model: Record<string, unknown> = {};
  const keys = Object.keys(shape).sort();
  for (const key of keys) {
    const kind = shape[key];
    if (kind === "array") {
      model[key] = new JSONArray();
    } else if (kind === "object") {
      model[key] = new JSONMap();
    } else {
      model[key] = null;
    }
  }
  Object.defineProperty(model, DynamicModelShapeKey, {
    value: shape,
    enumerable: false,
  });
  return model;
}

export function dbxBinds(target: BindTarget): void {
  target.$dbx = {
    exp: (sql: string, params: Record<string, unknown> = {}) => NewExp(sql, params),
    hashExp: (data: Record<string, unknown>) => HashExp(data),
    not: Not,
    and: And,
    or: Or,
    in: In,
    notIn: NotIn,
    like: Like,
    orLike: OrLike,
    notLike: NotLike,
    orNotLike: OrNotLike,
    exists: Exists,
    notExists: NotExists,
    between: Between,
    notBetween: NotBetween,
  };
}

export function mailsBinds(target: BindTarget): void {
  target.$mails = {
    sendRecordPasswordReset: SendRecordPasswordReset,
    sendRecordVerification: SendRecordVerification,
    sendRecordChangeEmail: SendRecordChangeEmail,
    sendRecordOTP: SendRecordOTP,
    sendRecordAuthAlert: SendRecordAuthAlert,
  };
}

export function securityBinds(target: BindTarget): void {
  target.$security = {
    md5: MD5,
    sha256: SHA256,
    sha512: SHA512,
    hs256: HS256,
    hs512: HS512,
    equal: Equal,
    randomString,
    randomStringByRegex,
    randomStringWithAlphabet,
    pseudorandomString,
    pseudorandomStringWithAlphabet,
    parseUnverifiedJWT,
    parseJWT,
    createJWT: (payload: Record<string, unknown>, signingKey: string, secDuration: number) =>
      newJWT(payload, signingKey, secDuration),
    encrypt,
    decrypt: (cipherText: string, key: string) => new TextDecoder().decode(decrypt(cipherText, key)),
  };
}

type SyncFetchPayload = {
  status: number;
  headers: Array<[string, string]>;
  setCookie: string | null;
  bodyBase64: string;
};

type SyncFetchResponse = {
  status: number;
  headers: Array<[string, string]>;
  setCookie: string | null;
  body: Uint8Array;
};

const syncFetchScript = String.raw`
const { request: httpRequest } = require("node:http");
const { request: httpsRequest } = require("node:https");

const rawUrl = process.env.PB_SYNC_URL ?? "";
const method = process.env.PB_SYNC_METHOD ?? "GET";
const headers = JSON.parse(process.env.PB_SYNC_HEADERS ?? "{}");
const timeout = Math.max(1, Number(process.env.PB_SYNC_TIMEOUT ?? "120"));
const hasBody = process.env.PB_SYNC_HAS_BODY === "1";

if (!rawUrl) {
  console.error("missing url");
  process.exit(1);
}

(async () => {
  try {
    let body;
    if (hasBody) {
      const input = await new Response(Bun.stdin).arrayBuffer();
      body = new Uint8Array(input);
    }

    const lowerHeaders = {};
    for (const [key, value] of Object.entries(headers)) {
      lowerHeaders[key.toLowerCase()] = value;
    }
    if (body && !("content-length" in lowerHeaders)) {
      headers["content-length"] = String(body.length);
    }

    const url = new URL(rawUrl);
    const requestFn = url.protocol === "https:" ? httpsRequest : httpRequest;

    const payload = await new Promise((resolve, reject) => {
      const req = requestFn(
        url,
        { method, headers },
        (res) => {
          const chunks = [];
          let settled = false;
          const finishResolve = () => {
            if (settled) {
              return;
            }
            settled = true;
            const resBytes = Buffer.concat(chunks);
            const headerEntries = [];
            for (const [key, value] of Object.entries(res.headers)) {
              if (Array.isArray(value)) {
                for (const item of value) {
                  headerEntries.push([key, String(item)]);
                }
                continue;
              }
              if (value != null) {
                headerEntries.push([key, String(value)]);
              }
            }
            const setCookieHeader = res.headers["set-cookie"];
            const setCookie = Array.isArray(setCookieHeader)
              ? setCookieHeader.join("\n")
              : setCookieHeader ?? null;
            resolve({
              status: res.statusCode ?? 0,
              headers: headerEntries,
              setCookie,
              bodyBase64: Buffer.from(resBytes).toString("base64"),
            });
          };
          const finishReject = (err) => {
            if (settled) {
              return;
            }
            settled = true;
            reject(err);
          };
          res.on("data", (chunk) => chunks.push(chunk));
          res.on("end", finishResolve);
          res.on("close", finishResolve);
          res.on("error", finishReject);
          res.on("aborted", () => finishReject(new Error("response aborted")));
        },
      );

      req.setTimeout(timeout * 1000, () => {
        req.destroy(new Error("timeout"));
      });
      req.on("error", reject);

      if (body) {
        req.write(body);
      }
      req.end();
    });

    await new Promise((resolve, reject) => {
      process.stdout.on("error", reject);
      process.stdout.end(JSON.stringify(payload), (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(undefined);
      });
    });
  } catch (err) {
    console.error(String(err));
    process.exit(1);
  }
})();`;

function runSyncFetch(
  url: string,
  options: { method: string; headers: Record<string, string>; body?: Uint8Array | string; timeoutSeconds: number },
): SyncFetchResponse {
  const bodyBytes =
    options.body instanceof Uint8Array
      ? options.body
      : options.body != null
        ? new TextEncoder().encode(toPrimitiveString(options.body))
        : undefined;
  const env = {
    ...process.env,
    PB_SYNC_URL: url,
    PB_SYNC_METHOD: options.method,
    PB_SYNC_HEADERS: JSON.stringify(options.headers ?? {}),
    PB_SYNC_TIMEOUT: String(options.timeoutSeconds),
    PB_SYNC_HAS_BODY: bodyBytes ? "1" : "0",
  };
  const result = Bun.spawnSync({
    cmd: [process.execPath, "-e", syncFetchScript],
    env,
    stdin: bodyBytes,
    stdout: "pipe",
    stderr: "pipe",
  });

  if (result.exitCode !== 0) {
    const stderr = new TextDecoder().decode(result.stderr ?? new Uint8Array()).trim();
    const stdout = new TextDecoder().decode(result.stdout ?? new Uint8Array()).trim();
    throw new Error(stderr || stdout || "sync fetch failed");
  }

  const stderr = new TextDecoder().decode(result.stderr ?? new Uint8Array()).trim();
  const output = new TextDecoder().decode(result.stdout ?? new Uint8Array()).trim();
  if (!output) {
    throw new Error(stderr ? `sync fetch failed: empty response (${stderr})` : "sync fetch failed: empty response");
  }

  try {
    const payload = JSON.parse(output) as SyncFetchPayload;
    const body = Uint8Array.from(Buffer.from(payload.bodyBase64 ?? "", "base64"));
    return {
      status: payload.status,
      headers: payload.headers ?? [],
      setCookie: payload.setCookie ?? null,
      body,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown parse error";
    throw new Error(`sync fetch failed: invalid response (${message})`);
  }
}

export function filesystemBinds(target: BindTarget): void {
  target.$filesystem = {
    s3: NewS3,
    local: NewLocal,
    fileFromPath: NewFileFromPath,
    // PocketBun-only async alternative to fileFromPath.
    fileFromPathAsync: NewFileFromPathAsync,
    fileFromBytes: (bytes: unknown, name: string) => {
      let normalized: Uint8Array | null = null;
      if (bytes instanceof Uint8Array) {
        normalized = bytes;
      } else if (bytes instanceof ArrayBuffer) {
        normalized = new Uint8Array(bytes);
      } else if (Array.isArray(bytes)) {
        normalized = Uint8Array.from(bytes.map((value) => Number(value)));
      }
      return NewFileFromBytes(normalized, name);
    },
    fileFromMultipart: NewFileFromMultipart,
    fileFromURL: (url: string, secTimeout = 120) => {
      const headers = {
        "user-agent": "Go-http-client/1.1",
        "accept-encoding": "gzip",
      };
      const response = runSyncFetch(url, {
        method: "GET",
        headers,
        timeoutSeconds: secTimeout,
      });
      if (response.status < 200 || response.status >= 300) {
        throw new Error(`failed to download url ${url} (${response.status})`);
      }

      const rawName = basename(new URL(url).pathname);
      let originalName = rawName;
      try {
        originalName = decodeURIComponent(rawName);
      } catch {
        // Keep rawName if decoding fails.
      }
      return NewFileFromBytes(response.body, originalName);
    },
    // PocketBun-only async alternative to fileFromURL.
    fileFromURLAsync: async (url: string, secTimeout = 120) => {
      const headers = {
        "user-agent": "Go-http-client/1.1",
        "accept-encoding": "gzip",
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), secTimeout * 1000);
      try {
        const response = await fetch(url, {
          method: "GET",
          headers,
          signal: controller.signal,
        });
        if (response.status < 200 || response.status >= 300) {
          throw new Error(`failed to download url ${url} (${response.status})`);
        }

        const rawName = basename(new URL(url).pathname);
        let originalName = rawName;
        try {
          originalName = decodeURIComponent(rawName);
        } catch {
          // Keep rawName if decoding fails.
        }

        const body = new Uint8Array(await response.arrayBuffer());
        return NewFileFromBytes(body, originalName);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          throw new Error(`failed to download url ${url} (timeout)`);
        }
        throw error;
      } finally {
        clearTimeout(timeoutId);
      }
    },
  };
}

export function filepathBinds(target: BindTarget): void {
  target.$filepath = {
    base: basename,
    clean: normalize,
    dir: dirname,
    ext: extname,
    fromSlash: (path: string) => path.split("/").join(sep),
    glob: (pattern: string) => scanGlobSync(pattern),
    isAbs: isAbsolute,
    join,
    match: (pattern: string, name: string) => globMatch(pattern, name),
    rel: relative,
    split: (path: string) => [dirname(path), basename(path)] as [string, string],
    splitList: (path: string) => path.split(sep),
    toSlash: (path: string) => path.split(sep).join("/"),
    walk: (root: string, fn: (path: string, info: unknown, err: Error | null) => void) => walkPath(root, fn),
    walkDir: (root: string, fn: (path: string, entry: unknown, err: Error | null) => void) => walkDirPath(root, fn),
  };
}

function walkPath(root: string, fn: (path: string, info: unknown, err: Error | null) => void): void {
  const visit = (currentPath: string): void => {
    let info: ReturnType<typeof lstatSync> | null = null;
    try {
      info = lstatSync(currentPath);
    } catch (error) {
      fn(currentPath, null, error as Error);
      return;
    }

    fn(currentPath, info, null);
    if (!info.isDirectory()) {
      return;
    }

    let entries: Array<{ name: string }> = [];
    try {
      entries = readdirSync(currentPath, { withFileTypes: true });
    } catch (error) {
      fn(currentPath, info, error as Error);
      return;
    }

    sortEntriesLexically(entries);
    for (const entry of entries) {
      visit(join(currentPath, entry.name));
    }
  };

  visit(root);
}

function walkDirPath(root: string, fn: (path: string, entry: unknown, err: Error | null) => void): void {
  let rootInfo: ReturnType<typeof lstatSync> | null = null;
  try {
    rootInfo = lstatSync(root);
  } catch (error) {
    fn(root, null, error as Error);
    return;
  }

  const visit = (currentPath: string, entry: WalkDirEntryLike): void => {
    fn(currentPath, entry, null);
    if (!entry.isDirectory()) {
      return;
    }

    let entries: WalkDirEntryLike[] = [];
    try {
      entries = readdirSync(currentPath, { withFileTypes: true });
    } catch (error) {
      fn(currentPath, entry, error as Error);
      return;
    }

    sortEntriesLexically(entries);
    for (const child of entries) {
      visit(join(currentPath, child.name), child);
    }
  };

  visit(root, createWalkDirEntry(root, rootInfo));
}

type WalkDirEntryLike = {
  name: string;
  isBlockDevice: () => boolean;
  isCharacterDevice: () => boolean;
  isDirectory: () => boolean;
  isFIFO: () => boolean;
  isFile: () => boolean;
  isSocket: () => boolean;
  isSymbolicLink: () => boolean;
};

type WalkDirEntryInfo = NonNullable<ReturnType<typeof lstatSync>>;

function createWalkDirEntry(path: string, info: WalkDirEntryInfo): WalkDirEntryLike {
  return {
    name: basename(path) || path,
    isBlockDevice: () => info.isBlockDevice(),
    isCharacterDevice: () => info.isCharacterDevice(),
    isDirectory: () => info.isDirectory(),
    isFIFO: () => info.isFIFO(),
    isFile: () => info.isFile(),
    isSocket: () => info.isSocket(),
    isSymbolicLink: () => info.isSymbolicLink(),
  };
}

function sortEntriesLexically<T extends { name: string }>(entries: T[]): T[] {
  return entries.sort((left, right) => {
    if (left.name < right.name) {
      return -1;
    }
    if (left.name > right.name) {
      return 1;
    }
    return 0;
  });
}

export function osBinds(target: BindTarget): void {
  target.$os = {
    args: process.argv,
    exec: () => {
      throw new Error("exec is not supported in Bun hooks");
    },
    cmd: () => {
      throw new Error("cmd is not supported in Bun hooks");
    },
    exit: (code: number) => process.exit(code),
    getenv: (key: string) => process.env[key],
    dirFS: (path: string) => ({ root: path }),
    stat: (path: string) => statSync(path),
    // PocketBun-only async alternatives to keep hook-side I/O non-blocking when desired.
    statAsync: (path: string) => statAsync(path),
    readFile: (path: string) => readFileSync(path),
    readFileAsync: (path: string) => readFileAsync(path),
    writeFile: (path: string, data: string | Uint8Array) => writeFileSync(path, data),
    writeFileAsync: (path: string, data: string | Uint8Array) => writeFileAsync(path, data),
    readDir: (path: string) => readdirSync(path),
    readDirAsync: (path: string) => readdirAsync(path),
    tempDir: () => tmpdir(),
    truncate: (path: string, size: number) => truncateSync(path, size),
    truncateAsync: (path: string, size: number) => truncateAsync(path, size),
    getwd: () => process.cwd(),
    mkdir: (path: string) => mkdirSync(path),
    mkdirAsync: (path: string) => mkdirAsync(path),
    mkdirAll: (path: string) => mkdirSync(path, { recursive: true }),
    mkdirAllAsync: (path: string) => mkdirAsync(path, { recursive: true }),
    rename: (oldPath: string, newPath: string) => renameSync(oldPath, newPath),
    renameAsync: (oldPath: string, newPath: string) => renameAsync(oldPath, newPath),
    remove: (path: string) => rmSync(path),
    removeAsync: (path: string) => rmAsync(path),
    removeAll: (path: string) => rmSync(path, { recursive: true, force: true }),
    removeAllAsync: (path: string) => rmAsync(path, { recursive: true, force: true }),
    openRoot: () => {
      throw new Error("openRoot is not supported in Bun hooks");
    },
    openInRoot: () => {
      throw new Error("openInRoot is not supported in Bun hooks");
    },
  };
}

export function formsBinds(target: BindTarget): void {
  target.AppleClientSecretCreateForm = wrapStructCtor(AppleClientSecretCreate);
  target.RecordUpsertForm = wrapStructCtor(RecordUpsert);
  target.TestEmailSendForm = wrapStructCtor(TestEmailSend);
  target.TestS3FilesystemForm = wrapStructCtor(TestS3Filesystem);
}

export function apisBinds(target: BindTarget): void {
  target.$apis = {
    static: (dirOrFS: string | { root: string }, indexFallback: boolean) => {
      if (typeof dirOrFS === "string" || (dirOrFS && typeof dirOrFS === "object" && typeof dirOrFS.root === "string")) {
        return Static(dirOrFS, indexFallback);
      }

      throw new Error("$apis.static expects the first argument to be either a plain string path or fs.FS value");
    },
    requireGuestOnly: () => exposeHookHandler(RequireGuestOnly()),
    requireAuth: (...optCollectionNames: string[]) => exposeHookHandler(RequireAuth(...optCollectionNames)),
    requireSuperuserAuth: () => exposeHookHandler(RequireSuperuserAuth()),
    requireSuperuserOrOwnerAuth: (ownerIdPathParam: string) => exposeHookHandler(RequireSuperuserOrOwnerAuth(ownerIdPathParam)),
    skipSuccessActivityLog: () => exposeHookHandler(SkipSuccessActivityLog()),
    gzip: () => exposeHookHandler(Gzip()),
    bodyLimit: (limitBytes: number) => exposeHookHandler(BodyLimit(limitBytes)),
    recordAuthResponse: RecordAuthResponse,
    enrichRecord: EnrichRecord,
    enrichRecords: EnrichRecords,
  };

  target.ApiError = wrapStructCtor(ApiError, { wrapErrors: true });
  target.NotFoundError = wrapFactory(NewNotFoundError, { wrapErrors: true });
  target.BadRequestError = wrapFactory(NewBadRequestError, { wrapErrors: true });
  target.ForbiddenError = wrapFactory(NewForbiddenError, { wrapErrors: true });
  target.UnauthorizedError = wrapFactory(NewUnauthorizedError, { wrapErrors: true });
  target.TooManyRequestsError = wrapFactory(NewTooManyRequestsError, { wrapErrors: true });
  target.InternalServerError = wrapFactory(NewInternalServerError, { wrapErrors: true });
}

function exposeHookHandler<T>(handler: { Func: (event: T) => unknown; Id?: string; Priority?: number }): {
  func: (event: T) => unknown;
  id?: string;
  priority?: number;
  Func: (event: T) => unknown;
  Id?: string;
  Priority?: number;
} {
  const exposed = {
    func: handler.Func,
    id: handler.Id,
    priority: handler.Priority,
  } as {
    func: (event: T) => unknown;
    id?: string;
    priority?: number;
    Func: (event: T) => unknown;
    Id?: string;
    Priority?: number;
  };

  Object.defineProperties(exposed, {
    Func: {
      get() {
        return this.func;
      },
      set(value: (event: T) => unknown) {
        this.func = value;
      },
    },
    Id: {
      get() {
        return this.id;
      },
      set(value: string | undefined) {
        this.id = value;
      },
    },
    Priority: {
      get() {
        return this.priority;
      },
      set(value: number | undefined) {
        this.priority = value;
      },
    },
  });

  return exposed;
}

export function httpClientBinds(target: BindTarget): void {
  target.FormData = HooksFormData;

  target.$http = {
    send: (params: Record<string, unknown>) => {
      const method = toPrimitiveString(params.method ?? "GET").toUpperCase();
      const url = toPrimitiveString(params.url ?? "");
      const headers: Record<string, string> = {};
      const providedHeaders = params.headers as Record<string, string> | undefined;
      if (providedHeaders) {
        for (const [key, value] of Object.entries(providedHeaders)) {
          headers[key.toLowerCase()] = toPrimitiveString(value);
        }
      }
      if (!("user-agent" in headers)) {
        headers["user-agent"] = "Go-http-client/1.1";
      }
      if (!("accept-encoding" in headers)) {
        headers["accept-encoding"] = "gzip";
      }

      let body: Uint8Array | string | undefined;
      let contentTypeOverride: string | null = headers["content-type"] ?? null;

      if (params.body instanceof HooksFormData) {
        const { body: multipartBody, contentType } = params.body.toMultipart();
        body = multipartBody;
        contentTypeOverride = contentType;
      } else if (params.body != null) {
        body = toPrimitiveString(params.body);
      } else if (params.data && typeof params.data === "object") {
        body = JSON.stringify(params.data);
        if (!contentTypeOverride) {
          contentTypeOverride = "application/json";
        }
      }

      if (contentTypeOverride) {
        headers["content-type"] = contentTypeOverride;
      }

      const timeoutSeconds = Number(params.timeout ?? 120);
      const response = runSyncFetch(url, { method, headers, body, timeoutSeconds });

      const raw = new TextDecoder().decode(response.body);
      let json: unknown = null;
      try {
        json = JSON.parse(raw);
      } catch {
        // ignore
      }

      const headerMap: Record<string, string[]> = {};
      for (const [key, value] of response.headers) {
        const canonical = canonicalHeaderName(key);
        headerMap[canonical] = headerMap[canonical] ?? [];
        headerMap[canonical].push(value);
      }
      if (response.setCookie) {
        headerMap["Set-Cookie"] = headerMap["Set-Cookie"] ?? [];
        headerMap["Set-Cookie"].push(response.setCookie);
      }

      const cookies = parseCookies(headerMap["Set-Cookie"] ?? []);

      return {
        json,
        headers: headerMap,
        cookies,
        raw,
        body: response.body,
        statusCode: response.status,
      };
    },
    // PocketBun-only async alternative to send().
    sendAsync: async (params: Record<string, unknown>) => {
      const method = toPrimitiveString(params.method ?? "GET").toUpperCase();
      const url = toPrimitiveString(params.url ?? "");
      const headers: Record<string, string> = {};
      const providedHeaders = params.headers as Record<string, string> | undefined;
      if (providedHeaders) {
        for (const [key, value] of Object.entries(providedHeaders)) {
          headers[key.toLowerCase()] = toPrimitiveString(value);
        }
      }
      if (!("user-agent" in headers)) {
        headers["user-agent"] = "Go-http-client/1.1";
      }
      if (!("accept-encoding" in headers)) {
        headers["accept-encoding"] = "gzip";
      }

      let body: Uint8Array | string | undefined;
      let contentTypeOverride: string | null = headers["content-type"] ?? null;

      if (params.body instanceof HooksFormData) {
        const { body: multipartBody, contentType } = await params.body.toMultipartAsync();
        body = multipartBody;
        contentTypeOverride = contentType;
      } else if (params.body != null) {
        body = toPrimitiveString(params.body);
      } else if (params.data && typeof params.data === "object") {
        body = JSON.stringify(params.data);
        if (!contentTypeOverride) {
          contentTypeOverride = "application/json";
        }
      }

      if (contentTypeOverride) {
        headers["content-type"] = contentTypeOverride;
      }

      const timeoutSeconds = Number(params.timeout ?? 120);
      const controller = new AbortController();
      const timeoutHandle =
        timeoutSeconds > 0 ? setTimeout(() => controller.abort(new Error("timeout")), timeoutSeconds * 1000) : null;
      try {
        const response = await fetch(url, {
          method,
          headers,
          body,
          signal: controller.signal,
        });

        const bodyBytes = new Uint8Array(await response.arrayBuffer());
        const raw = new TextDecoder().decode(bodyBytes);
        let json: unknown = null;
        try {
          json = JSON.parse(raw);
        } catch {
          // ignore
        }

        const headerMap: Record<string, string[]> = {};
        for (const [key, value] of response.headers.entries()) {
          const canonical = canonicalHeaderName(key);
          headerMap[canonical] = headerMap[canonical] ?? [];
          headerMap[canonical].push(value);
        }

        const setCookie = response.headers.get("set-cookie");
        if (setCookie) {
          headerMap["Set-Cookie"] = headerMap["Set-Cookie"] ?? [];
          headerMap["Set-Cookie"].push(setCookie);
        }

        const cookies = parseCookies(headerMap["Set-Cookie"] ?? []);

        return {
          json,
          headers: headerMap,
          cookies,
          raw,
          body: bodyBytes,
          statusCode: response.status,
        };
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          throw new Error("timeout");
        }
        throw error;
      } finally {
        if (timeoutHandle != null) {
          clearTimeout(timeoutHandle);
        }
      }
    },
  };
}

function canonicalHeaderName(name: string): string {
  return name
    .split("-")
    .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() : part))
    .join("-");
}

function parseCookies(values: string[]): Record<string, { value: string }> {
  const result: Record<string, { value: string }> = {};
  for (const header of values) {
    const cookies = new Bun.CookieMap(header);
    for (const [name, value] of cookies) {
      result[name] = { value };
    }
  }
  return result;
}

export function hooksBinds(app: App, target: BindTarget): void {
  defineAppAccessor(target, app);

  const methodNames = new Set<string>();
  let proto: object | null = Object.getPrototypeOf(app);
  while (proto && proto !== Object.prototype) {
    for (const name of Object.getOwnPropertyNames(proto)) {
      methodNames.add(name);
    }
    proto = Object.getPrototypeOf(proto);
  }

  for (const methodName of methodNames) {
    if (!methodName.startsWith("On")) {
      continue;
    }
    if (methodName === "OnServe") {
      continue;
    }
    if (methodName === "OnRecordCreateOTPRequest") {
      continue;
    }
    const hookMethod = (app as unknown as Record<string, unknown>)[methodName];
    if (typeof hookMethod !== "function") {
      continue;
    }

    const jsName = convertGoToJSName(methodName);

    target[jsName] = (callback: (event: unknown) => unknown, ...tags: string[]) => {
      const hook = (hookMethod as (args?: string[]) => { BindFunc: (fn: (event: unknown) => unknown) => void }).call(app, tags);

      hook.BindFunc((event: unknown) => {
        const scopedApp = (event as { App?: App; app?: App }).App ?? (event as { app?: App }).app ?? app;
        return runWithApp(scopedApp, () => {
          const wrapped = wrapEvent(event as object);
          try {
            const result = callback(wrapped);
            if (result && typeof (result as PromiseLike<unknown>).then === "function") {
              return (result as Promise<unknown>).catch((err) => toErrorValue(err));
            }
            return result;
          } catch (err) {
            return toErrorValue(err);
          }
        });
      });
    };
  }
}

export function cronBinds(app: App, target: BindTarget): void {
  const cronAdd = (jobId: string, cronExpr: string, handler: () => void): void => {
    const err = app.Cron().Add(jobId, cronExpr, () => {
      try {
        handler();
      } catch (error) {
        app.Logger().Error("[cronAdd] failed to execute cron job", "jobId", jobId, "error", String(error));
      }
    });
    if (err) {
      throw new Error(`[cronAdd] failed to register cron job ${jobId}: ${err.message}`);
    }
  };

  target.cronAdd = cronAdd;
  target.cronRemove = (jobId: string): void => {
    app.Cron().Remove(jobId);
  };
}

export function routerBinds(app: App, target: BindTarget): void {
  target.routerAdd = (method: string, path: string, handler: (event: unknown) => unknown, ...middlewares: unknown[]) => {
    app.OnServe().BindFunc((e: ServeEvent) => {
      const wrappedHandler = (event: unknown) =>
        runWithApp(app, () => {
          const wrapped = wrapEvent(event as object);
          try {
            return handler(wrapped);
          } catch (err) {
            return err;
          }
        });

      const wrappedMiddlewares = middlewares.map((m) => wrapMiddleware(app, m));

      e.Router.Route(method.toUpperCase(), path, wrappedHandler as unknown as (event: unknown) => unknown).Bind(
        ...wrappedMiddlewares,
      );

      return e.Next();
    });
  };

  target.routerUse = (...middlewares: unknown[]) => {
    app.OnServe().BindFunc((e: ServeEvent) => {
      const wrappedMiddlewares = middlewares.map((m) => wrapMiddleware(app, m));
      e.Router.Bind(...wrappedMiddlewares);
      return e.Next();
    });
  };
}

export const BindCore = baseBinds;
export const BindDbx = dbxBinds;
export const BindMails = mailsBinds;
export const BindSecurity = securityBinds;
export const BindFilesystem = filesystemBinds;
export const BindFilepath = filepathBinds;
export const BindOS = osBinds;
export const BindForms = formsBinds;
export const BindApis = apisBinds;
export const BindHTTP = httpClientBinds;

function wrapMiddleware(app: App, middleware: unknown): { Func: (event: unknown) => unknown; Id?: string; Priority?: number } {
  if (middleware instanceof Middleware) {
    return {
      Func: (event: unknown) =>
        runWithApp(app, () => {
          const wrapped = wrapEvent(event as object);
          return middleware.func(wrapped);
        }),
      Id: middleware.id,
      Priority: middleware.priority,
    };
  }
  if (isHookHandler(middleware)) {
    const handler = middleware as {
      func?: (event: unknown) => unknown;
      id?: string;
      priority?: number;
      Func?: (event: unknown) => unknown;
      Id?: string;
      Priority?: number;
    };
    const fn = handler.func ?? handler.Func;
    if (typeof fn !== "function") {
      throw new Error("unsupported middleware type");
    }
    return {
      Func: (event: unknown) =>
        runWithApp(app, () => {
          const wrapped = wrapEvent(event as object);
          return fn(wrapped);
        }),
      Id: handler.id ?? handler.Id,
      Priority: handler.priority ?? handler.Priority,
    };
  }
  if (typeof middleware === "function") {
    return {
      Func: (event: unknown) =>
        runWithApp(app, () => {
          const wrapped = wrapEvent(event as object);
          return middleware(wrapped);
        }),
    };
  }
  throw new Error("unsupported middleware type");
}

function isHookHandler(value: unknown): value is {
  func?: (event: unknown) => unknown;
  id?: string;
  priority?: number;
  Func?: (event: unknown) => unknown;
  Id?: string;
  Priority?: number;
} {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const handler = value as { func?: unknown; Func?: unknown };
  return typeof handler.func === "function" || typeof handler.Func === "function";
}
