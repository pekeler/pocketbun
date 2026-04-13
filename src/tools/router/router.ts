// Ported from pocketbase/tools/router/router.go

import type { Resolver } from "../hook/event.ts";
import type { Handler } from "./route.ts";
import { Hook } from "../hook/hook.ts";
import { ApiError, NewNotFoundError, ToApiError, apiErrorResponse } from "./api_error.ts";
import { RouterGroup } from "./group.ts";

type Segment = { type: "static"; value: string } | { type: "param"; name: string } | { type: "wildcard"; name: string };

type RouterEvent = Resolver & {
  json: (status: number, body: unknown) => Response;
};

type EventFactoryResult<E extends RouterEvent> = E | { event: E; cleanup?: () => void | Promise<void> };

export type EventFactory<E extends RouterEvent> = (options: {
  request: Request;
  requestUrl: URL;
  params: Record<string, string>;
  remoteAddress: string | null;
  pattern: string;
}) => EventFactoryResult<E>;

type ResolvedRoute<E extends RouterEvent> = {
  method: string;
  pathPattern: string;
  pattern: string;
  segments: Segment[];
  hasDynamicSegments: boolean;
  scoreBase: number;
  hook: Hook<E>;
  action: Handler<E>;
};

type RouteIndex<E extends RouterEvent> = {
  any: Map<string, Array<ResolvedRoute<E>>>;
  byMethod: Map<string, Map<string, Array<ResolvedRoute<E>>>>;
};

type RouteMatch<E extends RouterEvent> = {
  route: ResolvedRoute<E>;
  params: Record<string, string> | null;
  score: number;
};

