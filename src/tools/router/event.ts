// Ported from pocketbase/tools/router/event.go
// Deviation: Bun uses Request/Response instead of net/http ResponseWriter, so response helpers return Response values.
// Deviation: static file reads/stats use async fs APIs to avoid blocking the event loop under load.

import type { BodyInit } from "bun";
import type { Stats } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import type { NextFunc, Resolver } from "../hook/event.ts";
import { readRequestTextAndRebind } from "../../internal/compat/request_body.ts";
import {
  cleanupParsedMultipartFormData,
  multipartValueToFilesystemFile,
  parseMultipartFormData,
} from "../../internal/compat/request_form_data.ts";
import { File as FilesystemFile } from "../filesystem/file.ts";
import { Pick } from "../picker/pick.ts";
import { Store } from "../store/store.ts";
import {
  ApiError,
  NewApiError,
  NewBadRequestError,
  NewForbiddenError,
  NewInternalServerError,
  NewNotFoundError,
  NewTooManyRequestsError,
  NewUnauthorizedError,
} from "./api_error.ts";
import { unmarshalRequestData } from "./unmarshal_request_data.ts";

export const ErrUnsupportedContentType = NewBadRequestError("Unsupported Content-Type", null);
export const ErrInvalidRedirectStatusCode = NewInternalServerError("Invalid redirect status code", null);
export const ErrFileNotFound = NewNotFoundError("File not found", null);

export const IndexPage = "index.html";
export const DefaultMaxMemory = 32 << 20;

const headerContentType = "Content-Type";
const jsonFieldsParam = "fields";

type FileCacheEntry = {
  content: Uint8Array;
  contentType: string;
  mtimeMs: number;
  size: number;
};

// PocketBun-only: in-memory cache for static file responses (upstream reads from disk each time).
const fileCacheMaxBytes = 16 * 1024 * 1024;
const fileCacheMaxEntries = 256;
const fileCache = new Map<string, FileCacheEntry>();
let fileCacheBytes = 0;

export type CookieLike = {
  Name?: string;
  Value?: string;
  Path?: string;
  Domain?: string;
  Expires?: Date;
  MaxAge?: number;
  Secure?: boolean;
  HttpOnly?: boolean;
  SameSite?: "Strict" | "Lax" | "None";
};

type FormDataLike = {
  entries?: () => IterableIterator<[string, unknown]>;
  forEach?: (cb: (value: unknown, key: string) => void) => void;
  [Symbol.iterator]?: () => IterableIterator<[string, unknown]>;
};

type XmlChildNode = {
  tagName?: string;
  textContent?: string | null;
};

type XmlElementNode = {
  children?: Iterable<XmlChildNode> | ArrayLike<XmlChildNode> | null;
};

type XmlDocument = {
  documentElement: XmlElementNode | null;
};

type DomParserLike = {
  parseFromString: (raw: string, mime: string) => XmlDocument;
};

type EventOptions = {
  request: Request;
  params?: Record<string, string>;
  remoteAddress?: string | null;
  remoteAddressResolver?: (() => string | null) | null;
  next?: NextFunc | null;
  flush?: (() => void) | null;
  requestUrl?: URL;
};

type ResponseWriterCompat = {
  Header: () => Headers;
  header: () => Headers;
};

// Event specifies based Route handler event that is usually intended
// to be embedded as part of a custom event struct.
//
// NB! It is expected that the Response and Request fields are always set.
export class Event implements Resolver {
  // Compatibility shim for JSVM hooks expecting `e.response.header().set(...)`.
  Response: ResponseWriterCompat;
  request: Request;
  params: Record<string, string>;
  responseHeaders: Headers;
  #next: NextFunc | null;
  #remoteAddress: string | null;
  #remoteAddressResolved: boolean;
  #remoteAddressResolver: (() => string | null) | null;
  #data: Store<string, unknown>;
  #written = false;
  #status = 0;
  #flushHandler: (() => void) | null;
  #cachedUrl: URL | null = null;
  #cachedUrlRaw: string | null = null;
  // PocketBun perf deviation (behavior-compatible): cache `fields` query extraction per request.
  #cachedJsonFields: string | null | undefined = undefined;

