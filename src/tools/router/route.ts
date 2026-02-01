// Ported from pocketbase/tools/router/route.go

import type { Resolver } from "../hook/event.ts";
import type { Handler as HookHandler } from "../hook/hook.ts";

export type Handler<E> = (event: E) => unknown;

export class Route<T extends Resolver> {
  excludedMiddlewares: Set<string> | null = null;

  Action: Handler<T>;
  Method: string;
  Path: string;
  Middlewares: Array<HookHandler<T>> = [];

  constructor(method: string, path: string, action: Handler<T>) {
    this.Method = method.toUpperCase();
    this.Path = path;
    this.Action = action;
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

      if (!this.excludedMiddlewares) {
        this.excludedMiddlewares = new Set();
      }
      this.excludedMiddlewares.add(middlewareId);
    }

    return this;
  }
}
