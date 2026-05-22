// Ported from pocketbase/apis/record_auth_with_oauth2_redirect.go

import type { App } from "../core/app.ts";
import type { RequestEvent } from "../core/event_request.ts";
import { readRequestTextAndRebind } from "../internal/compat/request_body.ts";
import { Message } from "../tools/subscriptions/message.ts";
import { RealtimeClientIPKey } from "./realtime.ts";

const oauth2SubscriptionTopic = "@oauth2";
const oauth2RedirectFailurePath = "../_/#/auth/oauth2-redirect-failure";
const oauth2RedirectSuccessPath = "../_/#/auth/oauth2-redirect-success";
const oauth2RedirectAppleNameStoreKeyPrefix = "@redirect_name_";

type OAuth2RedirectData = {
  State: string;
  Code: string;
  Error: string;
  AppleUser: string;
};

export async function oauth2SubscriptionRedirect(app: App, event: RequestEvent): Promise<Response> {
  const redirectStatusCode = event.request.method === "GET" ? 307 : 303;
  const data = await readRedirectData(event);

  if (!data.State) {
    app.Logger().Warn("Missing OAuth2 state parameter");
    return redirectResponse(redirectStatusCode, oauth2RedirectFailurePath);
  }

  let client = null;
  try {
    client = app.SubscriptionsBroker().ClientById(data.State);
  } catch (error) {
    app.Logger().Warn("Missing or invalid OAuth2 subscription client", "error", error, "clientId", data.State);
    return redirectResponse(redirectStatusCode, oauth2RedirectFailurePath);
  }

  if (!client || client.IsDiscarded() || !client.HasSubscription(oauth2SubscriptionTopic)) {
    app.Logger().Warn("Missing or invalid OAuth2 subscription client", "clientId", data.State);
    return redirectResponse(redirectStatusCode, oauth2RedirectFailurePath);
  }

  client.Unsubscribe(oauth2SubscriptionTopic);

  // additional check to minimize the risk of XSRF attack vectors
  //
  // note: custom registered clients (aka. those without IP in the store)
  // are excluded from the check for backward compatibility
  const clientIP = client.Get(RealtimeClientIPKey);
  if (typeof clientIP === "string" && clientIP !== "" && clientIP !== event.realIP()) {
    app
      .Logger()
      .Debug(
        "The client IP that completed the authentication is different from the one that initialized the OAuth2 realtime connection",
      );
    return redirectResponse(redirectStatusCode, oauth2RedirectFailurePath);
  }

  if (data.AppleUser && !data.Error && data.Code) {
    const nameErr = parseAndStoreAppleRedirectName(app, oauth2RedirectAppleNameStoreKeyPrefix + data.Code, data.AppleUser);
    if (nameErr) {
      app.Logger().Warn("Failed to parse and load Apple Redirect name data", "error", nameErr);
    }
  }

  let encoded: string;
  try {
    encoded = JSON.stringify({ state: data.State, code: data.Code, error: data.Error || undefined });
  } catch (error) {
    app.Logger().Warn("Failed to marshalize OAuth2 redirect data", "error", error);
    return redirectResponse(redirectStatusCode, oauth2RedirectFailurePath);
  }

  const msg = new Message(oauth2SubscriptionTopic, encoded);
  client.Send(msg);

  if (data.Error || !data.Code) {
    app
      .Logger()
      .Warn("Failed OAuth2 redirect due to an error or missing code parameter", "error", data.Error, "clientId", data.State);
    return redirectResponse(redirectStatusCode, oauth2RedirectFailurePath);
  }

  return redirectResponse(redirectStatusCode, oauth2RedirectSuccessPath);
}

async function readRedirectData(event: RequestEvent): Promise<OAuth2RedirectData> {
  const data: OAuth2RedirectData = { State: "", Code: "", Error: "", AppleUser: "" };

  if (event.request.method === "POST") {
    const contentType = event.request.headers.get("content-type") ?? "";
    try {
      if (contentType.includes("application/json")) {
        const bound = await readRequestTextAndRebind(event.request);
        event.request = bound.request;
        const parsed = JSON.parse(bound.text) as unknown;
        if (parsed && typeof parsed === "object") {
          const raw = parsed as Record<string, unknown>;
          data.State = typeof raw.state === "string" ? raw.state : "";
          data.Code = typeof raw.code === "string" ? raw.code : "";
          data.Error = typeof raw.error === "string" ? raw.error : "";
          // Match upstream `json:"-"` behavior for AppleUser: ignore JSON "user".
          data.AppleUser = "";
        }
        return data;
      }

      const bound = await readRequestTextAndRebind(event.request);
      event.request = bound.request;
      const body = bound.text;
      const params = new URLSearchParams(body);
      data.State = params.get("state") ?? "";
      data.Code = params.get("code") ?? "";
      data.Error = params.get("error") ?? "";
      data.AppleUser = params.get("user") ?? "";
      return data;
    } catch (error) {
      event.app.Logger().Warn("Failed to read OAuth2 redirect data", "error", error);
      return data;
    }
  }

  const url = event.requestUrl();
  data.State = url.searchParams.get("state") ?? "";
  data.Code = url.searchParams.get("code") ?? "";
  data.Error = url.searchParams.get("error") ?? "";

  return data;
}

function redirectResponse(status: number, location: string): Response {
  return new Response(null, {
    status,
    headers: {
      Location: location,
    },
  });
}

// parseAndStoreAppleRedirectName extracts the first and last name
// from serializedNameData and temporary store them in the app.Store.
//
// This is hacky workaround to forward safely and seamlessly the Apple
// redirect user's name back to the OAuth2 auth handler.
//
// Note that currently Apple is the only provider that behaves like this and
// for now it is unnecessary to check whether the redirect is coming from Apple or not.
//
// Ideally this shouldn't be needed and will be removed in the future
// once Apple adds a dedicated userinfo endpoint.
function parseAndStoreAppleRedirectName(app: App, nameKey: string, serializedNameData: string): Error | null {
  if (!serializedNameData) {
    return null;
  }

  if (nameKey.length > 1000) {
    return new Error("nameKey is too large");
  }

  let extracted: { name?: { firstName?: string; lastName?: string } } = {};
  try {
    extracted = JSON.parse(serializedNameData) as { name?: { firstName?: string; lastName?: string } };
  } catch (error) {
    return error as Error;
  }

  const first = extracted.name?.firstName ?? "";
  const last = extracted.name?.lastName ?? "";
  let fullName = `${first} ${last}`.trim();

  if (fullName.length > 150) {
    fullName = fullName.slice(0, 150);
  }

  if (!fullName) {
    return null;
  }

  app.store().set(nameKey, fullName);
  setTimeout(() => {
    app.store().remove(nameKey);
  }, 60 * 1000);

  return null;
}
