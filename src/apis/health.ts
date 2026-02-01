// Ported from pocketbase/apis/health.go

import type { App } from "../core/app.ts";
import type { RequestEvent } from "../core/event_request.ts";
import type { RouterGroup } from "../tools/router/group.ts";
import { StoreKeyActiveBackup } from "../core/store.ts";

export function bindHealthApi(app: App, rg: RouterGroup<RequestEvent>): void {
  const subGroup = rg.group("/health");
  subGroup.get("", (event) => healthCheck(app, event));
}

export function healthCheck(app: App, event: RequestEvent): Response {
  const response: {
    message: string;
    code: number;
    data: Record<string, unknown>;
  } = {
    code: 200,
    message: "API is healthy.",
    data: {},
  };

  if (event.hasSuperuserAuth()) {
    response.data = {
      canBackup: !app.store().has(StoreKeyActiveBackup),
      realIP: event.realIP(),
      possibleProxyHeader: findPossibleProxyHeader(app, event),
    };
  }

  return event.json(200, response);
}

function findPossibleProxyHeader(app: App, event: RequestEvent): string {
  const headersToCheck = [...app.settings().trustedProxy.headers, "CF-Connecting-IP", "Fly-Client-IP", "X-Forwarded-For"];

  for (const header of headersToCheck) {
    if (event.request.headers.get(header)) {
      return header;
    }
  }

  return "";
}
