// Ported from pocketbase/apis/base.go.
// Deviation: Bun doesn't expose net/http handlers, so WrapStd* adapts fetch-style handlers.
// Deviation: Bun uses filesystem paths instead of fs.FS; MustSubFS returns a root wrapper.
// Deviation: static file route checks use async fs APIs to avoid blocking the event loop under load.

import { stat } from "node:fs/promises";
import { join, posix as pathPosix } from "node:path";
import type { App } from "../core/app.ts";
import type { RequestEvent } from "../core/event_request.ts";
import { ErrFileNotFound, IndexPage } from "../tools/router/event.ts";
import { Router } from "../tools/router/router.ts";
import { bindBackupApi } from "./backup.ts";
import { bindBatchApi } from "./batch.ts";
import { bindCollectionApi } from "./collection.ts";
import { bindCronApi } from "./cron.ts";
import { bindFileApi } from "./file.ts";
import { bindHealthApi } from "./health.ts";
import { bindLogsApi } from "./logs.ts";
import {
  RequestEventKeySkipSuccessActivityLog,
  activityLogger,
  loadAuthToken,
  panicRecover,
  securityHeaders,
} from "./middlewares.ts";
import { BodyLimit, DefaultMaxBodySize } from "./middlewares_body_limit.ts";
import { rateLimit } from "./middlewares_rate_limit.ts";
import { bindRealtimeApi } from "./realtime.ts";
import { bindRecordAuthApi } from "./record_auth.ts";
import { bindRecordCrudApi } from "./record_crud.ts";
import { bindSettingsApi } from "./settings.ts";

// StaticWildcardParam is the name of Static handler wildcard parameter.
export const StaticWildcardParam = "path";

type FsRoot = { root: string };

export type StdResponseWriter = {
  headers: Headers;
  statusCode: number;
  write: (chunk: string | Uint8Array) => void;
  writeHead: (status: number, headers?: Record<string, string>) => void;
};

export type StdHandler = (req: Request, res?: StdResponseWriter) => Response | Promise<Response> | void | Promise<void>;
export type StdMiddleware = (handler: StdHandler) => StdHandler;

// NewRouter returns a new router instance loaded with the default app middlewares and api routes.
export function NewRouter(app: App): Router<RequestEvent> {
  const pbRouter = new Router<RequestEvent>();

  // register default middlewares
  pbRouter.Bind(activityLogger());
  pbRouter.Bind(panicRecover());
  pbRouter.Bind(rateLimit());
  pbRouter.Bind(loadAuthToken());
  pbRouter.Bind(securityHeaders());
  pbRouter.Bind(BodyLimit(DefaultMaxBodySize));

  const apiGroup = pbRouter.group("/api");
  bindSettingsApi(app, apiGroup);
  bindCollectionApi(app, apiGroup);
  bindRecordCrudApi(app, apiGroup);
  bindRecordAuthApi(app, apiGroup);
  bindLogsApi(app, apiGroup);
  bindBackupApi(app, apiGroup);
  bindCronApi(app, apiGroup);
  bindFileApi(app, apiGroup);
  bindBatchApi(app, apiGroup);
  bindRealtimeApi(app, apiGroup);
  bindHealthApi(app, apiGroup);

  return pbRouter;
}

// WrapStdHandler wraps a standard Fetch-style handler into a PocketBase handler func.
export function WrapStdHandler(handler: StdHandler): (event: RequestEvent) => Promise<Response> {
  return async (event: RequestEvent): Promise<Response> => {
    if (handler.length >= 2) {
      const writer = new BufferedResponseWriter(event.responseHeaders);
      await handler(event.request, writer);
      return writer.toResponse();
    }

    const result = await handler(event.request);
    if (result instanceof Response) {
      return mergeEventHeaders(result, event.responseHeaders);
    }

    return new Response(null, { status: 200, headers: event.responseHeaders });
  };
}

