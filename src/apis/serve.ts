// Ported from pocketbase/apis/serve.go @ v0.36.1 (9b036fb1)

import { resolve, sep } from "node:path";
import type { App } from "../core/app.ts";
import { RequestEvent } from "../core/event_request.ts";
import { Router } from "../tools/router/router.ts";
import { loadAuthFromRequest } from "./auth.ts";
import { bindHealthApi } from "./health.ts";

export type ServeConfig = {
  httpAddr?: string;
  showStartBanner?: boolean;
};

export function buildServeHandler(app: App): (req: Request, server?: unknown) => Promise<Response> {
  const router = new Router<RequestEvent>();
  bindHealthApi(app, router.group("/api"));
  bindAdminUI(router);

  return router.buildHandler(({ request, params, remoteAddress }) => {
    const event = new RequestEvent({ app, request, params, remoteAddress });
    loadAuthFromRequest(app, event);
    return event;
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