  constructor(options: EventOptions) {
    this.request = options.request;
    this.params = options.params ?? {};
    this.responseHeaders = new Headers();
    const headerAccessor = () => this.responseHeaders;
    this.Response = {
      Header: headerAccessor,
      header: headerAccessor,
    };
    this.#next = options.next ?? null;
    this.#remoteAddress = options.remoteAddress ?? null;
    this.#remoteAddressResolved = !options.remoteAddressResolver;
    this.#remoteAddressResolver = options.remoteAddressResolver ?? null;
    this.#data = new Store();
    this.#flushHandler = options.flush ?? null;
    if (options.requestUrl) {
      this.#cachedUrl = options.requestUrl;
      this.#cachedUrlRaw = this.request.url;
    }
  }

  Next(): unknown {
    if (this.#next) {
      return this.#next();
    }
    return null;
  }

  nextFunc(): NextFunc | null {
    return this.#next;
  }

  setNextFunc(fn: NextFunc | null): void {
    this.#next = fn;
  }

  async next(): Promise<unknown> {
    return this.Next();
  }

  Written(): boolean {
    return this.#written;
  }

  Status(): number {
    return this.#status;
  }

  Flush(): Error | null {
    if (this.#flushHandler) {
      this.#flushHandler();
      return null;
    }
    return new Error("response doesn't support flush");
  }

  async Cleanup(): Promise<void> {
    await cleanupParsedMultipartFormData(this.request);
  }

  requestUrl(): URL {
    const raw = this.request.url;
    if (!this.#cachedUrl || this.#cachedUrlRaw !== raw) {
      this.#cachedUrl = new URL(raw);
      this.#cachedUrlRaw = raw;
    }
    return this.#cachedUrl;
  }

  IsTLS(): boolean {
    try {
      return this.requestUrl().protocol === "https:";
    } catch {
      return false;
    }
  }

  SetCookie(cookie: CookieLike): void {
    const serialized = serializeCookie(cookie);
    if (!serialized) {
      return;
    }
    this.responseHeaders.append("Set-Cookie", serialized);
  }

  RemoteIP(): string {
    const raw = this.#resolveRemoteAddress() ?? "";
    if (!raw) {
      return "invalid IP";
    }

    const host = extractHost(raw);
    if (!host) {
      return "invalid IP";
    }

    if (isIPv4(host)) {
      return host;
    }

    const expanded = expandIPv6(host);
    return expanded ?? "invalid IP";
  }

  remoteIP(): string {
    return this.RemoteIP();
  }

  #resolveRemoteAddress(): string | null {
    if (!this.#remoteAddressResolved) {
      this.#remoteAddress = this.#remoteAddressResolver?.() ?? null;
      this.#remoteAddressResolved = true;
      this.#remoteAddressResolver = null;
    }