// WrapStdMiddleware wraps a standard Fetch-style middleware into a PocketBase middleware func.
export function WrapStdMiddleware(middleware: StdMiddleware): (event: RequestEvent) => Promise<unknown> {
  return async (event: RequestEvent): Promise<unknown> => {
    const baseHandler: StdHandler = async (req) => {
      const original = event.request;
      event.request = req;
      try {
        await event.Next();
      } finally {
        event.request = original;
      }
      return undefined;
    };

    const wrapped = middleware(baseHandler);
    if (wrapped.length >= 2) {
      const writer = new BufferedResponseWriter(event.responseHeaders);
      await wrapped(event.request, writer);
      return writer.toResponse();
    }

    const result = await wrapped(event.request);
    if (result instanceof Response) {
      return mergeEventHeaders(result, event.responseHeaders);
    }

    return result ?? new Response(null, { status: 200, headers: event.responseHeaders });
  };
}

// MustSubFS returns an fs-like root corresponding to the subtree rooted at fsys's dir.
//
// This is similar to fs.Sub but panics on failure.
export function MustSubFS(fsys: string | FsRoot, dir: string): FsRoot {
  const root = resolveFsRoot(fsys);
  const cleaned = cleanPath(dir);

  if (!root || !isValidSubPath(cleaned)) {
    throw new Error("failed to create sub FS: invalid path");
  }

  return { root: join(root, cleaned) };
}

// Static is a handler function to serve static directory content from fsys.
//
// If a file resource is missing and indexFallback is set, the request
// will be forwarded to the base index.html (useful for SPA with pretty urls).
//
// NB! Expects the route to have a "{path...}" wildcard parameter.
//
// Special redirects:
//   - if "path" is a file that ends in index.html, it is redirected to its non-index.html version (eg. /test/index.html -> /test/)
//   - if "path" is a directory that has index.html, the index.html file is rendered,
//     otherwise if missing - returns 404 or fallback to the root index.html if indexFallback is set
export function Static(fsys: string | FsRoot, indexFallback: boolean): (event: RequestEvent) => Promise<unknown> {
  if (!fsys) {
    throw new Error("Static: the provided fs.FS argument is nil");
  }

  return async (event: RequestEvent): Promise<unknown> => {
    // disable the activity logger to avoid flooding with messages
    //
    // note: errors are still logged
    if (event.Get(RequestEventKeySkipSuccessActivityLog) == null) {
      event.Set(RequestEventKeySkipSuccessActivityLog, true);
    }

    let filename = event.params[StaticWildcardParam] ?? "";
    if (filename.startsWith("/")) {
      filename = filename.slice(1);
    }
    filename = cleanPath(filename);

    // eagerly check for directory traversal
    //
    // note: this is just out of an abundance of caution because the fs.FS implementation could be non-std,
    // but usually shouldn't be necessary since os.DirFS.Open is expected to fail if the filename starts with dots
    if (isTraversalPath(filename)) {
      if (indexFallback && filename !== IndexPage) {
        return event.FileFS(fsys, IndexPage);
      }
      return ErrFileNotFound;
    }

    const root = resolveFsRoot(fsys);
    if (!root) {
      return ErrFileNotFound;
    }

    let stats: { isDirectory: () => boolean };

    try {
      stats = await stat(join(root, filename));
    } catch {
      if (indexFallback && filename !== IndexPage) {
        return event.FileFS(fsys, IndexPage);
      }
      return ErrFileNotFound;
    }

    if (stats.isDirectory()) {
      // redirect to a canonical dir url, aka. with trailing slash
      const urlPath = event.requestUrl().pathname;
      if (!urlPath.endsWith("/")) {
        return event.Redirect(301, safeRedirectPath(`${urlPath}/`));
      }
    } else {
      let urlPath = event.requestUrl().pathname;
      if (urlPath.endsWith("/")) {
        // redirect to a non-trailing slash file route
        urlPath = urlPath.replace(/\/+$/g, "");
        if (urlPath.length > 0) {
          return event.Redirect(301, safeRedirectPath(urlPath));
        }
      } else if (urlPath.endsWith(IndexPage)) {
        const stripped = urlPath.slice(0, -IndexPage.length);
        return event.Redirect(301, safeRedirectPath(stripped));
      }
    }

    const fileResult = await event.FileFS(fsys, filename);

    if (fileResult === ErrFileNotFound && indexFallback && filename !== IndexPage) {
      return event.FileFS(fsys, IndexPage);
    }

    return fileResult;
  };
}

