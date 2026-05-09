// Ported from pocketbase/apis/middlewares.go

import type { App } from "../core/app.ts";
import type { RequestEvent } from "../core/event_request.ts";
import type { Handler } from "../tools/hook/hook.ts";
import { CollectionNameSuperusers } from "../core/collection_model.ts";
import { TokenTypeAuth } from "../core/record_tokens.ts";
import { isIPInList } from "../internal/compat/ip.ts";
import { ApiError, apiErrorResponse } from "../tools/router/api_error.ts";
import { badRequest, forbidden, unauthorized } from "./api_errors.ts";

// Common request event store keys used by the middlewares and api handlers.
export const RequestEventKeyLogMeta = "pbLogMeta";

const requestEventKeyExecStart = "__execStart";
export const RequestEventKeySkipSuccessActivityLog = "__skipSuccessActivityLogger";

export const DefaultWWWRedirectMiddlewarePriority = -99999;
export const DefaultWWWRedirectMiddlewareId = "pbWWWRedirect";

export const DefaultRateLimitMiddlewarePriority = -1000;
export const DefaultRateLimitMiddlewareId = "pbRateLimit";

export const DefaultActivityLoggerMiddlewarePriority = DefaultRateLimitMiddlewarePriority - 40;
export const DefaultActivityLoggerMiddlewareId = "pbActivityLogger";
export const DefaultSkipSuccessActivityLogMiddlewareId = "pbSkipSuccessActivityLog";
export const DefaultEnableAuthIdActivityLog = "pbEnableAuthIdActivityLog";

export const DefaultPanicRecoverMiddlewarePriority = DefaultRateLimitMiddlewarePriority - 30;
export const DefaultPanicRecoverMiddlewareId = "pbPanicRecover";

export const DefaultLoadAuthTokenMiddlewarePriority = DefaultRateLimitMiddlewarePriority - 20;
export const DefaultLoadAuthTokenMiddlewareId = "pbLoadAuthToken";

export const DefaultSuperuserIPsWhitelistMiddlewarePriority = DefaultLoadAuthTokenMiddlewarePriority + 5;
export const DefaultSuperuserIPsWhitelistMiddlewareId = "pbSuperuserIPsWhitelist";

export const DefaultSecurityHeadersMiddlewarePriority = DefaultRateLimitMiddlewarePriority - 10;
export const DefaultSecurityHeadersMiddlewareId = "pbSecurityHeaders";

export const DefaultRequireGuestOnlyMiddlewareId = "pbRequireGuestOnly";
export const DefaultRequireAuthMiddlewareId = "pbRequireAuth";
export const DefaultRequireSuperuserAuthMiddlewareId = "pbRequireSuperuserAuth";
export const DefaultRequireSuperuserOrOwnerAuthMiddlewareId = "pbRequireSuperuserOrOwnerAuth";
export const DefaultRequireSameCollectionContextAuthMiddlewareId = "pbRequireSameCollectionContextAuth";

// RequireGuestOnly middleware requires a request to NOT have a valid
// Authorization header.
//
// This middleware is the opposite of [apis.RequireAuth()].
export function RequireGuestOnly(): Handler<RequestEvent> {
  return {
    Id: DefaultRequireGuestOnlyMiddlewareId,
    Func: (event) => {
      if (event.auth) {
        return badRequest(event, "The request can be accessed only by guests.", null);
      }
      return event.Next();
    },
  };
}

// RequireAuth middleware requires a request to have a valid record Authorization header.
//
// The auth record could be from any collection.
// You can further filter the allowed record auth collections by specifying their names.
//
// Example:
//
//	apis.RequireAuth()                      // any auth collection
//	apis.RequireAuth("_superusers", "users") // only the listed auth collections
export function RequireAuth(...optCollectionNames: string[]): Handler<RequestEvent> {
  return {
    Id: DefaultRequireAuthMiddlewareId,
    Func: requireAuth(optCollectionNames),
  };
}

function requireAuth(optCollectionNames: string[]): (event: RequestEvent) => unknown {
  return (event: RequestEvent) => {
    if (!event.auth) {
      return unauthorized(event, "The request requires valid record authorization token.");
    }

    if (optCollectionNames.length > 0 && !optCollectionNames.includes(event.auth.collection().name)) {
      return forbidden(event, "The authorized record is not allowed to perform this action.");
    }

    return event.Next();
  };
}

// RequireSuperuserAuth middleware requires a request to have
// a valid superuser Authorization header.
export function RequireSuperuserAuth(): Handler<RequestEvent> {
  return {
    Id: DefaultRequireSuperuserAuthMiddlewareId,
    Func: requireAuth([CollectionNameSuperusers]),
  };
}