    return this.#remoteAddress;
  }

  async FindUploadedFiles(key: string): Promise<FilesystemFile[]> {
    const form = await parseMultipartFormData(this.request, { preserveBody: true });
    const entries = form.getAll(key);
    if (!entries.length) {
      throw ErrFileNotFound;
    }

    const files: FilesystemFile[] = [];
    for (const entry of entries) {
      const file = await multipartValueToFilesystemFile(entry);
      if (!file) {
        continue;
      }
      files.push(file);
    }

    if (files.length === 0) {
      throw ErrFileNotFound;
    }

    return files;
  }

  // Store
  // -------------------------------------------------------------------

  // Get retrieves single value from the current event data store.
  Get(key: string): unknown {
    return this.#data.get(key);
  }

  // GetAll returns a copy of the current event data store.
  GetAll(): Record<string, unknown> {
    return this.#data.toJSON();
  }

  // Set saves single value into the current event data store.
  Set(key: string, value: unknown): void {
    this.#data.set(key, value);
  }

  // SetAll saves all items from m into the current event data store.
  SetAll(data: Record<string, unknown>): void {
    for (const [key, value] of Object.entries(data)) {
      this.#data.set(key, value);
    }
  }

  // Response writers
  // -------------------------------------------------------------------

  String(status: number, data: string): Response {
    this.setResponseHeaderIfEmpty(headerContentType, "text/plain; charset=utf-8");
    return this.buildResponse(status, data);
  }

  HTML(status: number, data: string): Response {
    this.setResponseHeaderIfEmpty(headerContentType, "text/html; charset=utf-8");
    return this.buildResponse(status, data);
  }

  JSON(status: number, data: unknown): Response {
    this.setResponseHeaderIfEmpty(headerContentType, "application/json");

    let output = data;
    if (status >= 200 && status <= 299) {
      const rawFields = this.cachedJsonFields();
      if (rawFields) {
        output = Pick(data, rawFields);
      }
    }

    const payload = JSON.stringify(output) + "\n";
    return this.buildResponse(status, payload);
  }

  XML(status: number, data: unknown): Response {
    this.setResponseHeaderIfEmpty(headerContentType, "application/xml; charset=utf-8");
    const payload = `${xmlHeader()}${serializeXml(data)}`;
    return this.buildResponse(status, payload);
  }

  Stream(status: number, contentType: string, reader: BodyInit): Response {
    this.responseHeaders.set(headerContentType, contentType);
    return this.buildResponse(status, reader);
  }

  Blob(status: number, contentType: string, blob: Uint8Array): Response {
    this.setResponseHeaderIfEmpty(headerContentType, contentType);
    return this.buildResponse(status, blob);
  }

  async FileFS(fsys: string | { root: string }, filename: string): Promise<Response | ApiError> {
    if (!filename) {
      return ErrFileNotFound;
    }

    const root = typeof fsys === "string" ? fsys : fsys.root;
    if (!root) {
      return ErrFileNotFound;
    }

    let resolved = join(root, filename);
    let stats: Stats;

    try {
      stats = await stat(resolved);
    } catch {
      return ErrFileNotFound;
    }

    if (stats.isDirectory()) {
      resolved = join(resolved, IndexPage);
      try {
        stats = await stat(resolved);
      } catch {
        return ErrFileNotFound;
      }
    }

    const cached = fileCache.get(resolved);
    if (cached && cached.mtimeMs === stats.mtimeMs && cached.size === stats.size) {
      fileCache.delete(resolved);
      fileCache.set(resolved, cached);
      this.setResponseHeaderIfEmpty(headerContentType, cached.contentType);
      this.responseHeaders.set("Content-Length", String(cached.size));
      return this.buildResponse(200, cached.content);
    }

    const contentType = Bun.file(resolved).type || "application/octet-stream";
    this.setResponseHeaderIfEmpty(headerContentType, contentType);

    const content = await readFile(resolved);
    this.responseHeaders.set("Content-Length", String(content.length));

    cacheFile(resolved, {
      content,
      contentType,
      mtimeMs: stats.mtimeMs,
      size: content.length,
    });

    return this.buildResponse(200, content);
  }

  NoContent(status: number): Response {
    return this.buildResponse(status, null);
  }

  Redirect(status: number, url: string): Response | ApiError {
    if (status < 300 || status > 399) {
      return ErrInvalidRedirectStatusCode;
    }
    this.responseHeaders.set("Location", url);
    return this.buildResponse(status, null);
  }

  json(status: number, body: unknown): Response {
    return this.JSON(status, body);
  }

  html(status: number, body: string): Response {
    return this.HTML(status, body);
  }

  string(status: number, body: string): Response {
    return this.String(status, body);
  }

  xml(status: number, body: unknown): Response {
    return this.XML(status, body);
  }

  stream(status: number, contentType: string, reader: BodyInit): Response {
    return this.Stream(status, contentType, reader);
  }

  blob(status: number, contentType: string, blob: Uint8Array): Response {
    return this.Blob(status, contentType, blob);
  }

  noContent(status: number): Response {
    return this.NoContent(status);
  }

  redirect(status: number, url: string): Response | ApiError {
    return this.Redirect(status, url);
  }

  // ApiError helpers
  // -------------------------------------------------------------------

  Error(status: number, message: string, errData: unknown): ApiError {
    return NewApiError(status, message, errData);
  }

  BadRequestError(message: string, errData: unknown): ApiError {
    return NewBadRequestError(message, errData);
  }

  NotFoundError(message: string, errData: unknown): ApiError {
    return NewNotFoundError(message, errData);
  }

  ForbiddenError(message: string, errData: unknown): ApiError {
    return NewForbiddenError(message, errData);
  }

  UnauthorizedError(message: string, errData: unknown): ApiError {
    return NewUnauthorizedError(message, errData);
  }

  TooManyRequestsError(message: string, errData: unknown): ApiError {
    return NewTooManyRequestsError(message, errData);
  }

  InternalServerError(message: string, errData: unknown): ApiError {
    return NewInternalServerError(message, errData);
  }

  // Binders
  // -------------------------------------------------------------------

  async bindBody<T extends object>(target: T): Promise<void> {
    if (!this.request.body) {
      return;
    }

    const contentLengthRaw = this.request.headers.get("content-length");
    if (contentLengthRaw !== null) {
      const contentLength = Number(contentLengthRaw);
      if (!Number.isNaN(contentLength) && contentLength === 0) {
        return;
      }
    }

    const contentType = (this.request.headers.get(headerContentType) ?? "").toLowerCase();

    if (contentType.startsWith("application/json")) {
      const bound = await readRequestTextAndRebind(this.request);
      this.request = bound.request;
      const parsed = JSON.parse(bound.text) as unknown;
      if (parsed && typeof parsed === "object") {
        Object.assign(target, parsed as object);
      }
      return;
    }

    if (contentType.startsWith("multipart/form-data") || contentType === "") {
      try {
        const form = await parseMultipartFormData(this.request, { preserveBody: true });
        const data = collectFormData(form);
        const err = unmarshalRequestData(data, target as Record<string, unknown>);
        if (err) {
          throw err;
        }
        return;
      } catch (error) {
        if (contentType.startsWith("multipart/form-data")) {
          throw error;
        }
      }
    }

    if (contentType.startsWith("application/x-www-form-urlencoded")) {
      const bound = await readRequestTextAndRebind(this.request);
      this.request = bound.request;
      const raw = bound.text;
      const params = new URLSearchParams(raw);
      const data: Record<string, string[]> = {};
      for (const [key, value] of params.entries()) {
        data[key] = data[key] ?? [];
        data[key]?.push(value);
      }
      const err = unmarshalRequestData(data, target as Record<string, unknown>);
      if (err) {
        throw err;
      }
      return;
    }

    if (contentType.startsWith("text/xml") || contentType.startsWith("application/xml")) {
      const bound = await readRequestTextAndRebind(this.request);
      this.request = bound.request;
      const raw = bound.text;
      const data = parseXmlBody(raw);
      const err = unmarshalRequestData(data, target as Record<string, unknown>);
      if (err) {
        throw err;
      }
      return;
    }

    throw ErrUnsupportedContentType;
  }

  async BindBody<T extends object>(target: T): Promise<void> {
    return this.bindBody(target);
  }

  private setResponseHeaderIfEmpty(key: string, value: string): void {
    if (!this.responseHeaders.has(key)) {
      this.responseHeaders.set(key, value);
    }
  }

  private cachedJsonFields(): string | null {
    if (this.#cachedJsonFields !== undefined) {
      return this.#cachedJsonFields;
    }

    const rawUrl = this.request.url;
    if (!rawUrl.includes("?") || !rawUrl.includes(`${jsonFieldsParam}=`)) {
      this.#cachedJsonFields = null;
      return this.#cachedJsonFields;
    }

    const rawFields = this.requestUrl().searchParams.get(jsonFieldsParam);
    this.#cachedJsonFields = rawFields && rawFields !== "" ? rawFields : null;
    return this.#cachedJsonFields;
  }

  private buildResponse(status: number, body: BodyInit | null): Response {
    this.#written = true;
    this.#status = status;

    // PocketBun perf deviation (behavior-compatible): branch on valid status range to keep
    // the common response path exception-free; preserve upstream-compatible fallback behavior
    // for non-standard test statuses.
    if (Number.isInteger(status) && status >= 200 && status <= 599) {
      return new Response(body, {
        status,
        headers: this.responseHeaders,
      });
    }

    const fallback = new Response(body, {
      status: 200,
      headers: this.responseHeaders,
    });
    Object.defineProperty(fallback, "status", { value: status });
    return fallback;
  }
}

