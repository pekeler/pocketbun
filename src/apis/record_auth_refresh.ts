// Ported from pocketbase/apis/record_auth_refresh.go

import type { App } from "../core/app.ts";
import type { RequestEvent } from "../core/event_request.ts";
import { RecordAuthRefreshRequestEvent } from "../core/events.ts";
import { TokenClaimRefreshable } from "../core/record_tokens.ts";
import { parseUnverifiedJWT } from "../tools/security/jwt.ts";
import { RecordAuthResponseWithToken } from "./record_helpers.ts";

export async function recordAuthRefresh(app: App, event: RequestEvent): Promise<Response> {
  const record = event.auth;
  if (!record) {
    return unauthorized(event, "The request requires valid record authorization token.");
  }

  const collectionId = event.params.collection ?? "";
  const collection = collectionId ? app.findCollectionByNameOrId(collectionId) : null;
  if (!collection || record.collection().id !== collection.id) {
    return forbidden(event, `The request requires auth record from ${record.collection().name} collection.`);
  }

  const hookEvent = new RecordAuthRefreshRequestEvent(event, record.collection(), record);

  const out = await app.OnRecordAuthRefreshRequest().Trigger(hookEvent, async () => {
    const currentToken = getAuthTokenFromRequest(event);
    let tokenToReturn = currentToken;

    if (currentToken) {
      try {
        const claims = parseUnverifiedJWT(currentToken);
        if (claims && Boolean((claims as Record<string, unknown>)[TokenClaimRefreshable])) {
          try {
            tokenToReturn = record.NewAuthToken();
          } catch (error) {
            return internalServerError(event, "Failed to refresh auth token.", error);
          }
        }
      } catch (_error) {
        // ignore parse errors and return the current token
      }
    }

    return RecordAuthResponseWithToken(event, record, tokenToReturn, "", null);
  });

  if (out instanceof Response) {
    return out;
  }

  return RecordAuthResponseWithToken(event, record, getAuthTokenFromRequest(event), "", null);
}

function unauthorized(event: RequestEvent, message: string): Response {
  return event.json(401, {
    status: 401,
    message,
    data: {},
  });
}

function forbidden(event: RequestEvent, message: string): Response {
  return event.json(403, {
    status: 403,
    message,
    data: {},
  });
}

function internalServerError(event: RequestEvent, message: string, err: unknown): Response {
  const data = err instanceof Error ? { message: err.message } : {};
  return event.json(500, {
    status: 500,
    message,
    data,
  });
}

function getAuthTokenFromRequest(event: RequestEvent): string {
  let token = event.request.headers.get("Authorization") ?? "";
  if (token.startsWith("Bearer ")) {
    token = token.slice("Bearer ".length);
  }
  return token;
}
