// Ported from pocketbase/apis/serve.go

import { resolve } from "node:path";
import type { App } from "../core/app.ts";
import { RequestEvent } from "../core/event_request.ts";
import { ServeEvent } from "../core/events.ts";
import { Router } from "../tools/router/router.ts";
import { NewRouter, Static, StaticWildcardParam } from "./base.ts";
import { CORS } from "./middlewares_cors.ts";
import { Gzip } from "./middlewares_gzip.ts";

// ServeConfig defines a configuration struct for apis.Serve().
export type ServeConfig = {
  httpAddr?: string;
  httpsAddr?: string;
  showStartBanner?: boolean;
  allowedOrigins?: string[];
  certificateDomains?: string[];
};

export function buildServeHandler(app: App, config: ServeConfig = {}): (req: Request, server?: unknown) => Promise<Response> {
  const router = NewRouter(app);
  router.Bind(
    CORS({
      AllowOrigins: config.allowedOrigins ?? [],
    }),
  );
  bindAdminUI(router);

  const serveEvent = new ServeEvent(app, router);
  let initialized = false;
  const triggerResult = app.OnServe().Trigger(serveEvent, () => {
    initialized = true;
    return null;
  });
  if (triggerResult instanceof Promise) {
    throw new Error("Async OnServe hooks are not supported in buildServeHandler.");
  }
  if (!initialized) {
    throw new Error("The OnServe listener was not initialized. Did you forget to call the ServeEvent.Next() method?");
  }

  return router.buildHandler(({ request, requestUrl, params, remoteAddress, pattern }) => {
    return new RequestEvent({ app, request, requestUrl, params, remoteAddress, pattern });
  });
}

export function serve(app: App, config: ServeConfig = {}): ReturnType<typeof Bun.serve> {
  if (!app.isBootstrapped()) {
    app.bootstrap();
  }

  app.runAllMigrations();

  const addr = config.httpAddr ?? "127.0.0.1:8090";
  const { hostname, port } = parseAddr(addr);
  const handler = buildServeHandler(app, config);

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
  const adminFs = { root: adminRoot };

  router
    .get("/_/{path...}", Static(adminFs, false))
    .BindFunc((event) => {
      const wildcard = event.params[StaticWildcardParam] ?? "";
      if (wildcard !== "") {
        event.responseHeaders.set("Cache-Control", "max-age=1209600, stale-while-revalidate=86400");
      }

      if (!event.responseHeaders.get("Content-Security-Policy")) {
        event.responseHeaders.set(
          "Content-Security-Policy",
          "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' http://127.0.0.1:* https://tile.openstreetmap.org data: blob:; connect-src 'self' http://127.0.0.1:* https://nominatim.openstreetmap.org; script-src 'self' 'sha256-GRUzBA7PzKYug7pqxv5rJaec5bwDCw1Vo6/IXwvD3Tc='",
        );
      }

      return event.Next();
    })
    .Bind(Gzip());
}
