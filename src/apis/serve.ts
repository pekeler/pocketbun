// Ported from pocketbase/apis/serve.go

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { bootstrapIfNeededAsync, type App } from "../core/app.ts";
import { RequestEvent } from "../core/event_request.ts";
import { ServeEvent } from "../core/events.ts";
import { Router } from "../tools/router/router.ts";
import { FireAndForget } from "../tools/routine/routine.ts";
import { NewRouter, Static, StaticWildcardParam } from "./base.ts";
import { bindUIExtensions } from "./extensions.ts";
import { DefaultInstallerFunc, loadInstallerAsync } from "./installer.ts";
import { RequestEventKeySkipSuccessActivityLog } from "./middlewares.ts";
import { CORS } from "./middlewares_cors.ts";
import { Gzip } from "./middlewares_gzip.ts";

// ServeConfig defines a configuration struct for apis.Serve().
export type ServeConfig = {
  httpAddr?: string;
  httpsAddr?: string;
  showStartBanner?: boolean;
  allowedOrigins?: string[];
  certificateDomains?: string[];
  maxRequestBodySize?: number;
};

type BuiltServeHandler = {
  handler: (req: Request, server?: unknown) => Promise<Response>;
  serveEvent: ServeEvent;
};

const serveModuleDir = dirname(fileURLToPath(import.meta.url));
const adminDistPath = resolveServeAssetPath(serveModuleDir, [
  "../../vendor/pocketbase-admin-ui/dist",
  "../vendor/pocketbase-admin-ui/dist",
]);
// PocketBun-only: brand the vendored Admin UI at runtime without modifying upstream assets.
const adminBrandingScriptFileName = "pocketbun-branding.js";
const adminBrandingScriptRoute = `/_/${adminBrandingScriptFileName}`;
const adminBrandingScriptPath = resolveServeAssetPath(serveModuleDir, [
  "../../src/ui/admin_branding.js",
  "../src/ui/admin_branding.js",
]);
const defaultCSP =
  "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' http://127.0.0.1:* https://tile.openstreetmap.org data: blob:; connect-src 'self' http://127.0.0.1:* https://nominatim.openstreetmap.org; script-src 'self' http://127.0.0.1:*; frame-src 'none'";
// Bun currently limits `idleTimeout` to <= 255 seconds.
const defaultServerIdleTimeoutSeconds = 255;
// PocketBun deviation: raise Bun's request cap so app/body-limit middleware and
// field validators decide upload size limits instead of Bun's 128 MiB default.
const defaultMaxRequestBodySizeBytes = 1024 * 1024 * 1024 * 4;

let brandedAdminIndexHtmlPromise: Promise<string> | null = null;
let adminBrandingScriptPromise: Promise<string | null> | null = null;

// PocketBun-only: resolve bundled assets in both source and npm package layouts.
export function resolveServeAssetPath(baseDir: string, relativeCandidates: string[]): string {
  for (const relativePath of relativeCandidates) {
    const candidate = resolve(baseDir, relativePath);
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return resolve(baseDir, relativeCandidates[0] ?? ".");
}

async function ensureReady(app: App): Promise<void> {
  await bootstrapIfNeededAsync(app);
  app.runAllMigrations();
}

export function buildServeHandler(app: App, config: ServeConfig = {}): (req: Request, server?: unknown) => Promise<Response> {
  return buildServeHandlerWithEventSync(app, config).handler;
}

function buildServeHandlerWithEventSync(app: App, config: ServeConfig = {}): BuiltServeHandler {
  return buildServeHandlerWithEvent(app, config, false);
}

async function buildServeHandlerWithEventAsync(app: App, config: ServeConfig = {}): Promise<BuiltServeHandler> {
  return buildServeHandlerWithEvent(app, config, true);
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
      bindUIExtensions(serveEvent);
      return {
        serveEvent,
        handler: router.buildHandler(
          ({ request, requestUrl, params, remoteAddress, remoteAddressResolver, pattern }) => {
            return new RequestEvent({ app, request, requestUrl, params, remoteAddress, remoteAddressResolver, pattern });
          },
          { lazyRemoteAddress: true, lazyRequestUrl: true },
        ),
      };
    });
  }
  if (!initialized) {
    throw new Error("The OnServe listener was not initialized. Did you forget to call the ServeEvent.Next() method?");
  }

  bindUIExtensions(serveEvent);

  return {
    serveEvent,
    handler: router.buildHandler(
      ({ request, requestUrl, params, remoteAddress, remoteAddressResolver, pattern }) => {
        return new RequestEvent({ app, request, requestUrl, params, remoteAddress, remoteAddressResolver, pattern });
      },
      { lazyRemoteAddress: true, lazyRequestUrl: true },
    ),
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
    // PocketBun deviation: Bun's default idleTimeout can close quiet SSE streams too early.
    // Keep it aligned with realtime connect idle behavior (5 minutes).
    idleTimeout: defaultServerIdleTimeoutSeconds,
    maxRequestBodySize: config.maxRequestBodySize ?? defaultMaxRequestBodySizeBytes,
    fetch: handler,
  });

  serveEvent.Server = server;
  bindGracefulShutdown(app, server);
  startInstallerAsync(app, config, server, serveEvent);
  printStartBanner(server, config);
  return server;
}

