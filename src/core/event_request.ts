// Ported from pocketbase/core/event_request.go

import type { App } from "./app.ts";
import { ValidationError, ValidationErrors } from "../internal/compat/validation.ts";
import { Event } from "../tools/router/event.ts";
import { Record as RecordModel } from "./record.ts";

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

  constructor(options: {
    app: App;
    request: Request;
    params?: Record<string, string>;
    remoteAddress?: string | null;
    pattern?: string;
  }) {
    super({
      request: options.request,
      params: options.params,
      remoteAddress: options.remoteAddress,
    });
    this.app = options.app;
    this.auth = null;
    this.pattern = options.pattern ?? "";
  }

  realIP(): string {
    const settings = this.app.settings();

    for (const header of settings.trustedProxy.headers) {
      const headerValue = this.request.headers.get(header);
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

  BadRequestError(message: string, errData: unknown = null): Response {
    return this.json(400, {
      status: 400,
      message: message || "Something went wrong while processing your request.",
      data: safeErrorsData(errData),
    });
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
      context: infoContext,
      method: this.request.method,
      query: {},
      headers: {},
      body: {},
      auth: this.auth,
    };

    await this.bindBody(info.body);

    const url = new URL(this.request.url);
    for (const [key, value] of url.searchParams.entries()) {
      if (!(key in info.query)) {
        info.query[key] = value;
      }
    }

    for (const [key, value] of this.request.headers.entries()) {
      if (value) {
        const normalizedKey = snakecase(key ?? "");
        if (normalizedKey) {
          info.headers[normalizedKey] = value;
        }
      }
    }

    this.#cachedRequestInfo = info;
    return info;
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

    const contentType = this.request.headers.get("Content-Type") ?? "";
    if (!this.request.body) {
      return;
    }

    if (contentType.includes("application/json")) {
      try {
        const parsed = await this.request.clone().json();
        if (parsed && typeof parsed === "object") {
          this.#cachedBody = parsed as Record<string, unknown>;
          Object.assign(target, this.#cachedBody);
        }
      } catch {
        // ignore malformed JSON for now; upstream returns error later in request validation
      }
    }
  }

  setStopSignal(signal: { stopped: boolean; error?: Error } | null): void {
    this.#stopSignal = signal;
  }

  getStopSignal(): { stopped: boolean; error?: Error } | null {
    return this.#stopSignal;
  }
}

function snakecase(input: string): string {
  return input
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[-\s]+/g, "_")
    .toLowerCase();
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

function safeErrorsData(err: unknown): Record<string, unknown> {
  if (!err) {
    return {};
  }

  if (err instanceof AggregateError) {
    for (const inner of err.errors) {
      if (inner instanceof ValidationErrors || inner instanceof ValidationError) {
        return safeErrorsData(inner);
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
    const data: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(err.errors)) {
      if (value instanceof ValidationErrors) {
        data[key] = safeErrorsData(value);
        continue;
      }
      data[key] = resolveSafeErrorItem(value as Error);
    }
    return data;
  }

  if (err instanceof ValidationError) {
    return resolveSafeErrorItem(err);
  }

  if (err instanceof Error) {
    return { message: err.message };
  }

  return typeof err === "object" ? (err as Record<string, unknown>) : {};
}

function resolveSafeErrorItem(err: Error): Record<string, unknown> {
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
    return data;
  }

  if (err.message) {
    data.message = err.message;
  }

  return data;
}
