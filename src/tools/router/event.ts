// Ported from pocketbase/tools/router/event.go

import type { NextFunc, Resolver } from "../hook/event.ts";
import { Store } from "../store/store.ts";

export class Event implements Resolver {
  request: Request;
  params: Record<string, string>;
  responseHeaders: Headers;
  #next: NextFunc | null;
  #remoteAddress: string | null;
  #data: Store<string, unknown>;

  constructor(options: {
    request: Request;
    params?: Record<string, string>;
    remoteAddress?: string | null;
    next?: NextFunc | null;
  }) {
    this.request = options.request;
    this.params = options.params ?? {};
    this.responseHeaders = new Headers();
    this.#next = options.next ?? null;
    this.#remoteAddress = options.remoteAddress ?? null;
    this.#data = new Store();
  }

  Next(): unknown {
    if (this.#next) {
      return this.#next();
    }
    return null;
  }

  nextFunc(): NextFunc | null {
    return this.#next;
  }

  setNextFunc(fn: NextFunc | null): void {
    this.#next = fn;
  }

  async next(): Promise<unknown> {
    return this.Next();
  }

  Get(key: string): unknown {
    return this.#data.get(key);
  }

  GetAll(): Record<string, unknown> {
    return this.#data.toJSON();
  }

  Set(key: string, value: unknown): void {
    this.#data.set(key, value);
  }

  SetAll(data: Record<string, unknown>): void {
    for (const [key, value] of Object.entries(data)) {
      this.#data.set(key, value);
    }
  }

  json(status: number, body: unknown): Response {
    if (!this.responseHeaders.has("Content-Type")) {
      this.responseHeaders.set("Content-Type", "application/json; charset=utf-8");
    }
    return new Response(JSON.stringify(body), {
      status,
      headers: this.responseHeaders,
    });
  }

  async bindBody<T extends object>(target: T): Promise<void> {
    const contentType = this.request.headers.get("Content-Type") ?? "";
    if (!this.request.body) {
      return;
    }

    if (contentType.includes("application/json")) {
      try {
        const parsed = await this.request.json();
        if (parsed && typeof parsed === "object") {
          Object.assign(target, parsed as object);
        }
      } catch {
        // ignore malformed JSON for now; upstream returns error later in request validation
      }
    }
  }

  remoteIP(): string {
    return this.#remoteAddress ?? "";
  }
}