async function startServerAsync(app: App, config: ServeConfig): Promise<ReturnType<typeof Bun.serve>> {
  const addr = config.httpAddr ?? "127.0.0.1:8090";
  const { hostname, port } = parseAddr(addr);
  const { handler, serveEvent } = await buildServeHandlerWithEventAsync(app, config);
  const server = Bun.serve({
    hostname,
    port,
    // PocketBun deviation: Bun's default idleTimeout can close quiet SSE streams too early.
    // Keep it aligned with realtime connect idle behavior (5 minutes).
    idleTimeout: defaultServerIdleTimeoutSeconds,
    maxRequestBodySize: config.maxRequestBodySize ?? defaultMaxRequestBodySizeBytes,
    fetch: handler,
  });
  serveEvent.Server = server;
  bindGracefulShutdown(app, server);
  startInstallerAsync(app, config, server, serveEvent);
  printStartBanner(server, config);
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

function bindGracefulShutdown(app: App, server: ReturnType<typeof Bun.serve>): void {
  let stopPromise: Promise<void> | null = null;

  app.OnTerminate().Bind({
    // mirror PocketBase's graceful shutdown hook id so future upstream syncs remain predictable
    Id: "pbGracefulShutdown",
    Priority: -9999,
    Func: async (event) => {
      if (!stopPromise) {
        stopPromise = Promise.resolve(server.stop()).catch(() => {
          // ignore shutdown errors
        });
      }
      await stopPromise;
      return event.Next();
    },
  });
}

function printStartBanner(server: ReturnType<typeof Bun.serve>, config: ServeConfig): void {
  if (!config.showStartBanner) {
    return;
  }

  const baseURL = buildBaseURL(server, config);
  const timestamp = formatStartBannerTimestamp(new Date());

  // eslint-disable-next-line no-console
  console.log(`${timestamp} Server started at ${baseURL}`);
  // eslint-disable-next-line no-console
  console.log(`├─ REST API:  ${baseURL}/api/`);
  // eslint-disable-next-line no-console
  console.log(`└─ Dashboard: ${baseURL}/_/`);
}

function formatStartBannerTimestamp(date: Date): string {
  const year = date.getFullYear().toString().padStart(4, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const seconds = date.getSeconds().toString().padStart(2, "0");

  return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
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
  const adminFs = { root: adminDistPath };

  router
    .get("/_/{path...}", Static(adminFs, false))
    .BindFunc(async (event) => {
      if (event.Get(RequestEventKeySkipSuccessActivityLog) == null) {
        event.Set(RequestEventKeySkipSuccessActivityLog, true);
      }

      const wildcard = event.params[StaticWildcardParam] ?? "";

      setAdminContentSecurityPolicy(event);

      if (wildcard === adminBrandingScriptFileName) {
        const brandingScript = await getAdminBrandingScript();
        if (brandingScript == null) {
          event.app.Logger().Warn("Failed to load admin branding script", "path", adminBrandingScriptPath);
          return event.Next();
        }
        event.responseHeaders.set("Content-Type", "application/javascript; charset=utf-8");
        event.responseHeaders.set("Cache-Control", "max-age=300, stale-while-revalidate=86400");
        return new Response(brandingScript, { status: 200, headers: event.responseHeaders });
      }

      if (wildcard === "" && event.requestUrl().pathname.endsWith("/")) {
        try {
          const brandedIndexHtml = await getBrandedAdminIndexHtml(adminDistPath);
          event.responseHeaders.set("Content-Type", "text/html; charset=utf-8");
          return new Response(brandedIndexHtml, { status: 200, headers: event.responseHeaders });
        } catch (error) {
          event.app.Logger().Warn("Failed to inject admin branding script", "error", error);
          return event.Next();
        }
      }

      if (wildcard !== "") {
        event.responseHeaders.set("Cache-Control", "max-age=1209600, stale-while-revalidate=86400");
      }

      return event.Next();
    })
    .Bind(Gzip());
}

function setAdminContentSecurityPolicy(event: RequestEvent): void {
  if (!event.responseHeaders.get("Content-Security-Policy")) {
    event.responseHeaders.set("Content-Security-Policy", defaultCSP);
  }
}

async function getAdminBrandingScript(): Promise<string | null> {
  if (adminBrandingScriptPromise) {
    return adminBrandingScriptPromise;
  }

  adminBrandingScriptPromise = readFile(adminBrandingScriptPath, "utf8").catch(() => {
    adminBrandingScriptPromise = null;
    return null;
  });

  return adminBrandingScriptPromise;
}

async function getBrandedAdminIndexHtml(adminRoot: string): Promise<string> {
  if (brandedAdminIndexHtmlPromise) {
    return brandedAdminIndexHtmlPromise;
  }

  const indexPath = join(adminRoot, "index.html");
  brandedAdminIndexHtmlPromise = readFile(indexPath, "utf8")
    .then((html) => injectAdminBrandingScriptTag(html))
    .catch((error) => {
      brandedAdminIndexHtmlPromise = null;
      throw error;
    });

  return brandedAdminIndexHtmlPromise;
}

function injectAdminBrandingScriptTag(html: string): string {
  if (html.includes(adminBrandingScriptRoute)) {
    return html;
  }

  const scriptTag = `<script src="${adminBrandingScriptRoute}" defer></script>`;
  const headCloseIndex = html.lastIndexOf("</head>");
  if (headCloseIndex >= 0) {
    return `${html.slice(0, headCloseIndex)}${scriptTag}${html.slice(headCloseIndex)}`;
  }

  const bodyCloseIndex = html.lastIndexOf("</body>");
  if (bodyCloseIndex >= 0) {
    return `${html.slice(0, bodyCloseIndex)}${scriptTag}${html.slice(bodyCloseIndex)}`;
  }

  return `${html}${scriptTag}`;
}
