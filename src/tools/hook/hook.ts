// Ported from pocketbase/tools/hook/hook.go

import type { Resolver } from "./event.ts";
import { Event } from "./event.ts";
import { randomString } from "../security/random.ts";

export type HandlerFunc<T extends Resolver> = (event: T) => unknown;

export type Handler<T extends Resolver> = {
  Func: HandlerFunc<T>;
  Id?: string;
  Priority?: number;
};

export class Hook<T extends Resolver> {
  #handlers: Handler<T>[] = [];

  Bind(handler: Handler<T>): string {
    let exists = false;
    if (!handler.Id) {
      handler.Id = generateHookId();
      while (this.#handlers.some((existing) => existing.Id === handler.Id)) {
        handler.Id = generateHookId();
      }
    } else {
      const index = this.#handlers.findIndex((existing) => existing.Id === handler.Id);
      if (index >= 0) {
        this.#handlers[index] = handler;
        exists = true;
      }
    }

    if (!exists) {
      this.#handlers.push(handler);
    }

    this.#handlers.sort((a, b) => (a.Priority ?? 0) - (b.Priority ?? 0));
    return handler.Id ?? "";
  }

  BindFunc(fn: HandlerFunc<T>): string {
    return this.Bind({ Func: fn });
  }

  Unbind(...idsToRemove: string[]): void {
    if (idsToRemove.length === 0) {
      return;
    }
    this.#handlers = this.#handlers.filter((handler) => !idsToRemove.includes(handler.Id ?? ""));
  }

  UnbindAll(): void {
    this.#handlers = [];
  }

  Length(): number {
    return this.#handlers.length;
  }

  Trigger(event: T, ...oneOffHandlerFuncs: HandlerFunc<T>[]): unknown {
    const handlers: HandlerFunc<T>[] = [];
    for (const handler of this.#handlers) {
      handlers.push(handler.Func);
    }
    handlers.push(...oneOffHandlerFuncs);

    event.setNextFunc(null);

    for (let i = handlers.length - 1; i >= 0; i -= 1) {
      const handler = handlers[i];
      if (!handler) {
        continue;
      }
      const old = event.nextFunc();
      event.setNextFunc(() => {
        event.setNextFunc(old);
        return handler(event);
      });
    }

    return event.Next();
  }
}

function generateHookId(): string {
  return randomString(20);
}

export { Event };
