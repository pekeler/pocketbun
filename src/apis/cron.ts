// Ported from pocketbase/apis/cron.go

import type { App } from "../core/app.ts";
import type { RequestEvent } from "../core/event_request.ts";
import type { RouterGroup } from "../tools/router/group.ts";
import { FireAndForget } from "../tools/routine/routine.ts";
import { noContent } from "./api_errors.ts";
import { RequireSuperuserAuth } from "./middlewares.ts";

// bindCronApi registers the crons api endpoint.
export function bindCronApi(app: App, rg: RouterGroup<RequestEvent>): void {
  const subGroup = rg.group("/crons").bind(RequireSuperuserAuth());
  subGroup.get("", (event) => cronsList(app, event));
  subGroup.post("/{id}", (event) => cronRun(app, event));
}

function cronsList(app: App, event: RequestEvent): Response {
  const jobs = app.Cron().Jobs();
  const sorted = jobs.slice().sort((a, b) => {
    if (a.Id().startsWith("__pb")) {
      return 1;
    }
    if (b.Id().startsWith("__pb")) {
      return -1;
    }
    return a.Id().localeCompare(b.Id());
  });

  return event.json(200, sorted);
}

function cronRun(app: App, event: RequestEvent): Response | Error {
  const cronId = event.params.id ?? "";

  let found = null;
  for (const job of app.Cron().Jobs()) {
    if (job.Id() === cronId) {
      found = job;
      break;
    }
  }

  if (!found) {
    return event.NotFoundError("Missing or invalid cron job", null);
  }

  FireAndForget(() => {
    found?.Run();
  });

  return noContent(event, 204);
}
