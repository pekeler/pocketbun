// Ported from pocketbase/tools/router/group.go

import type { Resolver } from "../hook/event.ts";
import type { Handler as HookHandler } from "../hook/hook.ts";
import { Route, type Handler } from "./route.ts";

// RouterGroup represents a collection of routes and other sub groups
// that share common pattern prefix and middlewares.
export class RouterGroup<T extends Resolver> {
  excludedMiddlewares: Set<string> | null = null;
  children: Array<RouterGroup<T> | Route<T>> = [];

  Prefix = "";
  Middlewares: Array<HookHandler<T>> = [];

  Group(prefix: string): RouterGroup<T> {
    const group = new RouterGroup<T>();
    group.Prefix = prefix;
    this.children.push(group);
    return group;
  }

  BindFunc(...middlewareFuncs: Array<(e: T) => unknown>): this {
    for (const fn of middlewareFuncs) {
      this.Middlewares.push({ Func: fn });
    }
    return this;
  }

  Bind(...middlewares: Array<HookHandler<T>>): this {
    this.Middlewares.push(...middlewares);

    if (this.excludedMiddlewares) {
      for (const middleware of middlewares) {
        if (middleware.Id) {
          this.excludedMiddlewares.delete(middleware.Id);
        }
      }
    }

    return this;
  }

  Unbind(...middlewareIds: string[]): this {
    for (const middlewareId of middlewareIds) {
      if (!middlewareId) {
        continue;
      }

      for (let i = this.Middlewares.length - 1; i >= 0; i -= 1) {
        if (this.Middlewares[i]?.Id === middlewareId) {
          this.Middlewares.splice(i, 1);
        }
      }

      for (const child of this.children) {
        child.Unbind(middlewareId);
      }

      if (!this.excludedMiddlewares) {
        this.excludedMiddlewares = new Set();
      }
      this.excludedMiddlewares.add(middlewareId);
    }

    return this;
  }

  Route(method: string, path: string, action: Handler<T>): Route<T> {
    const route = new Route<T>(method, path, action);
    this.children.push(route);
    return route;
  }

  Any(path: string, action: Handler<T>): Route<T> {
    return this.Route("", path, action);
  }

  GET(path: string, action: Handler<T>): Route<T> {
    return this.Route("GET", path, action);
  }

  SEARCH(path: string, action: Handler<T>): Route<T> {
    return this.Route("SEARCH", path, action);
  }

  POST(path: string, action: Handler<T>): Route<T> {
    return this.Route("POST", path, action);
  }

  DELETE(path: string, action: Handler<T>): Route<T> {
    return this.Route("DELETE", path, action);
  }

  PATCH(path: string, action: Handler<T>): Route<T> {
    return this.Route("PATCH", path, action);
  }

  PUT(path: string, action: Handler<T>): Route<T> {
    return this.Route("PUT", path, action);
  }

  HEAD(path: string, action: Handler<T>): Route<T> {
    return this.Route("HEAD", path, action);
  }

  OPTIONS(path: string, action: Handler<T>): Route<T> {
    return this.Route("OPTIONS", path, action);
  }

  HasRoute(method: string, path: string): boolean {
    let pattern = path;
    if (method) {
      pattern = `${method.toUpperCase()} ${pattern}`;
    }

    return this.hasRoute(pattern, null);
  }

  private hasRoute(pattern: string, parents: Array<RouterGroup<T>> | null): boolean {
    const parentList = parents ?? [];

    for (const child of this.children) {
      if (child instanceof RouterGroup) {
        if (child.hasRoute(pattern, [...parentList, this])) {
          return true;
        }
        continue;
      }

      let result = "";
      if (child.Method) {
        result += `${child.Method} `;
      }

      for (const parent of parentList) {
        result += parent.Prefix;
      }

      result += this.Prefix;
      result += child.Path;

      if (result === pattern || stripWildcard(result) === stripWildcard(pattern)) {
        return true;
      }
    }

    return false;
  }

  group(prefix: string): RouterGroup<T> {
    return this.Group(prefix);
  }

  bind(...middlewares: Array<HookHandler<T>>): this {
    return this.Bind(...middlewares);
  }

  bindFunc(...middlewareFuncs: Array<(e: T) => unknown>): this {
    return this.BindFunc(...middlewareFuncs);
  }

  unbind(...middlewareIds: string[]): this {
    return this.Unbind(...middlewareIds);
  }

  route(method: string, path: string, action: Handler<T>): Route<T> {
    return this.Route(method, path, action);
  }

  any(path: string, action: Handler<T>): Route<T> {
    return this.Any(path, action);
  }

  get(path: string, action: Handler<T>): Route<T> {
    return this.GET(path, action);
  }

  search(path: string, action: Handler<T>): Route<T> {
    return this.SEARCH(path, action);
  }

  post(path: string, action: Handler<T>): Route<T> {
    return this.POST(path, action);
  }

  delete(path: string, action: Handler<T>): Route<T> {
    return this.DELETE(path, action);
  }

  patch(path: string, action: Handler<T>): Route<T> {
    return this.PATCH(path, action);
  }

  put(path: string, action: Handler<T>): Route<T> {
    return this.PUT(path, action);
  }

  head(path: string, action: Handler<T>): Route<T> {
    return this.HEAD(path, action);
  }

  options(path: string, action: Handler<T>): Route<T> {
    return this.OPTIONS(path, action);
  }
}

const wildcardPlaceholderRegex = /\/{.+\.\.\.}$/;

function stripWildcard(pattern: string): string {
  return pattern.replace(wildcardPlaceholderRegex, "/");
}
