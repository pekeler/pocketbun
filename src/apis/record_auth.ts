// Ported from pocketbase/apis/record_auth.go

import type { App } from "../core/app.ts";
import type { RequestEvent } from "../core/event_request.ts";
import type { RouterGroup } from "../tools/router/group.ts";
import { RequireSameCollectionContextAuth, RequireSuperuserAuth, SkipSuccessActivityLog } from "./middlewares.ts";
import { collectionPathRateLimit } from "./middlewares_rate_limit.ts";
import { recordConfirmEmailChange } from "./record_auth_email_change_confirm.ts";
import { recordRequestEmailChange } from "./record_auth_email_change_request.ts";
import { recordAuthImpersonate } from "./record_auth_impersonate.ts";
import { recordAuthMethods } from "./record_auth_methods.ts";
import { recordRequestOTP } from "./record_auth_otp_request.ts";
import { recordConfirmPasswordReset } from "./record_auth_password_reset_confirm.ts";
import { recordRequestPasswordReset } from "./record_auth_password_reset_request.ts";
import { recordAuthRefresh } from "./record_auth_refresh.ts";
import { recordConfirmVerification } from "./record_auth_verification_confirm.ts";
import { recordRequestVerification } from "./record_auth_verification_request.ts";
import { recordAuthWithOAuth2 } from "./record_auth_with_oauth2.ts";
import { oauth2SubscriptionRedirect } from "./record_auth_with_oauth2_redirect.ts";
import { recordAuthWithOTP } from "./record_auth_with_otp.ts";
import { recordAuthWithPassword } from "./record_auth_with_password.ts";

// bindRecordAuthApi registers the auth record api endpoints and
// the corresponding handlers.
export function bindRecordAuthApi(app: App, rg: RouterGroup<RequestEvent>): void {
  rg.get("/oauth2-redirect", (event) => oauth2SubscriptionRedirect(app, event)).Bind(SkipSuccessActivityLog());
  rg.post("/oauth2-redirect", (event) => oauth2SubscriptionRedirect(app, event)).Bind(SkipSuccessActivityLog());

  const sub = rg.group("/collections/{collection}");

  sub.get("/auth-methods", (event) => recordAuthMethods(app, event)).Bind(collectionPathRateLimit("", "listAuthMethods"));
  sub
    .post("/auth-refresh", (event) => recordAuthRefresh(app, event))
    .Bind(collectionPathRateLimit("", "authRefresh"), RequireSameCollectionContextAuth(""));
  sub
    .post("/auth-with-password", (event) => recordAuthWithPassword(app, event))
    .Bind(collectionPathRateLimit("", "authWithPassword", "auth"));
  sub
    .post("/auth-with-oauth2", (event) => recordAuthWithOAuth2(app, event))
    .Bind(collectionPathRateLimit("", "authWithOAuth2", "auth"));
  sub.post("/impersonate/{id}", (event) => recordAuthImpersonate(app, event)).Bind(RequireSuperuserAuth());
  sub.post("/request-otp", (event) => recordRequestOTP(app, event)).Bind(collectionPathRateLimit("", "requestOTP"));
  sub.post("/auth-with-otp", (event) => recordAuthWithOTP(app, event)).Bind(collectionPathRateLimit("", "authWithOTP", "auth"));
  sub
    .post("/request-password-reset", (event) => recordRequestPasswordReset(app, event))
    .Bind(collectionPathRateLimit("", "requestPasswordReset"));
  sub
    .post("/confirm-password-reset", (event) => recordConfirmPasswordReset(app, event))
    .Bind(collectionPathRateLimit("", "confirmPasswordReset"));
  sub
    .post("/request-verification", (event) => recordRequestVerification(app, event))
    .Bind(collectionPathRateLimit("", "requestVerification"));
  sub
    .post("/confirm-verification", (event) => recordConfirmVerification(app, event))
    .Bind(collectionPathRateLimit("", "confirmVerification"));
  sub
    .post("/request-email-change", (event) => recordRequestEmailChange(app, event))
    .Bind(collectionPathRateLimit("", "requestEmailChange"), RequireSameCollectionContextAuth(""));
  sub
    .post("/confirm-email-change", (event) => recordConfirmEmailChange(app, event))
    .Bind(collectionPathRateLimit("", "confirmEmailChange"));
}
