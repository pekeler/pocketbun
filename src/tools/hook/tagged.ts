// Ported from pocketbase/tools/hook/tagged.go

import type { Resolver } from "./event.ts";
import type { Handler, HandlerFunc } from "./hook.ts";
import { Hook } from "./hook.ts";

// Tagger defines an interface for event data structs that support tags/groups/categories/etc.
// Usually used together with TaggedHook.
export interface Tagger extends Resolver {
  Tags(): string[];
}

// TaggedHook defines a proxy hook which register handlers that are triggered only
// if the TaggedHook.tags are empty or includes at least one of the event data tag(s).
export class TaggedHook<T extends Tagger> {
  #hook: Hook<T>;
  #tagSet: Set<string> | null;

  constructor(hook: Hook<T>, tags: string[]) {
    this.#hook = hook;
    this.#tagSet = tags.length > 0 ? new Set(tags) : null;
  }

  CanTriggerOn(tagsToCheck: string[]): boolean {
    if (!this.#tagSet) {
      return true;
    }
    for (const tag of tagsToCheck) {
      if (this.#tagSet.has(tag)) {
        return true;
      }
    }
    return false;
  }

  Bind(handler: Handler<T>): string {
    if (!this.#tagSet) {
      return this.#hook.Bind(handler);
    }

    const fn = handler.Func;
    handler.Func = (event: T) => {
      if (this.CanTriggerOn(event.Tags())) {
        return fn(event);
      }
      return event.Next();
    };
    return this.#hook.Bind(handler);
  }

  BindFunc(fn: HandlerFunc<T>): string {
    if (!this.#tagSet) {
      return this.#hook.BindFunc(fn);
    }

    return this.#hook.BindFunc((event: T) => {
      if (this.CanTriggerOn(event.Tags())) {
        return fn(event);
      }
      return event.Next();
    });
  }

  Trigger(event: T, ...oneOffHandlerFuncs: HandlerFunc<T>[]): unknown {
    return this.#hook.Trigger(event, ...oneOffHandlerFuncs);
  }

  Unbind(...idsToRemove: string[]): void {
    this.#hook.Unbind(...idsToRemove);
  }

  UnbindAll(): void {
    this.#hook.UnbindAll();
  }

  Length(): number {
    return this.#hook.Length();
  }
}

const untaggedHookCache = new WeakMap<Hook<Tagger>, TaggedHook<Tagger>>();

// NewTaggedHook creates a new TaggedHook with the provided main hook and optional tags.
export function NewTaggedHook<T extends Tagger>(hook: Hook<T>, ...tags: string[]): TaggedHook<T> {
  // PocketBun perf deviation (behavior-compatible): untagged hooks are used in hot paths
  // (model/record create/update flow), so cache and reuse the wrapper instance.
  if (tags.length === 0) {
    const typedHook = hook as unknown as Hook<Tagger>;
    const cached = untaggedHookCache.get(typedHook);
    if (cached) {
      return cached as unknown as TaggedHook<T>;
    }
    const created = new TaggedHook(hook, tags);
    untaggedHookCache.set(typedHook, created as unknown as TaggedHook<Tagger>);
    return created;
  }

  return new TaggedHook(hook, tags);
}