// RequireSuperuserOrOwnerAuth middleware requires a request to have
// a valid superuser or regular record owner Authorization header set.
//
// This middleware is similar to [apis.RequireAuth()] but
// for the auth record token expects to have the same id as the path
// parameter ownerIdPathParam (default to "id" if empty).
export function RequireSuperuserOrOwnerAuth(ownerIdPathParam: string): Handler<RequestEvent> {
  return {
    Id: DefaultRequireSuperuserOrOwnerAuthMiddlewareId,
    Func: (event) => {
      if (!event.auth) {
        return unauthorized(event, "The request requires superuser or record authorization token.");
      }

      if (event.auth.isSuperuser()) {
        return event.Next();
      }

      const ownerParam = ownerIdPathParam || "id";
      const ownerId = event.params[ownerParam] ?? "";

      if (event.auth.id !== ownerId) {
        return forbidden(event, "You are not allowed to perform this request.");
      }

      return event.Next();
    },
  };
}

// RequireSameCollectionContextAuth middleware requires a request to have
// a valid record Authorization header and the auth record's collection to
// match the one from the route path parameter (default to "collection" if collectionParam is empty).
export function RequireSameCollectionContextAuth(collectionPathParam: string): Handler<RequestEvent> {
  return {
    Id: DefaultRequireSameCollectionContextAuthMiddlewareId,
    Func: (event) => {
      if (!event.auth) {
        return unauthorized(event, "The request requires valid record authorization token.");
      }

      const collectionParam = collectionPathParam || "collection";
      const collectionId = event.params[collectionParam] ?? "";
      const authCollection = event.auth.collection();
      if (collectionId === authCollection.id || collectionId === authCollection.name) {
        return event.Next();
      }

      let collection: ReturnType<App["FindCachedCollectionByNameOrId"]> | null = null;
      try {
        collection = event.app.FindCachedCollectionByNameOrId(collectionId);
      } catch {
        collection = null;
      }

      if (!collection || authCollection.id !== collection.id) {
        return forbidden(event, `The request requires auth record from ${authCollection.name} collection.`);
      }

      return event.Next();
    },
  };
}

// loadAuthToken attempts to load the auth context based on the "Authorization: TOKEN" header value.
export function loadAuthToken(): Handler<RequestEvent> {
  return {
    Id: DefaultLoadAuthTokenMiddlewareId,
    Priority: DefaultLoadAuthTokenMiddlewarePriority,
    Func: (event) => {
      if (event.auth) {
        return event.Next();
      }

      const token = getAuthTokenFromRequest(event);
      if (!token) {
        return event.Next();
      }

      try {
        const record = event.app.FindAuthRecordByToken(token, TokenTypeAuth);
        if (record) {
          event.auth = record;
        }
      } catch (error) {
        // Note: keep invalid/expired tokens non-fatal for route compatibility.
        // Upstream logs this at debug level for troubleshooting.
        event.app.Logger().Debug("loadAuthToken failure", "error", error);
      }

      return event.Next();
    },
  };
}

// activityLogger middleware takes care to save the request information
// into the logs database.
//
// This middleware is registered by default for all routes.
//
// The middleware does nothing if the app logs retention period is zero
// (aka. app.Settings().Logs.MaxDays = 0).
//
// Users can attach the [apis.SkipSuccessActivityLog()] middleware if
// you want to log only the failed requests.
export function activityLogger(): Handler<RequestEvent> {
  return {
    Id: DefaultActivityLoggerMiddlewareId,
    Priority: DefaultActivityLoggerMiddlewarePriority,
    Func: async (event) => {
      const logsConfig = event.app.settings().logs;
      if (logsConfig.maxDays === 0) {
        return await event.Next();
      }

      event.Set(requestEventKeyExecStart, Date.now());

      let result: unknown = null;
      let thrown: Error | null = null;

      try {
        result = await event.Next();
      } catch (error) {
        thrown = error as Error;
      }

      const response = result instanceof Response ? result : null;
      const status = response?.status ?? (thrown ? 500 : 0);
      const hasError = Boolean(thrown) || status >= 400;

      if (hasError || event.Get(RequestEventKeySkipSuccessActivityLog) == null) {
        const level = hasError ? 8 : 0;
        if (level >= logsConfig.minLevel) {
          const errorInfo = hasError ? await readResponseError(response) : null;
          logRequest(event, response, thrown, errorInfo);
        }
      }

      if (thrown) {
        throw thrown;
      }

      return result;
    },
  };
}

// panicRecover returns a default panic-recover handler.
export function panicRecover(): Handler<RequestEvent> {
  return {
    Id: DefaultPanicRecoverMiddlewareId,
    Priority: DefaultPanicRecoverMiddlewarePriority,
    Func: async (event) => {
      try {
        return await event.Next();
      } catch (error) {
        if (error instanceof ApiError) {
          return apiErrorResponse(event, error);
        }
        event.app.Logger().Error("panic recover", "error", error);
        return event.json(500, {
          status: 500,
          message: "Something went wrong while processing your request.",
          data: {},
        });
      }
    },
  };
}

