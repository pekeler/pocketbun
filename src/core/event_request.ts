// Ported from pocketbase/core/event_request.go

import type { App } from "./app.ts";
import { readRequestTextAndRebind } from "../internal/compat/request_body.ts";
import { Event } from "../tools/router/event.ts";
import { Record as RecordModel } from "./record_model.ts";

export const RequestInfoContextDefault = "default";
export const RequestInfoContextExpand = "expand";
export const RequestInfoContextRealtime = "realtime";
export const RequestInfoContextProtectedFile = "protectedFile";
export const RequestInfoContextBatch = "batch";
export const RequestInfoContextOAuth2 = "oauth2";
export const RequestInfoContextOTP = "otp";
export const RequestInfoContextPasswordAuth = "password";

// Common request store keys used by middlewares and handlers.
export const RequestEventKeyInfoContext = "infoContext";

// RequestInfo defines a HTTP request data struct, usually used
// as part of the `@request.*` filter resolver.
//
// The Query and Headers fields contains only the first value for each found entry.
export type RequestInfo = {
  query: Record<string, string>;
  headers: Record<string, string>;
  body: Record<string, unknown>;
  auth: RecordModel | null;
  method: string;
  context: string;
};

// RequestEvent defines the PocketBase router handler event.
export class RequestEvent extends Event {
  app: App;
  auth: RecordModel | null;
  pattern: string;
  #cachedRequestInfo: RequestInfo | null = null;
  #cachedBody: Record<string, unknown> | null = null;
  #stopSignal: { stopped: boolean; error?: Error } | null = null;
  #rawHeaders: Record<string, string[]> | null = null;

  constructor(options: {
    app: App;
    request: Request;
    params?: Record<string, string>;
    remoteAddress?: string | null;
    remoteAddressResolver?: (() => string | null) | null;
    pattern?: string;
    rawHeaders?: Record<string, string[]>;
    requestUrl?: URL;
  }) {
    super({
      request: options.request,
      params: options.params,
      remoteAddress: options.remoteAddress,
      remoteAddressResolver: options.remoteAddressResolver,
      requestUrl: options.requestUrl,
    });
    this.app = options.app;
    this.auth = null;
    this.pattern = options.pattern ?? "";
    if (options.rawHeaders) {
      const normalized: Record<string, string[]> = {};
      for (const [key, values] of Object.entries(options.rawHeaders)) {
        normalized[key.toLowerCase()] = values;
      }
      this.#rawHeaders = normalized;
    }
  }

  realIP(): string {
    const settings = this.app.settings();

    for (const header of settings.trustedProxy.headers) {
      const rawValues = this.#rawHeaders?.[header.toLowerCase()];
      const headerValue = rawValues?.length ? rawValues[rawValues.length - 1] : this.request.headers.get(header);
      if (!headerValue) {
        continue;
      }

      const ips = headerValue
        .split(",")
        .map((ip) => ip.trim())
        .filter(Boolean);
      if (ips.length === 0) {
        continue;
      }

      if (settings.trustedProxy.useLeftmostIP) {
        for (const ip of ips) {
          if (isValidIP(ip)) {
            return ip;
          }
        }
      } else {
        for (let i = ips.length - 1; i >= 0; i -= 1) {
          const ip = ips[i];
          if (!ip) {
            continue;
          }
          if (isValidIP(ip)) {
            return ip;
          }
        }
      }
    }

    return this.remoteIP();
  }

  hasSuperuserAuth(): boolean {
    return this.auth !== null && this.auth.isSuperuser();
  }

  async requestInfo(): Promise<RequestInfo> {
    if (this.#cachedRequestInfo) {
      this.#cachedRequestInfo.auth = this.auth;
      const infoContext = this.Get(RequestEventKeyInfoContext);
      if (typeof infoContext === "string" && infoContext) {
        this.#cachedRequestInfo.context = infoContext;
      } else {
        this.#cachedRequestInfo.context = RequestInfoContextDefault;
      }
      return this.#cachedRequestInfo;
    }

    const infoContextRaw = this.Get(RequestEventKeyInfoContext);
    const infoContext =
      typeof infoContextRaw === "string" && infoContextRaw !== "" ? infoContextRaw : RequestInfoContextDefault;

    const info: RequestInfo = {
      query: {},
      headers: {},
      body: await this.#resolveBoundBody(),
      auth: this.auth,
      method: this.request.method,
      context: infoContext,
    };

    // PocketBun perf deviation (behavior-compatible): lazily compute request query/headers.
    // Most hot paths read only `body`/`auth`, so avoid per-request map population unless needed.
    let lazyQuery: Record<string, string> | null = null;
    let lazyHeaders: Record<string, string> | null = null;

    Object.defineProperty(info, "query", {
      enumerable: true,
      configurable: true,
      get: () => {
        if (lazyQuery) {
          return lazyQuery;
        }
        const rawUrl = this.request.url;
        if (!rawUrl.includes("?")) {
          lazyQuery = {};
          return lazyQuery;
        }
        lazyQuery = parseRequestInfoQuery(this.requestUrl().searchParams);
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
        lazyHeaders = parseRequestInfoHeaders(this.request.headers);
        return lazyHeaders;
      },
      set: (value: Record<string, string>) => {
        lazyHeaders = value;
      },
    });

    this.#cachedRequestInfo = info;
    return info;
  }

