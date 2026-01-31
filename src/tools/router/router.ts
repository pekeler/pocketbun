// Ported from pocketbase/tools/router/router.go

// Note: this is a minimal router implementation without upstream middleware features yet.

import { Route, type Handler } from "./route.ts";
import { RouterGroup } from "./group.ts";

export type EventFactory<E> = (options: {
  request: Request;
  params: Record<string, string>;
  remoteAddress: string | null;
}) => E;

export class Router<E> {
  #routes: Array<Route<E>> = [];

  get(path: string, handler: Handler<E>): this {
    this.#routes.push(new Route("GET", path, handler));
    return this;
  }

  group(prefix: string): RouterGroup<E> {
    return new RouterGroup(this, prefix);
  }

  buildHandler(factory: EventFactory<E>): (req: Request, server?: unknown) => Promise<Response> {
    return async (req: Request, server?: unknown): Promise<Response> => {
      const url = new URL(req.url);
      const method = req.method.toUpperCase();
      const matchMethod = method === "HEAD" ? "GET" : method;
      const remoteAddress = getRemoteAddress(req, server);

      for (const route of this.#routes) {
        if (route.method !== matchMethod) {
          continue;
        }

        const match = route.match(url.pathname);
        if (!match) {
          continue;
        }

        const event = factory({
          request: req,
          params: match.params,
          remoteAddress,
        });

        const result = await route.handler(event);
        if (result instanceof Response) {
          if (method === "HEAD") {
            return new Response(null, {
              status: result.status,
              headers: result.headers,
            });
          }
          return result;
        }

        return new Response(null, { status: 204 });
      }

      return new Response("Not Found", { status: 404 });
    };
  }
}

function getRemoteAddress(req: Request, server?: unknown): string | null {
  const bunServer = server as
    | { requestIP?: (req: Request) => { address: string } | null }
    | undefined;
  if (bunServer?.requestIP) {
    return bunServer.requestIP(req)?.address ?? null;
  }
  return null;
}