// securityHeaders middleware adds common security headers to the response.
//
// This middleware is registered by default for all routes.
export function securityHeaders(): Handler<RequestEvent> {
  return {
    Id: DefaultSecurityHeadersMiddlewareId,
    Priority: DefaultSecurityHeadersMiddlewarePriority,
    Func: (event) => {
      event.responseHeaders.set("X-XSS-Protection", "1; mode=block");
      event.responseHeaders.set("X-Content-Type-Options", "nosniff");
      event.responseHeaders.set("X-Frame-Options", "SAMEORIGIN");
      return event.Next();
    },
  };
}

// superuserIPsWhitelist middleware checks the current authenticated superuser IP
// against the configured SuperuserIPs whitelist setting.
//
// This middleware is registered by default for all routes.
export function superuserIPsWhitelist(): Handler<RequestEvent> {
  return {
    Id: DefaultSuperuserIPsWhitelistMiddlewareId,
    Priority: DefaultSuperuserIPsWhitelistMiddlewarePriority,
    Func: (event) => {
      if (event.hasSuperuserAuth()) {
        const ips = event.app.settings().superuserIPs;
        if (ips.length > 0 && !isIPInList(ips, event.realIP())) {
          return forbidden(event, "");
        }
      }

      return event.Next();
    },
  };
}

// SkipSuccessActivityLog is a helper middleware that instructs the global
// activity logger to log only requests that have failed/returned an error.
export function SkipSuccessActivityLog(): Handler<RequestEvent> {
  return {
    Id: DefaultSkipSuccessActivityLogMiddlewareId,
    Func: (event) => {
      event.Set(RequestEventKeySkipSuccessActivityLog, true);
      return event.Next();
    },
  };
}

function getAuthTokenFromRequest(event: RequestEvent): string {
  const token = event.request.headers.get("Authorization") ?? "";

  // the "Bearer" schema prefix is not required by PocketBase and it is
  // supported only for compatibility with the defaults of some HTTP clients
  if (token.length > 7 && token.slice(0, 7).toLowerCase() === "bearer ") {
    return token.slice(7);
  }

  return token;
}

async function readResponseError(response: Response | null): Promise<{ message: string; details?: unknown } | null> {
  if (!response || response.status < 400) {
    return null;
  }

  try {
    const cloned = response.clone();
    const body = (await cloned.json()) as Record<string, unknown>;
    if (body && typeof body === "object") {
      const message = typeof body.message === "string" ? body.message : response.statusText || "Request failed.";
      const details = body.data;
      return details ? { message, details } : { message };
    }
  } catch {
    // ignore response parse failures
  }

  const message = response.statusText || `HTTP ${response.status}`;
  return { message };
}

function logRequest(
  event: RequestEvent,
  response: Response | null,
  err: Error | null,
  responseError: { message: string; details?: unknown } | null,
): void {
  const logsConfig = event.app.settings().logs;

  if (logsConfig.maxDays === 0) {
    return;
  }

  const status = response?.status ?? (err ? 500 : 0);
  const hasError = Boolean(err) || status >= 400;

  if (!hasError && event.Get(RequestEventKeySkipSuccessActivityLog) != null) {
    return;
  }

  const attrs: unknown[] = ["type", "request"];

  const started = event.Get(requestEventKeyExecStart);
  if (typeof started === "number") {
    attrs.push("execTime", Date.now() - started);
  }

  if (event.Get(RequestEventKeyLogMeta) != null) {
    attrs.push("meta", event.Get(RequestEventKeyLogMeta));
  }

  const url = event.requestUrl();
  const requestUri = `${url.pathname}${url.search}`;
  const method = event.request.method;

  attrs.push(
    "url",
    cutStr(requestUri, 3000),
    "method",
    cutStr(method, 50),
    "status",
    status,
    "referer",
    cutStr(event.request.headers.get("referer") ?? "", 2000),
    "userAgent",
    cutStr(event.request.headers.get("user-agent") ?? "", 2000),
  );

  if (event.auth) {
    attrs.push("auth", event.auth.collection().name);
    if (logsConfig.logAuthId) {
      attrs.push("authId", event.auth.id);
    }
  } else {
    attrs.push("auth", "");
  }

  if (logsConfig.logIP) {
    attrs.push("userIP", event.realIP(), "remoteIP", event.remoteIP());
  }

  if (hasError) {
    if (responseError) {
      attrs.push("error", responseError.message);
      if (responseError.details != null) {
        attrs.push("details", responseError.details);
      }
    } else if (err) {
      attrs.push("error", err.message);
    } else {
      attrs.push("error", `HTTP ${status}`);
    }
  }

  const level = hasError ? 8 : 0;
  if (level < logsConfig.minLevel) {
    return;
  }

  queueMicrotask(() => {
    let message = `${method} `;
    try {
      message += decodeURIComponent(requestUri);
    } catch {
      message += requestUri;
    }

    if (hasError) {
      event.app.Logger().Error(message, ...attrs);
    } else {
      event.app.Logger().Info(message, ...attrs);
    }
  });
}

function cutStr(value: string, max: number): string {
  if (value.length > max) {
    return `${value.slice(0, max)}...`;
  }
  return value;
}
