// Ported from pocketbase/apis/serve.go

import { resolve } from "node:path";
import type { App } from "../core/app.ts";
import { RequestEvent } from "../core/event_request.ts";
import { ServeEvent } from "../core/events.ts";
import { Router } from "../tools/router/router.ts";
import { FireAndForget } from "../tools/routine/routine.ts";
import { NewRouter, Static, StaticWildcardParam } from "./base.ts";
import { DefaultInstallerFunc, loadInstallerAsync } from "./installer.ts";
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

type AppWithAsyncBootstrap = App & { bootstrapAsync: () => Promise<void> };
type BuiltServeHandler = {
  handler: (req: Request, server?: unknown) => Promise<Response>;
  serveEvent: ServeEvent;
};

function hasAsyncBootstrap(app: App): app is AppWithAsyncBootstrap {
  return typeof (app as { bootstrapAsync?: unknown }).bootstrapAsync === "function";
}

async function ensureReady(app: App): Promise<void> {
  if (!app.isBootstrapped()) {
    if (hasAsyncBootstrap(app)) {
      await app.bootstrapAsync();
    } else {
      app.bootstrap();
    }
  }

  app.runAllMigrations();
}

export function buildServeHandler(app: App, config: ServeConfig = {}): (req: Request, server?: unknown) => Promise<Response> {
  return buildServeHandlerWithEventSync(app, config).handler;
}

function buildServeHandlerWithEventSync(app: App, config: ServeConfig = {}): BuiltServeHandler {
  return buildServeHandlerWithEvent(app, config, false);
}

async function buildServeHandlerWithEventAsync(app: App, config: ServeConfig = {}): Promise<BuiltServeHandler> {
  return await buildServeHandlerWithEvent(app, config, true);
}

// PocketBun async deviation: keep the upstream-compatible sync behavior in
// buildServeHandler()/serve(), while allowing async OnServe hooks in serveAsync().
function buildServeHandlerWithEvent(app: App, config: ServeConfig, allowAsyncServeHooks: false): BuiltServeHandler;
function buildServeHandlerWithEvent(app: App, config: ServeConfig, allowAsyncServeHooks: true): Promise<BuiltServeHandler>;
function buildServeHandlerWithEvent(
  app: App,
  config: ServeConfig = {},
  allowAsyncServeHooks: boolean,
): BuiltServeHandler | Promise<BuiltServeHandler> {
  const router = NewRouter(app);
  router.Bind(
    CORS({
      AllowOrigins: config.allowedOrigins ?? [],
    }),
  );
  bindAdminUI(router);

  const serveEvent = new ServeEvent(app, router);
  serveEvent.InstallerFunc = DefaultInstallerFunc;
  let initialized = false;
  const triggerResult = app.OnServe().Trigger(serveEvent, () => {
    initialized = true;
    return null;
  });
  if (triggerResult instanceof Promise) {
    if (!allowAsyncServeHooks) {
      throw new Error("Async OnServe hooks are not supported in buildServeHandler.");
    }
    return triggerResult.then((err) => {
      if (err) {
        throw err;
      }
      if (!initialized) {
        throw new Error("The OnServe listener was not initialized. Did you forget to call the ServeEvent.Next() method?");
      }
      return {
        serveEvent,
        handler: router.buildHandler(({ request, requestUrl, params, remoteAddress, pattern }) => {
          return new RequestEvent({ app, request, requestUrl, params, remoteAddress, pattern });
        }),
      };
    });
  }
  if (!initialized) {
    throw new Error("The OnServe listener was not initialized. Did you forget to call the ServeEvent.Next() method?");
  }

  return {
    serveEvent,
    handler: router.buildHandler(({ request, requestUrl, params, remoteAddress, pattern }) => {
      return new RequestEvent({ app, request, requestUrl, params, remoteAddress, pattern });
    }),
  };
}

export function serve(app: App, config: ServeConfig = {}): ReturnType<typeof Bun.serve> {
  if (!app.isBootstrapped()) {
    app.bootstrap();
  }

  app.runAllMigrations();

  return startServerSync(app, config);
}

// serveAsync is a PocketBun-only async alternative to serve().
export async function serveAsync(app: App, config: ServeConfig = {}): Promise<ReturnType<typeof Bun.serve>> {
  await ensureReady(app);
  return startServerAsync(app, config);
}

function startServerSync(app: App, config: ServeConfig): ReturnType<typeof Bun.serve> {
  const addr = config.httpAddr ?? "127.0.0.1:8090";
  const { hostname, port } = parseAddr(addr);
  const { handler, serveEvent } = buildServeHandlerWithEventSync(app, config);

  const server = Bun.serve({
    hostname,
    port,
    fetch: handler,
  });

  serveEvent.Server = server;
  startInstallerAsync(app, config, server, serveEvent);
  return server;
}

async function startServerAsync(app: App, config: ServeConfig): Promise<ReturnType<typeof Bun.serve>> {
  const addr = config.httpAddr ?? "127.0.0.1:8090";
  const { hostname, port } = parseAddr(addr);
  const { handler, serveEvent } = await buildServeHandlerWithEventAsync(app, config);
  const server = Bun.serve({
    hostname,
    port,
    fetch: handler,
  });
  serveEvent.Server = server;
  startInstallerAsync(app, config, server, serveEvent);
  return server;
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

function buildBaseURL(server: ReturnType<typeof Bun.serve>, config: ServeConfig): string {
  const scheme = config.httpsAddr ? "https" : "http";
  return `${scheme}://${server.hostname}:${server.port}`;
}

function startInstallerAsync(
  app: App,
  config: ServeConfig,
  server: ReturnType<typeof Bun.serve>,
  serveEvent: ServeEvent,
): void {
  if (!serveEvent.InstallerFunc) {
    return;
  }
  const baseURL = buildBaseURL(server, config);
  const installerFunc = serveEvent.InstallerFunc;
  FireAndForget(async () => {
    const installerErr = await loadInstallerAsync(app, baseURL, installerFunc);
    if (installerErr) {
      app.Logger().Warn("Failed to initialize installer", "error", installerErr);
    }
  });
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
