// Ported from pocketbase/apis/logs.go

import type { App } from "../core/app.ts";
import type { RouterGroup } from "../tools/router/group.ts";
import { RequestEvent } from "../core/event_request.ts";
import { normalizeLogRow } from "../core/log_model.ts";
import { buildFilterExpr } from "../tools/search/filter.ts";
import { Provider } from "../tools/search/provider.ts";
import { SimpleFieldResolver } from "../tools/search/simple_field_resolver.ts";
import { FilterQueryParam, DefaultFilterExprLimit } from "../tools/search/types.ts";
import { badRequest, notFound } from "./api_errors.ts";
import { RequireSuperuserAuth, SkipSuccessActivityLog } from "./middlewares.ts";

// bindLogsApi registers the request logs api endpoints.
export function bindLogsApi(app: App, rg: RouterGroup<RequestEvent>): void {
  const sub = rg.group("/logs").bind(RequireSuperuserAuth(), SkipSuccessActivityLog());
  sub.get("", (event) => logsList(app, event));
  sub.get("/stats", (event) => logsStats(app, event));
  sub.get("/{id}", (event) => logsView(app, event));
}

const logFilterFields = ["id", "created", "level", "message", "data", "^data\\.[\\w\\.\\:]*\\w+$"];

function logsList(app: App, event: RequestEvent): Response {
  const resolver = new SimpleFieldResolver(...logFilterFields);
  const provider = new Provider(resolver).query({ select: "select * from {{_logs}}" });

  try {
    const url = event.requestUrl();
    const result = provider.parseAndExecParams(url.searchParams, app.auxDb(), url.search);
    result.items = result.items.map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return item;
      }
      return normalizeLogRow(item as Record<string, unknown>);
    });

    return event.json(200, result);
  } catch (error) {
    return badRequest(event, "", error as Error);
  }
}

function logsStats(app: App, event: RequestEvent): Response {
  const resolver = new SimpleFieldResolver(...logFilterFields);
  const filter = event.requestUrl().searchParams.get(FilterQueryParam) ?? "";

  let expr = null;
  if (filter) {
    try {
      expr = buildFilterExpr(filter, resolver, DefaultFilterExprLimit);
    } catch (error) {
      return badRequest(event, "Invalid filter format.", error as Error);
    }
  }

  try {
    const stats = app.LogsStats(expr);
    return event.json(200, stats);
  } catch (error) {
    return badRequest(event, "Failed to generate logs stats.", error as Error);
  }
}

function logsView(app: App, event: RequestEvent): Response {
  const id = event.params.id ?? "";
  if (!id) {
    return notFound(event, "");
  }

  try {
    const log = app.FindLogById(id);
    return event.json(200, log);
  } catch (_error) {
    return notFound(event, "");
  }
}