  override async bindBody<T extends object>(target: T): Promise<void> {
    const body = await this.#resolveBoundBody();
    Object.assign(target, body);
  }

  setStopSignal(signal: { stopped: boolean; error?: Error } | null): void {
    this.#stopSignal = signal;
  }

  // setRequestInfo pre-populates the cached request info.
  // This is used by multipart fallback paths to avoid reparsing the request body.
  setRequestInfo(info: RequestInfo): void {
    this.#cachedRequestInfo = info;
    this.#cachedBody = info.body;
  }

  SetRequestInfo(info: RequestInfo): void {
    this.setRequestInfo(info);
  }

  getStopSignal(): { stopped: boolean; error?: Error } | null {
    return this.#stopSignal;
  }

  async #resolveBoundBody(): Promise<Record<string, unknown>> {
    if (this.#cachedRequestInfo) {
      return this.#cachedRequestInfo.body;
    }

    if (this.#cachedBody) {
      return this.#cachedBody;
    }

    let body: Record<string, unknown>;
    // PocketBun perf deviation (behavior-compatible for bindBody callers):
    // parse JSON directly from the original request stream to avoid clone()
    // overhead on hot write paths; the parsed object is cached for subsequent calls.
    const contentType = (this.request.headers.get("content-type") ?? "").toLowerCase();
    if (contentType.startsWith("application/json")) {
      const bound = await bindJSONBody(this.request);
      this.request = bound.request;
      body = bound.body;
    } else {
      body = {};
      await super.bindBody(body);
    }
    this.#cachedBody = body;
    return body;
  }
}

async function bindJSONBody(request: Request): Promise<{ request: Request; body: Record<string, unknown> }> {
  if (!request.body) {
    return { request, body: {} };
  }

  const contentLengthRaw = request.headers.get("content-length");
  if (contentLengthRaw !== null) {
    const contentLength = Number(contentLengthRaw);
    if (!Number.isNaN(contentLength) && contentLength === 0) {
      return { request, body: {} };
    }
  }

  const bound = await readRequestTextAndRebind(request);
  const rebound = bound.request;
  const raw = bound.text;
  if (raw.trim() === "") {
    return { request: rebound, body: {} };
  }

  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { request: rebound, body: {} };
  }

  return { request: rebound, body: parsed as Record<string, unknown> };
}

function snakecase(input: string): string {
  const cached = snakecaseCache.get(input);
  if (cached != null) {
    return cached;
  }

  const normalized = input
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[-\s]+/g, "_")
    .toLowerCase();

  // Keep the cache bounded since header names are low-cardinality in practice.
  if (snakecaseCache.size >= 256) {
    snakecaseCache.clear();
  }
  snakecaseCache.set(input, normalized);

  return normalized;
}

// PocketBun perf deviation (behavior-compatible): bounded cache for normalized header keys.
const snakecaseCache = new Map<string, string>();

function parseRequestInfoQuery(searchParams: URLSearchParams): Record<string, string> {
  const query: Record<string, string> = {};
  for (const [key, value] of searchParams.entries()) {
    if (!(key in query)) {
      query[key] = value;
    }
  }
  return query;
}

function parseRequestInfoHeaders(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of headers.entries()) {
    if (!value) {
      continue;
    }
    const normalizedKey = snakecase(key ?? "");
    if (!normalizedKey) {
      continue;
    }
    out[normalizedKey] = value;
  }
  return out;
}

function isValidIP(ip: string): boolean {
  if (ip.includes(":")) {
    return /^[0-9a-fA-F:]+$/.test(ip);
  }

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
