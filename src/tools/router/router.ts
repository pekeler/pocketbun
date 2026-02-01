// Ported from pocketbase/tools/router/router.go

import type { Resolver } from "../hook/event.ts";
import type { Handler } from "./route.ts";
import { Hook } from "../hook/hook.ts";
import { RouterGroup } from "./group.ts";

type Segment = { type: "static"; value: string } | { type: "param"; name: string } | { type: "wildcard"; name: string };

type RouterEvent = Resolver & {
  json: (status: number, body: unknown) => Response;
};

export type EventFactory<E extends RouterEvent> = (options: {
  request: Request;
  params: Record<string, string>;
  remoteAddress: string | null;
  pattern: string;
}) => E;

type ResolvedRoute<E extends RouterEvent> = {
  method: string;
  pathPattern: string;
  pattern: string;
  segments: Segment[];
  hook: Hook<E>;
  action: Handler<E>;
};

export class Router<E extends RouterEvent> extends RouterGroup<E> {
  buildHandler(factory: EventFactory<E>): (req: Request, server?: unknown) => Promise<Response> {
    if (!this.HasRoute("", "/")) {
      this.Any("/{path...}", (event) =>
        event.json(404, { status: 404, message: "The requested resource wasn't found.", data: {} }),
      );
    }

    const routes = this.resolveRoutes();

    return async (req: Request, server?: unknown): Promise<Response> => {
      const url = new URL(req.url);
      const method = req.method.toUpperCase();
      // Fallback to localhost when no server is available (ex. buildServeHandler tests).
      const remoteAddress = getRemoteAddress(req, server) ?? "127.0.0.1";

      let bestMatch: { route: ResolvedRoute<E>; params: Record<string, string>; score: number } | null = null;

      for (const route of routes) {
        const methodScore = matchMethodScore(method, route.method);
        if (methodScore < 0) {
          continue;
        }

        const match = matchPath(route.segments, url.pathname);
        if (!match) {
          continue;
        }

        const score = computeScore(methodScore, route.segments);
        if (!bestMatch || score > bestMatch.score) {
          bestMatch = { route, params: match, score };
        }
      }

      if (!bestMatch) {
        return new Response("Not Found", { status: 404 });
      }

      const { route, params } = bestMatch;
      const event = factory({
        request: req,
        params,
        remoteAddress,
        pattern: route.pattern,
      });

      try {
        const result = await route.hook.Trigger(event, route.action);
        const response = result instanceof Response ? result : new Response(null, { status: 204 });

        if (method === "HEAD") {
          return new Response(null, {
            status: response.status,
            headers: response.headers,
          });
        }

        return response;
      } catch {
        return new Response(null, { status: 500 });
      }
    };
  }

  private resolveRoutes(): Array<ResolvedRoute<E>> {
    const resolved: Array<ResolvedRoute<E>> = [];
    this.collectRoutes(this, [], resolved);
    return resolved;
  }

  private collectRoutes(group: RouterGroup<E>, parents: Array<RouterGroup<E>>, out: Array<ResolvedRoute<E>>): void {
    for (const child of group.children) {
      if (child instanceof RouterGroup) {
        this.collectRoutes(child, [...parents, group], out);
        continue;
      }

      const hook = new Hook<E>();
      let pathPattern = "";

      for (const parent of parents) {
        pathPattern += parent.Prefix;
        for (const handler of parent.Middlewares) {
          if (handler.Id && parent.excludedMiddlewares?.has(handler.Id)) {
            continue;
          }
          if (handler.Id && group.excludedMiddlewares?.has(handler.Id)) {
            continue;
          }
          if (handler.Id && child.excludedMiddlewares?.has(handler.Id)) {
            continue;
          }
          hook.Bind(handler);
        }
      }

      pathPattern += group.Prefix;
      for (const handler of group.Middlewares) {
        if (handler.Id && group.excludedMiddlewares?.has(handler.Id)) {
          continue;
        }
        if (handler.Id && child.excludedMiddlewares?.has(handler.Id)) {
          continue;
        }
        hook.Bind(handler);
      }

      pathPattern += child.Path;
      for (const handler of child.Middlewares) {
        if (handler.Id && child.excludedMiddlewares?.has(handler.Id)) {
          continue;
        }
        hook.Bind(handler);
      }

      const pattern = child.Method ? `${child.Method} ${pathPattern}` : pathPattern;
      const segments = parsePattern(pathPattern);

      out.push({
        method: child.Method,
        pathPattern,
        pattern,
        segments,
        hook,
        action: child.Action,
      });
    }
  }
}

function parsePattern(pattern: string): Segment[] {
  const trimmed = pattern.replace(/^\/+|\/+$/g, "");
  if (trimmed === "") {
    return [];
  }

  return trimmed.split("/").map((part) => {
    if (part.startsWith("{") && part.endsWith("}")) {
      const inner = part.slice(1, -1);
      if (inner.endsWith("...")) {
        return { type: "wildcard", name: inner.slice(0, -3) };
      }
      return { type: "param", name: inner };
    }

    return { type: "static", value: part };
  });
}

function splitPath(pathname: string): string[] {
  const trimmed = pathname.replace(/^\/+|\/+$/g, "");
  if (trimmed === "") {
    return [];
  }
  return trimmed.split("/");
}

function matchPath(segments: Segment[], pathname: string): Record<string, string> | null {
  const params: Record<string, string> = {};
  const parts = splitPath(pathname);

  for (let i = 0, j = 0; i < segments.length; i += 1, j += 1) {
    const segment = segments[i];
    const part = parts[j];
    if (!segment) {
      return null;
    }

    if (segment.type === "wildcard") {
      const remaining = parts.slice(j).join("/");
      params[segment.name] = remaining;
      return params;
    }

    if (part === undefined) {
      return null;
    }

    if (segment.type === "static") {
      if (segment.value !== part) {
        return null;
      }
      continue;
    }

    params[segment.name] = part;
  }

  if (parts.length !== segments.length) {
    return null;
  }

  return params;
}

function matchMethodScore(method: string, routeMethod: string): number {
  const normalizedRoute = routeMethod.toUpperCase();
  if (normalizedRoute === method) {
    return 3;
  }
  if (method === "HEAD" && normalizedRoute === "GET") {
    return 2;
  }
  if (normalizedRoute === "") {
    return 1;
  }
  return -1;
}

function computeScore(methodScore: number, segments: Segment[]): number {
  let staticSegments = 0;
  let hasWildcard = false;

  for (const segment of segments) {
    if (segment.type === "static") {
      staticSegments += 1;
    } else if (segment.type === "wildcard") {
      hasWildcard = true;
    }
  }

  return methodScore * 1_000_000 + staticSegments * 1_000 + segments.length * 10 + (hasWildcard ? 0 : 1);
}

function getRemoteAddress(req: Request, server?: unknown): string | null {
  const bunServer = server as { requestIP?: (req: Request) => { address: string } | null } | undefined;
  if (bunServer?.requestIP) {
    return bunServer.requestIP(req)?.address ?? null;
  }
  return null;
}