function cacheFile(path: string, entry: FileCacheEntry): void {
  if (entry.size > fileCacheMaxBytes) {
    return;
  }

  const existing = fileCache.get(path);
  if (existing) {
    fileCacheBytes -= existing.size;
    fileCache.delete(path);
  }

  while (fileCache.size >= fileCacheMaxEntries || fileCacheBytes + entry.size > fileCacheMaxBytes) {
    const oldestKey = fileCache.keys().next().value as string | undefined;
    if (!oldestKey) {
      break;
    }
    const oldest = fileCache.get(oldestKey);
    if (oldest) {
      fileCacheBytes -= oldest.size;
    }
    fileCache.delete(oldestKey);
  }

  fileCache.set(path, entry);
  fileCacheBytes += entry.size;
}

function serializeCookie(cookie: CookieLike): string {
  const name = cookie.Name ?? "";
  const value = cookie.Value ?? "";
  if (!name) {
    return "";
  }

  const parts = [`${name}=${value}`];
  if (cookie.Path) {
    parts.push(`Path=${cookie.Path}`);
  }
  if (cookie.Domain) {
    parts.push(`Domain=${cookie.Domain}`);
  }
  if (cookie.MaxAge != null) {
    parts.push(`Max-Age=${cookie.MaxAge}`);
  }
  if (cookie.Expires instanceof Date) {
    parts.push(`Expires=${cookie.Expires.toUTCString()}`);
  }
  if (cookie.Secure) {
    parts.push("Secure");
  }
  if (cookie.HttpOnly) {
    parts.push("HttpOnly");
  }
  if (cookie.SameSite) {
    parts.push(`SameSite=${cookie.SameSite}`);
  }

  return parts.join("; ");
}

