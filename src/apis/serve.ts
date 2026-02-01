// Ported from pocketbase/apis/serve.go

import { resolve, sep } from "node:path";
import type { App } from "../core/app.ts";
import { RequestEvent } from "../core/event_request.ts";
import { Router } from "../tools/router/router.ts";
import { bindBatchApi } from "./batch.ts";
import { bindCollectionApi } from "./collection.ts";
import { bindFileApi } from "./file.ts";
import { bindHealthApi } from "./health.ts";
import { bindLogsApi } from "./logs.ts";
import { activityLogger, loadAuthToken, panicRecover, securityHeaders } from "./middlewares.ts";
import { BodyLimit, DefaultMaxBodySize } from "./middlewares_body_limit.ts";
import { rateLimit } from "./middlewares_rate_limit.ts";
import { bindRecordAuthApi } from "./record_auth.ts";
import { bindRecordCrudApi } from "./record_crud.ts";
import { bindSettingsApi } from "./settings.ts";

export type ServeConfig = {
  httpAddr?: string;
  showStartBanner?: boolean;
};

export function buildServeHandler(app: App): (req: Request, server?: unknown) => Promise<Response> {
  const router = new Router<RequestEvent>();
  router.Bind(activityLogger());
  router.Bind(panicRecover());
  router.Bind(rateLimit());
  router.Bind(BodyLimit(DefaultMaxBodySize));
  router.Bind(loadAuthToken());
  router.Bind(securityHeaders());
  const apiGroup = router.group("/api");
  bindBatchApi(app, apiGroup);
  bindCollectionApi(app, apiGroup);
  bindFileApi(app, apiGroup);
  bindHealthApi(app, apiGroup);
  bindLogsApi(app, apiGroup);
  bindSettingsApi(app, apiGroup);
  bindRecordAuthApi(app, apiGroup);
  bindRecordCrudApi(app, apiGroup);
  bindAdminUI(router);

  return router.buildHandler(({ request, params, remoteAddress, pattern }) => {
    return new RequestEvent({ app, request, params, remoteAddress, pattern });
  });
}

export function serve(app: App, config: ServeConfig = {}): ReturnType<typeof Bun.serve> {
  if (!app.isBootstrapped()) {
    app.bootstrap();
  }

  app.runAllMigrations();

  const addr = config.httpAddr ?? "127.0.0.1:8090";
  const { hostname, port } = parseAddr(addr);
  const handler = buildServeHandler(app);

  return Bun.serve({
    hostname,
    port,
    fetch: handler,
  });
}

function parseAddr(addr: string): { hostname: string; port: number } {
  const trimmed = addr.trim();
  if (trimmed === "") {
    return { hostname: "127.0.0.1", port: 8090 };
  }

  const hasPort = trimmed.includes(":");
  if (!hasPort) {
    return { hostname: trimmed, port: 8090 };
  }

  const [host, portStr] = trimmed.split(":");
  const port = Number.parseInt(portStr ?? "", 10);
  return { hostname: host || "127.0.0.1", port: Number.isFinite(port) ? port : 8090 };
}

function bindAdminUI(router: Router<RequestEvent>): void {
  const adminRoot = resolve("vendor/pocketbase-admin-ui/dist");

  router.get("/_/{path...}", async (event) => {
    const wildcard = event.params.path ?? "";
    const relativePath = wildcard === "" ? "index.html" : wildcard;
    const filePath = resolve(adminRoot, relativePath);

    if (!isPathInside(filePath, adminRoot)) {
      return new Response("Not Found", { status: 404 });
    }

    const file = Bun.file(filePath);
    if (!(await file.exists())) {
      return new Response("Not Found", { status: 404 });
    }

    return new Response(file);
  });
}

function isPathInside(filePath: string, rootPath: string): boolean {
  if (filePath === rootPath) {
    return true;
  }
  return filePath.startsWith(rootPath + sep);
}