// safeRedirectPath normalizes the path string by replacing all beginning slashes
// (`\\`, `//`, `\/`) with a single forward slash to prevent open redirect attacks
function safeRedirectPath(path: string): string {
  if (path.length > 1 && (path[0] === "\\" || path[0] === "/") && (path[1] === "\\" || path[1] === "/")) {
    path = "/" + path.replace(/^[\\/]+/, "");
  }
  return path;
}

function cleanPath(raw: string): string {
  let normalized = pathPosix.normalize(raw);
  if (normalized !== "/" && normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

function isTraversalPath(filename: string): boolean {
  if (!filename) {
    return false;
  }
  if (filename.startsWith("/")) {
    return true;
  }
  if (filename === "..") {
    return true;
  }
  if (filename.length > 2 && filename[0] === "." && filename[1] === "." && (filename[2] === "/" || filename[2] === "\\")) {
    return true;
  }
  return false;
}

function isValidSubPath(path: string): boolean {
  if (!path || path === "." || path.startsWith("/") || path === "..") {
    return false;
  }
  const parts = path.split("/");
  return parts.every((part) => part !== "" && part !== "." && part !== "..");
}

function resolveFsRoot(fsys: string | FsRoot): string {
  if (typeof fsys === "string") {
    return fsys;
  }
  return fsys?.root ?? "";
}

function mergeEventHeaders(response: Response, eventHeaders: Headers): Response {
  const merged = new Headers(response.headers);
  for (const [key, value] of eventHeaders.entries()) {
    if (!merged.has(key)) {
      merged.set(key, value);
    }
  }
  return new Response(response.body, {
    status: response.status,
    headers: merged,
  });
}

class BufferedResponseWriter implements StdResponseWriter {
  statusCode = 200;
  headers: Headers;
  #controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  #pendingChunks: Uint8Array[] = [];
  #closed = false;
  #stream: ReadableStream<Uint8Array>;
  static #textEncoder = new TextEncoder();

  constructor(headers: Headers) {
    this.headers = headers;
    this.#stream = new ReadableStream<Uint8Array>({
      start: (controller) => {
        this.#controller = controller;
        for (const chunk of this.#pendingChunks) {
          controller.enqueue(chunk);
        }
        this.#pendingChunks = [];
        if (this.#closed) {
          controller.close();
        }
      },
      cancel: () => {
        this.#controller = null;
        this.#pendingChunks = [];
      },
    });
  }

  writeHead(status: number, headers?: Record<string, string>): void {
    this.statusCode = status;
    if (headers) {
      for (const [key, value] of Object.entries(headers)) {
        this.headers.set(key, value);
      }
    }
  }

  write(chunk: string | Uint8Array): void {
    if (this.#closed) {
      return;
    }

    const chunkBytes = typeof chunk === "string" ? BufferedResponseWriter.#textEncoder.encode(chunk) : chunk;
    if (chunkBytes.length === 0) {
      return;
    }

    if (this.#controller) {
      this.#controller.enqueue(chunkBytes);
      return;
    }

    this.#pendingChunks.push(chunkBytes);
  }

  #closeStream(): void {
    if (this.#closed) {
      return;
    }

    this.#closed = true;
    if (this.#controller) {
      this.#controller.close();
    }
  }

  toResponse(): Response {
    this.#closeStream();
    return new Response(this.#stream, {
      status: this.statusCode,
      headers: this.headers,
    });
  }
}