function extractHost(remoteAddr: string): string | null {
  if (!remoteAddr) {
    return null;
  }
  if (remoteAddr.startsWith("[")) {
    const end = remoteAddr.indexOf("]");
    if (end === -1) {
      return null;
    }
    return remoteAddr.slice(1, end);
  }

  const lastColon = remoteAddr.lastIndexOf(":");
  if (lastColon === -1) {
    return null;
  }

  const host = remoteAddr.slice(0, lastColon);
  return host || null;
}

function isIPv4(ip: string): boolean {
  const parts = ip.split(".");
  if (parts.length !== 4) {
    return false;
  }
  return parts.every((part) => {
    if (!/^[0-9]+$/.test(part)) {
      return false;
    }
    const value = Number(part);
    return value >= 0 && value <= 255;
  });
}

function expandIPv6(input: string): string | null {
  let ip = input.toLowerCase();
  const zoneIndex = ip.indexOf("%");
  if (zoneIndex >= 0) {
    ip = ip.slice(0, zoneIndex);
  }

  const hasIPv4 = ip.includes(".");
  let ipv4Part = "";
  if (hasIPv4) {
    const lastColon = ip.lastIndexOf(":");
    ipv4Part = ip.slice(lastColon + 1);
    ip = ip.slice(0, lastColon);
  }

  const [leftRaw, rightRaw] = ip.split("::");
  const left = leftRaw ? leftRaw.split(":").filter(Boolean) : [];
  const right = rightRaw ? rightRaw.split(":").filter(Boolean) : [];

  const ipv4Groups = hasIPv4 ? 1 : 0;
  const missing = 8 - (left.length + right.length + ipv4Groups);
  if (missing < 0) {
    return null;
  }

  const parts = [...left, ...Array.from({ length: missing }, () => "0"), ...right];

  if (hasIPv4) {
    const nums = ipv4Part.split(".").map((part) => Number(part));
    if (nums.length !== 4 || nums.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
      return null;
    }
    const [n0, n1, n2, n3] = nums;
    if (n0 === undefined || n1 === undefined || n2 === undefined || n3 === undefined) {
      return null;
    }
    const high = ((n0 << 8) | n1).toString(16);
    const low = ((n2 << 8) | n3).toString(16);
    parts.push(high, low);
  }

  if (parts.length !== 8) {
    return null;
  }

  return parts.map((part) => part.padStart(4, "0")).join(":");
}

