// Ported from pocketbase/core/event_request.go

import type { App } from "./app.ts";
import { profileEnabled, recordProfile } from "../tools/perf/profile.ts";
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
    pattern?: string;
    rawHeaders?: Record<string, string[]>;
    requestUrl?: URL;
  }) {
    super({
      request: options.request,
      params: options.params,
      remoteAddress: options.remoteAddress,
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

    const doProfile = profileEnabled();
    const totalStart = doProfile ? performance.now() : 0;
    try {
      const infoContextRaw = this.Get(RequestEventKeyInfoContext);
      const infoContext =
        typeof infoContextRaw === "string" && infoContextRaw !== "" ? infoContextRaw : RequestInfoContextDefault;

      const info: RequestInfo = {
        query: {},
        headers: {},
        body: {},
        auth: this.auth,
        method: this.request.method,
        context: infoContext,
      };

      const bodyStart = doProfile ? performance.now() : 0;
      await this.bindBody(info.body);
      if (doProfile) {
        recordProfile("request_info.body", performance.now() - bodyStart);
      }

      const queryStart = doProfile ? performance.now() : 0;
      const url = this.requestUrl();
      for (const [key, value] of url.searchParams.entries()) {
        if (!(key in info.query)) {
          info.query[key] = value;
        }
      }
      if (doProfile) {
        recordProfile("request_info.query", performance.now() - queryStart);
      }

      const headersStart = doProfile ? performance.now() : 0;
      for (const [key, value] of this.request.headers.entries()) {
        if (value) {
          const normalizedKey = snakecase(key ?? "");
          if (normalizedKey) {
            info.headers[normalizedKey] = value;
          }
        }
      }
      if (doProfile) {
        recordProfile("request_info.headers", performance.now() - headersStart);
      }

      this.#cachedRequestInfo = info;
      return info;
    } finally {
      if (doProfile) {
        recordProfile("request_info.total", performance.now() - totalStart);
      }
    }
  }

  override async bindBody<T extends object>(target: T): Promise<void> {
    if (this.#cachedRequestInfo) {
      Object.assign(target, this.#cachedRequestInfo.body);
      return;
    }

    if (this.#cachedBody) {
      Object.assign(target, this.#cachedBody);
      return;
    }

    const body: Record<string, unknown> = {};
    await super.bindBody(body);
    this.#cachedBody = body;
    Object.assign(target, body);
  }

  setStopSignal(signal: { stopped: boolean; error?: Error } | null): void {
    this.#stopSignal = signal;
  }

  getStopSignal(): { stopped: boolean; error?: Error } | null {
    return this.#stopSignal;
  }
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

const snakecaseCache = new Map<string, string>();

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
