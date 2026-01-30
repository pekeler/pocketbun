// Ported from pocketbase/apis/middlewares.go @ v0.36.1 (9b036fb1)

import type { App } from "../core/app.ts";
import type { RequestEvent } from "../core/event_request.ts";
import { TokenTypeAuth } from "../core/record_tokens.ts";

export function loadAuthFromRequest(app: App, event: RequestEvent): void {
  if (event.auth) {
    return;
  }

  const token = getAuthTokenFromRequest(event);
  if (!token) {
    return;
  }

  try {
    const record = app.findAuthRecordByToken(token, [TokenTypeAuth]);
    if (record) {
      event.auth = record;
    }
  } catch {
    // ignore invalid or expired token by default
  }
}

function getAuthTokenFromRequest(event: RequestEvent): string {
  let token = event.request.headers.get("Authorization") ?? "";
  if (token.startsWith("Bearer ")) {
    token = token.slice("Bearer ".length);
  }
  return token;
}