function collectFormData(form: FormDataLike): Record<string, string[]> {
  const data: Record<string, string[]> = {};
  const appendValue = (key: string, value: unknown): void => {
    if (typeof value !== "string") {
      return;
    }
    data[key] = data[key] ?? [];
    data[key]?.push(value);
  };

  let lastError: Error | null = null;

  if (typeof form.forEach === "function") {
    try {
      form.forEach((value, key) => {
        appendValue(key, value);
      });
      return data;
    } catch (error) {
      lastError = error as Error;
    }
  }

  if (typeof form.entries === "function") {
    try {
      for (const [key, value] of form.entries()) {
        appendValue(key, value);
      }
      return data;
    } catch (error) {
      lastError = error as Error;
    }
  }

  if (typeof form[Symbol.iterator] === "function") {
    try {
      for (const [key, value] of form as unknown as Iterable<[string, unknown]>) {
        appendValue(key, value);
      }
      return data;
    } catch (error) {
      lastError = error as Error;
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new TypeError("invalid multipart form data object");
}

function parseXmlBody(raw: string): Record<string, string[]> {
  const result: Record<string, string[]> = {};

  const domParserCtor = (globalThis as { DOMParser?: { new (): DomParserLike } }).DOMParser;
  if (domParserCtor) {
    const parser = new domParserCtor();
    const doc = parser.parseFromString(raw, "application/xml");
    const root = doc.documentElement;
    if (root) {
      const children = root.children ?? [];
      for (const child of Array.from(children as ArrayLike<XmlChildNode>)) {
        const key = typeof child.tagName === "string" ? child.tagName : "";
        const value = typeof child.textContent === "string" ? child.textContent : "";
        result[key] = result[key] ?? [];
        result[key]?.push(value);
      }
      if (Object.keys(result).length > 0) {
        return result;
      }
    }
  }

  const regex = new RegExp("<([A-Za-z0-9_:-]+)>([^<]*)</\\1>", "g");
  let match: RegExpExecArray | null;
  while ((match = regex.exec(raw)) !== null) {
    const key = match[1] ?? "";
    const value = match[2] ?? "";
    if (!key) {
      continue;
    }
    result[key] = result[key] ?? [];
    result[key]?.push(value);
  }

  return result;
}

function xmlHeader(): string {
  return '<?xml version="1.0" encoding="UTF-8"?>\n';
}

function serializeXml(value: unknown): string {
  if (typeof value === "string") {
    return `<string>${escapeXml(value)}</string>`;
  }
  if (typeof value === "number") {
    return `<number>${value}</number>`;
  }
  if (typeof value === "boolean") {
    return `<boolean>${value}</boolean>`;
  }
  if (value && typeof value === "object") {
    const parts: string[] = [];
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      const raw =
        entry == null
          ? ""
          : typeof entry === "string" || typeof entry === "number" || typeof entry === "boolean"
            ? String(entry)
            : JSON.stringify(entry);
      parts.push(`<${key}>${escapeXml(raw)}</${key}>`);
    }
    return parts.join("");
  }
  return "<null></null>";
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
