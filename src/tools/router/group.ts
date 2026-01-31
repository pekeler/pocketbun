// Ported from pocketbase/tools/router/group.go

import type { Handler } from "./route.ts";
import type { Router } from "./router.ts";

function joinPaths(base: string, path: string): string {
  const trimmedBase = base.replace(/\/+$/g, "");
  const trimmedPath = path.replace(/^\/+/, "");
  if (trimmedBase === "") {
    return `/${trimmedPath}`.replace(/\/+$/, "") || "/";
  }
  if (trimmedPath === "") {
    return trimmedBase || "/";
  }
  return `${trimmedBase}/${trimmedPath}`;
}

export class RouterGroup<E> {
  #router: Router<E>;
  #prefix: string;

  constructor(router: Router<E>, prefix: string) {
    this.#router = router;
    this.#prefix = prefix;
  }

  get(path: string, handler: Handler<E>): this {
    this.#router.get(joinPaths(this.#prefix, path), handler);
    return this;
  }

  post(path: string, handler: Handler<E>): this {
    this.#router.post(joinPaths(this.#prefix, path), handler);
    return this;
  }

  patch(path: string, handler: Handler<E>): this {
    this.#router.patch(joinPaths(this.#prefix, path), handler);
    return this;
  }

  put(path: string, handler: Handler<E>): this {
    this.#router.put(joinPaths(this.#prefix, path), handler);
    return this;
  }

  delete(path: string, handler: Handler<E>): this {
    this.#router.delete(joinPaths(this.#prefix, path), handler);
    return this;
  }

  group(prefix: string): RouterGroup<E> {
    return new RouterGroup(this.#router, joinPaths(this.#prefix, prefix));
  }
}
