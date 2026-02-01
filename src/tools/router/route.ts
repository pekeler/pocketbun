// Ported from pocketbase/tools/router/route.go

export type Handler<E> = (event: E) => Response | Promise<Response> | void | Promise<void>;

export type RouteMatch = {
  params: Record<string, string>;
};

type Segment = { type: "static"; value: string } | { type: "param"; name: string } | { type: "wildcard"; name: string };

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

export class Route<E> {
  method: string;
  pattern: string;
  handler: Handler<E>;
  #segments: Segment[];

  constructor(method: string, pattern: string, handler: Handler<E>) {
    this.method = method.toUpperCase();
    this.pattern = pattern;
    this.handler = handler;
    this.#segments = parsePattern(pattern);
  }

  match(pathname: string): RouteMatch | null {
    const params: Record<string, string> = {};
    const parts = splitPath(pathname);

    for (let i = 0, j = 0; i < this.#segments.length; i += 1, j += 1) {
      const segment = this.#segments[i];
      const part = parts[j];
      if (!segment) {
        return null;
      }

      if (segment.type === "wildcard") {
        const remaining = parts.slice(j).join("/");
        params[segment.name] = remaining;
        return { params };
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

    if (parts.length !== this.#segments.length) {
      return null;
    }

    return { params };
  }
}
