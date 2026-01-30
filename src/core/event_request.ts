import { Event } from "../tools/router/event.ts";
import type { App } from "./app.ts";
import { Record } from "./record.ts";

export const RequestInfoContextDefault = "default";
export const RequestInfoContextExpand = "expand";
export const RequestInfoContextRealtime = "realtime";
export const RequestInfoContextProtectedFile = "protectedFile";
export const RequestInfoContextBatch = "batch";
export const RequestInfoContextOAuth2 = "oauth2";
export const RequestInfoContextOTP = "otp";
export const RequestInfoContextPasswordAuth = "password";

export type RequestInfo = {
  query: Record<string, string>;
  headers: Record<string, string>;
  body: Record<string, unknown>;
  auth: Record | null;
  method: string;
  context: string;
};

export class RequestEvent extends Event {
  app: App;
  auth: Record | null;
  #cachedRequestInfo: RequestInfo | null = null;

  constructor(options: {
    app: App;
    request: Request;
    params?: Record<string, string>;
    remoteAddress?: string | null;
  }) {
    super({
      request: options.request,
      params: options.params,
      remoteAddress: options.remoteAddress,
    });
    this.app = options.app;
    this.auth = null;
  }

  realIP(): string {
    const settings = this.app.settings();

    for (const header of settings.trustedProxy.headers) {
      const headerValue = this.request.headers.get(header);
      if (!headerValue) {
        continue;
      }

      const ips = headerValue.split(",").map((ip) => ip.trim()).filter(Boolean);
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
      return this.#cachedRequestInfo;
    }

    const info: RequestInfo = {
      context: RequestInfoContextDefault,
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
        info.headers[snakecase(key)] = value;
      }
    }

    this.#cachedRequestInfo = info;
    return info;
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