// Router defines a thin wrapper around the standard Go [http.ServeMux] by
// adding support for routing sub-groups, middlewares and other common utils.
//
// Example:
//
//	r := NewRouter[*MyEvent](eventFactory)
//
//	// middlewares
//	r.BindFunc(m1, m2)
//
//	// routes
//	r.GET("/test", handler1)
//
//	// sub-routers/groups
//	api := r.Group("/api")
//	api.GET("/admins", handler2)
//
//	// generate a http.ServeMux instance based on the router configurations
//	mux, _ := r.BuildMux()
//
//	http.ListenAndServe("localhost:8090", mux)
export class Router<E extends RouterEvent> extends RouterGroup<E> {
  buildHandler(factory: EventFactory<E>): (req: Request, server?: unknown) => Promise<Response> {
    if (!this.HasRoute("", "/")) {
      this.Any("/{path...}", () => NewNotFoundError("", null));
    }

    const routes = this.resolveRoutes();
    const routeIndex = buildRouteIndex(routes);

    return async (req: Request, server?: unknown): Promise<Response> => {
      const url = new URL(req.url);
      const method = req.method;
      // Fallback to localhost when no server is available (ex. buildServeHandler tests).
      const remoteAddress = getRemoteAddress(req, server) ?? "127.0.0.1:0";
      const parts = splitPath(url.pathname);
      const firstSegment = parts[0] ?? "";

      // PocketBun perf deviation (behavior-compatible): avoid per-request candidate list allocations
      // and only allocate params maps for dynamic route matches.
      let bestMatch: RouteMatch<E> | null = null;

      const methodMap = routeIndex.byMethod.get(method);
      bestMatch = considerCandidates(bestMatch, methodMap?.get(firstSegment), method, parts);
      bestMatch = considerCandidates(bestMatch, methodMap?.get("*"), method, parts);

      if (method === "HEAD") {
        const getMap = routeIndex.byMethod.get("GET");
        bestMatch = considerCandidates(bestMatch, getMap?.get(firstSegment), method, parts);
        bestMatch = considerCandidates(bestMatch, getMap?.get("*"), method, parts);
      }

      bestMatch = considerCandidates(bestMatch, routeIndex.any.get(firstSegment), method, parts);
      bestMatch = considerCandidates(bestMatch, routeIndex.any.get("*"), method, parts);

      if (!bestMatch) {
        return new Response("Not Found", { status: 404 });
      }

      const { route, params } = bestMatch;
      const created = factory({
        request: req,
        requestUrl: url,
        params: params ?? {},
        remoteAddress,
        pattern: route.pattern,
      });

      const { event, cleanup } = unwrapEventFactoryResult(created);

      try {
        const result = await route.hook.Trigger(event, route.action);

        if (result instanceof Response) {
          if (method === "HEAD") {
            return new Response(null, {
              status: result.status,
              headers: result.headers,
            });
          }
          return result;
        }

        if (result instanceof ApiError) {
          const response = apiErrorResponse(event, result);
          if (method === "HEAD") {
            return new Response(null, { status: response.status, headers: response.headers });
          }
          return response;
        }

        if (result instanceof Error) {
          const response = apiErrorResponse(event, ToApiError(result));
          if (method === "HEAD") {
            return new Response(null, { status: response.status, headers: response.headers });
          }
          return response;
        }

        const response = new Response(null, { status: 200 });
        if (method === "HEAD") {
          return new Response(null, {
            status: response.status,
            headers: response.headers,
          });
        }
        return response;
      } catch (error) {
        if (error instanceof ApiError) {
          const response = apiErrorResponse(event, error);
          if (method === "HEAD") {
            return new Response(null, { status: response.status, headers: response.headers });
          }
          return response;
        }
        if (error instanceof Error) {
          const response = apiErrorResponse(event, ToApiError(error));
          if (method === "HEAD") {
            return new Response(null, { status: response.status, headers: response.headers });
          }
          return response;
        }
        return new Response(null, { status: 500 });
      } finally {
        await cleanup?.();
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
      const action = child.Action;
      const actionMeta = action as { __hookLabel?: string };
      if (!actionMeta.__hookLabel) {
        actionMeta.__hookLabel = `route:${pattern}`;
      }
      const segments = parsePattern(pathPattern);
      const hasDynamicSegments = segments.some((segment) => segment.type !== "static");

      out.push({
        method: child.Method,
        pathPattern,
        pattern,
        segments,
        hasDynamicSegments,
        scoreBase: computeRouteScoreBase(segments),
        hook,
        action,
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

function matchPathStatic(segments: Segment[], parts: string[]): boolean {
  if (parts.length !== segments.length) {
    return false;
  }

  for (let i = 0; i < segments.length; i += 1) {
    const segment = segments[i];
    const part = parts[i];
    if (!segment || segment.type !== "static" || segment.value !== part) {
      return false;
    }
  }

  return true;
}

function matchPathDynamic(segments: Segment[], parts: string[]): Record<string, string> | null {
  const params: Record<string, string> = {};
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

function considerCandidates<E extends RouterEvent>(
  bestMatch: RouteMatch<E> | null,
  candidates: Array<ResolvedRoute<E>> | undefined,
  method: string,
  parts: string[],
): RouteMatch<E> | null {
  if (!candidates) {
    return bestMatch;
  }

  for (const route of candidates) {
    const methodScore = matchMethodScore(method, route.method);
    if (methodScore < 0) {
      continue;
    }

    let params: Record<string, string> | null = null;
    if (route.hasDynamicSegments) {
      params = matchPathDynamic(route.segments, parts);
      if (!params) {
        continue;
      }
    } else if (!matchPathStatic(route.segments, parts)) {
      continue;
    }

    const score = methodScore * 1_000_000 + route.scoreBase;
    if (!bestMatch || score > bestMatch.score) {
      bestMatch = { route, params, score };
    }
  }

  return bestMatch;
}

function matchMethodScore(method: string, routeMethod: string): number {
  if (routeMethod === method) {
    return 3;
  }
  if (method === "HEAD" && routeMethod === "GET") {
    return 2;
  }
  if (routeMethod === "") {
    return 1;
  }
  return -1;
}

function computeRouteScoreBase(segments: Segment[]): number {
  let staticSegments = 0;
  let hasWildcard = false;

  for (const segment of segments) {
    if (segment.type === "static") {
      staticSegments += 1;
    } else if (segment.type === "wildcard") {
      hasWildcard = true;
    }
  }

  return staticSegments * 1_000 + segments.length * 10 + (hasWildcard ? 0 : 1);
}

function buildRouteIndex<E extends RouterEvent>(routes: Array<ResolvedRoute<E>>): RouteIndex<E> {
  const any = new Map<string, Array<ResolvedRoute<E>>>();
  const byMethod = new Map<string, Map<string, Array<ResolvedRoute<E>>>>();

  for (const route of routes) {
    const key = firstRouteSegment(route.segments);
    const target = route.method ? getMethodMap(byMethod, route.method) : any;
    pushRoute(target, key, route);
  }

  return { any, byMethod };
}

function firstRouteSegment(segments: Segment[]): string {
  if (segments.length === 0) {
    return "";
  }
  const first = segments[0];
  if (!first || first.type !== "static") {
    return "*";
  }
  return first.value;
}

function getMethodMap<E extends RouterEvent>(
  byMethod: Map<string, Map<string, Array<ResolvedRoute<E>>>>,
  method: string,
): Map<string, Array<ResolvedRoute<E>>> {
  const key = method.toUpperCase();
  let map = byMethod.get(key);
  if (!map) {
    map = new Map();
    byMethod.set(key, map);
  }
  return map;
}

function pushRoute<E extends RouterEvent>(
  target: Map<string, Array<ResolvedRoute<E>>>,
  key: string,
  route: ResolvedRoute<E>,
): void {
  const list = target.get(key);
  if (list) {
    list.push(route);
    return;
  }
  target.set(key, [route]);
}

function getRemoteAddress(req: Request, server?: unknown): string | null {
  const bunServer = server as { requestIP?: (req: Request) => { address: string; port?: number } | null } | undefined;
  if (bunServer?.requestIP) {
    const info = bunServer.requestIP(req);
    if (!info) {
      return null;
    }
    if (typeof info.port === "number") {
      const host = info.address.includes(":") ? `[${info.address}]` : info.address;
      return `${host}:${info.port}`;
    }
    return info.address;
  }
  return null;
}

function unwrapEventFactoryResult<E extends RouterEvent>(
  result: EventFactoryResult<E>,
): {
  event: E;
  cleanup: (() => void | Promise<void>) | null;
} {
  if (result && typeof result === "object" && "event" in result) {
    const wrapped = result as { event: E; cleanup?: () => void | Promise<void> };
    return { event: wrapped.event, cleanup: wrapped.cleanup ?? null };
  }

  const event = result as E & { Cleanup?: () => void | Promise<void> };
  if (typeof event.Cleanup === "function") {
    return { event, cleanup: () => event.Cleanup!() };
  }

  return { event, cleanup: null };
}
