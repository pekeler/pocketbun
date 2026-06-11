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
      return this.#hook.CanTriggerOn(tagsToCheck);
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

    // PocketBun perf deviation (behavior-compatible): avoid wrapping every tagged
    // handler with a runtime `event.Next()` branch. Hook.Trigger will skip
    // non-matching tagged handlers directly.
    const taggedHandler = {
      ...handler,
      __pbTagSet: this.#tagSet,
    } as Handler<T> & { __pbTagSet?: Set<string> | null };
    return this.#hook.Bind(taggedHandler);
  }

  BindFunc(fn: HandlerFunc<T>): string {
    if (!this.#tagSet) {
      return this.#hook.BindFunc(fn);
    }

    const taggedHandler = {
      func: fn,
      __pbTagSet: this.#tagSet,
    } as Handler<T> & { __pbTagSet?: Set<string> | null };
    return this.#hook.Bind(taggedHandler);
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

  canTriggerOn(tagsToCheck: string[]): boolean {
    return this.CanTriggerOn(tagsToCheck);
  }

  bind(handler: Handler<T>): string {
    return this.Bind(handler);
  }

  bindFunc(fn: HandlerFunc<T>): string {
    return this.BindFunc(fn);
  }

  trigger(event: T, ...oneOffHandlerFuncs: HandlerFunc<T>[]): unknown {
    return this.Trigger(event, ...oneOffHandlerFuncs);
  }

  unbind(...idsToRemove: string[]): void {
    this.Unbind(...idsToRemove);
  }

  unbindAll(): void {
    this.UnbindAll();
  }

  length(): number {
    return this.Length();
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
