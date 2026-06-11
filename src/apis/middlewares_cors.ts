// Ported from pocketbase/apis/middlewares_cors.go

import type { RequestEvent } from "../core/event_request.ts";
import type { BoundHandler } from "../tools/hook/hook.ts";
import { DefaultActivityLoggerMiddlewarePriority } from "./middlewares.ts";

export const DefaultCorsMiddlewareId = "pbCors";
export const DefaultCorsMiddlewarePriority = DefaultActivityLoggerMiddlewarePriority - 1;

export type CORSConfig = {
  AllowOrigins?: string[];
  AllowOriginFunc?: ((origin: string) => boolean | Promise<boolean>) | null;
  AllowMethods?: string[];
  AllowHeaders?: string[];
  AllowCredentials?: boolean;
  UnsafeWildcardOriginWithAllowCredentials?: boolean;
  ExposeHeaders?: string[];
  MaxAge?: number;
};

export const DefaultCORSConfig: Required<
  Pick<CORSConfig, "AllowOrigins" | "AllowMethods" | "AllowHeaders" | "AllowCredentials" | "ExposeHeaders" | "MaxAge">
> = {
  AllowOrigins: ["*"],
  AllowMethods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"],
  AllowHeaders: [],
  AllowCredentials: false,
  ExposeHeaders: [],
  MaxAge: 0,
};

export function CORS(config: CORSConfig): BoundHandler<RequestEvent> {
  const resolved: CORSConfig = { ...config };

  if (!resolved.AllowOrigins || resolved.AllowOrigins.length === 0) {
    resolved.AllowOrigins = DefaultCORSConfig.AllowOrigins;
  }
  if (!resolved.AllowMethods || resolved.AllowMethods.length === 0) {
    resolved.AllowMethods = DefaultCORSConfig.AllowMethods;
  }

  const allowOrigins = resolved.AllowOrigins;
  const allowOriginPatterns = allowOrigins
    .filter((origin) => origin !== "*")
    .map((origin) => buildOriginPattern(origin))
    .filter((pattern): pattern is RegExp => Boolean(pattern));

  const allowMethods = (resolved.AllowMethods ?? []).join(",");
  const allowHeaders = (resolved.AllowHeaders ?? []).join(",");
  const exposeHeaders = (resolved.ExposeHeaders ?? []).join(",");
  const maxAge = resolved.MaxAge && resolved.MaxAge > 0 ? String(resolved.MaxAge) : "0";

  return {
    Id: DefaultCorsMiddlewareId,
    Priority: DefaultCorsMiddlewarePriority,
    Func: async (event) => {
      const origin = event.request.headers.get("Origin") ?? "";
      event.responseHeaders.append("Vary", "Origin");

      const method = event.request.method.toUpperCase();
      const preflight = method === "OPTIONS";

      if (!origin) {
        if (!preflight) {
          return event.Next();
        }
        return event.NoContent(204);
      }

      let allowOrigin = "";

      if (resolved.AllowOriginFunc) {
        const allowed = await resolved.AllowOriginFunc(origin);
        if (allowed) {
          allowOrigin = origin;
        }
      } else {
        for (const allowedOrigin of allowOrigins) {
          if (allowedOrigin === "*" && resolved.AllowCredentials && resolved.UnsafeWildcardOriginWithAllowCredentials) {
            allowOrigin = origin;
            break;
          }
          if (allowedOrigin === "*" || allowedOrigin === origin) {
            allowOrigin = allowedOrigin;
            break;
          }
          if (matchSubdomain(origin, allowedOrigin)) {
            allowOrigin = origin;
            break;
          }
        }

        if (!allowOrigin && shouldCheckPatterns(origin)) {
          for (const pattern of allowOriginPatterns) {
            if (pattern.test(origin)) {
              allowOrigin = origin;
              break;
            }
          }
        }
      }

      if (!allowOrigin) {
        if (!preflight) {
          return event.Next();
        }
        return event.NoContent(204);
      }

      event.responseHeaders.set("Access-Control-Allow-Origin", allowOrigin);
      if (resolved.AllowCredentials) {
        event.responseHeaders.set("Access-Control-Allow-Credentials", "true");
      }

      if (!preflight) {
        if (exposeHeaders) {
          event.responseHeaders.set("Access-Control-Expose-Headers", exposeHeaders);
        }
        return event.Next();
      }

      event.responseHeaders.append("Vary", "Access-Control-Request-Method");
      event.responseHeaders.append("Vary", "Access-Control-Request-Headers");
      event.responseHeaders.set("Access-Control-Allow-Methods", allowMethods);

      if (allowHeaders) {
        event.responseHeaders.set("Access-Control-Allow-Headers", allowHeaders);
      } else {
        const requested = event.request.headers.get("Access-Control-Request-Headers");
        if (requested) {
          event.responseHeaders.set("Access-Control-Allow-Headers", requested);
        }
      }

      if (resolved.MaxAge != null && resolved.MaxAge !== 0) {
        event.responseHeaders.set("Access-Control-Max-Age", maxAge);
      }

      return event.NoContent(204);
    },
  };
}

function buildOriginPattern(origin: string): RegExp | null {
  if (!origin) {
    return null;
  }

  const escaped = escapeRegExp(origin).replace(/\*/g, ".*").replace(/\?/g, ".");
  try {
    return new RegExp(`^${escaped}$`);
  } catch {
    console.warn("invalid AllowOrigins pattern", origin);
    return null;
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function shouldCheckPatterns(origin: string): boolean {
  if (!origin.includes("://")) {
    return false;
  }
  return origin.length <= 261;
}

function matchScheme(domain: string, pattern: string): boolean {
  const didx = domain.indexOf(":");
  const pidx = pattern.indexOf(":");
  if (didx === -1 || pidx === -1) {
    return false;
  }
  return domain.slice(0, didx) === pattern.slice(0, pidx);
}

function matchSubdomain(domain: string, pattern: string): boolean {
  if (!matchScheme(domain, pattern)) {
    return false;
  }

  const didx = domain.indexOf("://");
  const pidx = pattern.indexOf("://");
  if (didx === -1 || pidx === -1) {
    return false;
  }

  const domAuth = domain.slice(didx + 3);
  if (domAuth.length > 253) {
    return false;
  }
  const patAuth = pattern.slice(pidx + 3);

  const domComp = domAuth.split(".").reverse();
  const patComp = patAuth.split(".").reverse();

  for (let i = 0; i < domComp.length; i += 1) {
    if (patComp.length <= i) {
      return false;
    }
    const part = patComp[i];
    if (part === "*") {
      return true;
    }
    if (part !== domComp[i]) {
      return false;
    }
  }

  return false;
}
