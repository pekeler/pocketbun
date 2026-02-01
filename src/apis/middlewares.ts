// Ported from pocketbase/apis/middlewares.go

import type { RequestEvent } from "../core/event_request.ts";
import type { Handler } from "../tools/hook/hook.ts";
import { CollectionNameSuperusers } from "../core/collection.ts";
import { TokenTypeAuth } from "../core/record_tokens.ts";
import { badRequest, forbidden, unauthorized } from "./api_errors.ts";

// Common request event store keys used by the middlewares and api handlers.
export const RequestEventKeyLogMeta = "pbLogMeta";

const requestEventKeySkipSuccessActivityLog = "__skipSuccessActivityLogger";

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

export const DefaultSecurityHeadersMiddlewarePriority = DefaultRateLimitMiddlewarePriority - 10;
export const DefaultSecurityHeadersMiddlewareId = "pbSecurityHeaders";

export const DefaultRequireGuestOnlyMiddlewareId = "pbRequireGuestOnly";
export const DefaultRequireAuthMiddlewareId = "pbRequireAuth";
export const DefaultRequireSuperuserAuthMiddlewareId = "pbRequireSuperuserAuth";
export const DefaultRequireSuperuserOrOwnerAuthMiddlewareId = "pbRequireSuperuserOrOwnerAuth";
export const DefaultRequireSameCollectionContextAuthMiddlewareId = "pbRequireSameCollectionContextAuth";

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

export function RequireSuperuserAuth(): Handler<RequestEvent> {
  return {
    Id: DefaultRequireSuperuserAuthMiddlewareId,
    Func: requireAuth([CollectionNameSuperusers]),
  };
}

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

export function RequireSameCollectionContextAuth(collectionPathParam: string): Handler<RequestEvent> {
  return {
    Id: DefaultRequireSameCollectionContextAuthMiddlewareId,
    Func: (event) => {
      if (!event.auth) {
        return unauthorized(event, "The request requires valid record authorization token.");
      }

      const collectionParam = collectionPathParam || "collection";
      const collectionId = event.params[collectionParam] ?? "";
      const collection = event.app.FindCachedCollectionByNameOrId(collectionId);

      if (!collection || event.auth.collection().id !== collection.id) {
        return forbidden(event, `The request requires auth record from ${event.auth.collection().name} collection.`);
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
      } catch {
        // ignore invalid or expired token by default
      }

      return event.Next();
    },
  };
}

export function panicRecover(): Handler<RequestEvent> {
  return {
    Id: DefaultPanicRecoverMiddlewareId,
    Priority: DefaultPanicRecoverMiddlewarePriority,
    Func: async (event) => {
      try {
        return await event.Next();
      } catch (error) {
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

export function SkipSuccessActivityLog(): Handler<RequestEvent> {
  return {
    Id: DefaultSkipSuccessActivityLogMiddlewareId,
    Func: (event) => {
      event.Set(requestEventKeySkipSuccessActivityLog, true);
      return event.Next();
    },
  };
}

function getAuthTokenFromRequest(event: RequestEvent): string {
  let token = event.request.headers.get("Authorization") ?? "";
  if (token.startsWith("Bearer ")) {
    token = token.slice("Bearer ".length);
  }
  return token;
}
