// Ported from pocketbase/apis/record_auth.go

import type { App } from "../core/app.ts";
import type { RequestEvent } from "../core/event_request.ts";
import type { RouterGroup } from "../tools/router/group.ts";
import { recordAuthMethods } from "./record_auth_methods.ts";
import { recordAuthRefresh } from "./record_auth_refresh.ts";
import { recordAuthWithPassword } from "./record_auth_with_password.ts";

export function bindRecordAuthApi(app: App, rg: RouterGroup<RequestEvent>): void {
  const sub = rg.group("/collections/{collection}");

  sub.get("/auth-methods", (event) => recordAuthMethods(app, event));
  sub.post("/auth-refresh", (event) => recordAuthRefresh(app, event));
  sub.post("/auth-with-password", (event) => recordAuthWithPassword(app, event));
}
