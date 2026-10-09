// Ported from pocketbase/apis/middlewares_cors.go

import type { RequestEvent } from "../core/event_request.ts";
import type { BoundHandler } from "../tools/hook/hook.ts";
import { DefaultActivityLoggerMiddlewarePriority } from "./middlewares.ts";

export const DefaultCorsMiddlewareId = "pbCors";
// Before the activity logger and rate limit so that OPTIONS preflight requests are not counted.
export const DefaultCorsMiddlewarePriority = DefaultActivityLoggerMiddlewarePriority - 1;

// CORSConfig defines the config for CORS middleware.
export type CORSConfig = {
  // AllowOrigins determines the value of the Access-Control-Allow-Origin
  // response header. This header defines a list of origins that may access the
  // resource.
  //
  // The wildcard characters '*' and '?' are supported as subdomain segments
  // and are converted to regex fragments '.*' and '.' accordingly.
  //
  // Security: use extreme caution when handling the origin, and carefully
  // validate any logic. Remember that attackers may register hostile domain names.
  // See https://blog.portswigger.net/2016/10/exploiting-cors-misconfigurations-for.html
  //
  // Optional. Default value []string{"*"}.
  //
  // See also: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Allow-Origin
  AllowOrigins?: string[];
  // AllowOriginFunc is a custom function to validate the origin. It takes the
  // origin as an argument and returns true if allowed or false otherwise. If
  // an error is returned, it is returned by the handler. If this option is
  // set, AllowOrigins is ignored.
  //
  // Security: use extreme caution when handling the origin, and carefully
  // validate any logic. Remember that attackers may register hostile domain names.
  // See https://blog.portswigger.net/2016/10/exploiting-cors-misconfigurations-for.html
  //
  // Optional.
  AllowOriginFunc?: ((origin: string) => boolean | Promise<boolean>) | null;
  // AllowMethods determines the value of the Access-Control-Allow-Methods
  // response header.  This header specified the list of methods allowed when
  // accessing the resource.  This is used in response to a preflight request.
  //
  // Optional. Default value DefaultCORSConfig.AllowMethods.
  //
  // See also: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Allow-Methods
  AllowMethods?: string[];
  // AllowHeaders determines the value of the Access-Control-Allow-Headers
  // response header.  This header is used in response to a preflight request to
  // indicate which HTTP headers can be used when making the actual request.
  //
  // Optional. Default value []string{}.
  //
  // See also: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Allow-Headers
  AllowHeaders?: string[];
  // AllowCredentials determines the value of the
  // Access-Control-Allow-Credentials response header.  This header indicates
  // whether or not the response to the request can be exposed when the
  // credentials mode (Request.credentials) is true. When used as part of a
  // response to a preflight request, this indicates whether or not the actual
  // request can be made using credentials.  See also
  // [MDN: Access-Control-Allow-Credentials].
  //
  // Optional. Default value false, in which case the header is not set.
  //
  // Security: avoid using `AllowCredentials = true` with `AllowOrigins = *`.
  // See "Exploiting CORS misconfigurations for Bitcoins and bounties",
  // https://blog.portswigger.net/2016/10/exploiting-cors-misconfigurations-for.html
  //
  // See also: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Allow-Credentials
  AllowCredentials?: boolean;
  // UnsafeWildcardOriginWithAllowCredentials UNSAFE/INSECURE: allows wildcard '*' origin to be used with AllowCredentials
  // flag. In that case we consider any origin allowed and send it back to the client with `Access-Control-Allow-Origin` header.
  //
  // This is INSECURE and potentially leads to [cross-origin](https://portswigger.net/research/exploiting-cors-misconfigurations-for-bitcoins-and-bounties)
  // attacks. See: https://github.com/labstack/echo/issues/2400 for discussion on the subject.
  //
  // Optional. Default value is false.
  UnsafeWildcardOriginWithAllowCredentials?: boolean;
  // ExposeHeaders determines the value of Access-Control-Expose-Headers, which
  // defines a list of headers that clients are allowed to access.
  //
  // Optional. Default value []string{}, in which case the header is not set.
  //
  // See also: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Expose-Header
  ExposeHeaders?: string[];
  // MaxAge determines the value of the Access-Control-Max-Age response header.
  // This header indicates how long (in seconds) the results of a preflight
  // request can be cached.
  // The header is set only if MaxAge != 0, negative value sends "0" which instructs browsers not to cache that response.
  //
  // Optional. Default value 0 - meaning header is not sent.
  //
  // See also: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Max-Age
  MaxAge?: number;
};

// DefaultCORSConfig is the default CORS middleware config.
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

// CORS returns a CORS middleware.
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
          if (exactWildcardMatch(origin, allowedOrigin)) {
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

  const escaped = escapeRegExp(origin).replace(/\\\*/g, ".*").replace(/\\\?/g, ".");
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

// exactWildcardMatch compares domain with a * wildcard pattern.
export function exactWildcardMatch(domain: string, pattern: string): boolean {
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

  if (patComp.length !== domComp.length) {
    return false;
  }

  for (let i = 0; i < domComp.length; i += 1) {
    const part = patComp[i];
    if (part === "*") {
      continue;
    }
    if (part !== domComp[i]) {
      return false;
    }
  }

  return true;
}
