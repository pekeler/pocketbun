// Ported from pocketbase/tools/hook/tagged.go

import { existInSlice } from "../list/list.ts";
import type { Resolver } from "./event.ts";
import type { Handler, HandlerFunc } from "./hook.ts";
import { Hook } from "./hook.ts";

export interface Tagger extends Resolver {
  Tags(): string[];
}

class MainHook<T extends Tagger> {
  Hook: Hook<T>;

  constructor(hook: Hook<T>) {
    this.Hook = hook;
  }
}

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
}

export function NewTaggedHook<T extends Tagger>(hook: Hook<T>, ...tags: string[]): TaggedHook<T> {
  return new TaggedHook(hook, tags);
}
