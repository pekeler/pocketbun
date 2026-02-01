// Ported from pocketbase/tools/hook/tagged.go

import type { Resolver } from "./event.ts";
import type { Handler, HandlerFunc } from "./hook.ts";
import { existInSlice } from "../list/list.ts";
import { Hook } from "./hook.ts";

// Tagger defines an interface for event data structs that support tags/groups/categories/etc.
// Usually used together with TaggedHook.
export interface Tagger extends Resolver {
  Tags(): string[];
}

class MainHook<T extends Tagger> {
  Hook: Hook<T>;

  constructor(hook: Hook<T>) {
    this.Hook = hook;
  }
}

// TaggedHook defines a proxy hook which register handlers that are triggered only
// if the TaggedHook.tags are empty or includes at least one of the event data tag(s).
export class TaggedHook<T extends Tagger> {
  #main: MainHook<T>;
  #tags: string[];

  constructor(hook: Hook<T>, tags: string[]) {
    this.#main = new MainHook(hook);
    this.#tags = tags;
  }

  CanTriggerOn(tagsToCheck: string[]): boolean {
    if (this.#tags.length === 0) {
      return true;
    }
    for (const tag of tagsToCheck) {
      if (existInSlice(tag, this.#tags)) {
        return true;
      }
    }
    return false;
  }

  Bind(handler: Handler<T>): string {
    const fn = handler.Func;
    handler.Func = (event: T) => {
      if (this.CanTriggerOn(event.Tags())) {
        return fn(event);
      }
      return event.Next();
    };
    return this.#main.Hook.Bind(handler);
  }

  BindFunc(fn: HandlerFunc<T>): string {
    return this.#main.Hook.BindFunc((event: T) => {
      if (this.CanTriggerOn(event.Tags())) {
        return fn(event);
      }
      return event.Next();
    });
  }

  Trigger(event: T, ...oneOffHandlerFuncs: HandlerFunc<T>[]): unknown {
    return this.#main.Hook.Trigger(event, ...oneOffHandlerFuncs);
  }

  Unbind(...idsToRemove: string[]): void {
    this.#main.Hook.Unbind(...idsToRemove);
  }

  UnbindAll(): void {
    this.#main.Hook.UnbindAll();
  }

  Length(): number {
    return this.#main.Hook.Length();
  }
}

// NewTaggedHook creates a new TaggedHook with the provided main hook and optional tags.
export function NewTaggedHook<T extends Tagger>(hook: Hook<T>, ...tags: string[]): TaggedHook<T> {
  return new TaggedHook(hook, tags);
}
