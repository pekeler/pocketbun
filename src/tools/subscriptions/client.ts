// Ported from pocketbase/tools/subscriptions/client.go

import { toStringValue } from "../../internal/compat/cast.ts";
import { snakecase } from "../inflector/inflector.ts";
import { randomString } from "../security/random.ts";
import { Message } from "./message.ts";

const optionsParam = "options";

// SubscriptionOptions defines the request options (query params, headers, etc.)
// for a single subscription topic.
export type SubscriptionOptions = {
  query: Record<string, string>;
  headers: Record<string, string>;
};

// Client is an interface for a generic subscription client.
export interface Client {
  Id(): string;
  Channel(): Channel<Message>;
  Subscriptions(...prefixes: string[]): Record<string, SubscriptionOptions>;
  Subscribe(...subs: string[]): void;
  Unsubscribe(...subs: string[]): void;
  HasSubscription(sub: string): boolean;
  Set(key: string, value: unknown): void;
  Unset(key: string): void;
  Get(key: string): unknown;
  Discard(): void;
  IsDiscarded(): boolean;
  Send(m: Message): void;
}

// DefaultClient defines a generic subscription client.
export class DefaultClient implements Client {
  #store = new Map<string, unknown>();
  #subscriptions = new Map<string, SubscriptionOptions>();
  #channel = new Channel<Message>();
  #id = randomString(40);
  #isDiscarded = false;

  // Id implements the [Client.Id] interface method.
  Id(): string {
    return this.#id;
  }

  // Channel implements the [Client.Channel] interface method.
  Channel(): Channel<Message> {
    return this.#channel;
  }

  // Subscriptions implements the [Client.Subscriptions] interface method.
  //
  // It returns a shallow copy of the client subscriptions matching the prefixes.
  // If no prefix is specified, returns all subscriptions.
  Subscriptions(...prefixes: string[]): Record<string, SubscriptionOptions> {
    if (prefixes.length === 0) {
      return Object.fromEntries(this.#subscriptions);
    }

    const result: Record<string, SubscriptionOptions> = {};
    for (const prefix of prefixes) {
      for (const [sub, options] of this.#subscriptions) {
        if ((sub + "?").startsWith(prefix)) {
          result[sub] = options;
        }
      }
    }

    return result;
  }

  // Subscribe implements the [Client.Subscribe] interface method.
  //
  // Empty subscriptions (aka. "") are ignored.
  Subscribe(...subs: string[]): void {
    for (const sub of subs) {
      if (!sub) {
        continue;
      }

      const rawOptions: {
        Query?: Record<string, unknown>;
        Headers?: Record<string, unknown>;
        query?: Record<string, unknown>;
        headers?: Record<string, unknown>;
      } = {};
      let raw = "";
      try {
        const url = new URL(sub, "http://localhost");
        raw = url.searchParams.get(optionsParam) ?? "";
      } catch {
        const match = sub.match(/[?&]options=([^&]+)/);
        if (match) {
          raw = match[1] ?? "";
        }
      }
      if (raw) {
        let decoded = raw;
        try {
          decoded = decodeURIComponent(raw);
        } catch {
          decoded = raw;
        }
        try {
          Object.assign(rawOptions, JSON.parse(decoded));
        } catch {
          // ignore invalid options
        }
      }

      const options: SubscriptionOptions = {
        query: {},
        headers: {},
      };

      const query = rawOptions.Query ?? rawOptions.query ?? {};
      for (const [key, value] of Object.entries(query)) {
        options.query[key] = toStringValue(value);
      }

      const headers = rawOptions.Headers ?? rawOptions.headers ?? {};
      for (const [key, value] of Object.entries(headers)) {
        options.headers[snakecase(key)] = toStringValue(value);
      }

      this.#subscriptions.set(sub, options);
    }
  }

  // Unsubscribe implements the [Client.Unsubscribe] interface method.
  //
  // If subs is not set, this method removes all registered client's subscriptions.
  Unsubscribe(...subs: string[]): void {
    if (subs.length > 0) {
      for (const sub of subs) {
        this.#subscriptions.delete(sub);
      }
      return;
    }

    this.#subscriptions.clear();
  }

  // HasSubscription implements the [Client.HasSubscription] interface method.
  HasSubscription(sub: string): boolean {
    return this.#subscriptions.has(sub);
  }

  // Set implements the [Client.Set] interface method.
  Set(key: string, value: unknown): void {
    this.#store.set(key, value);
  }

  // Unset implements the [Client.Unset] interface method.
  Unset(key: string): void {
    this.#store.delete(key);
  }

  // Get implements the [Client.Get] interface method.
  Get(key: string): unknown {
    return this.#store.get(key);
  }

  // Discard implements the [Client.Discard] interface method.
  Discard(): void {
    if (this.#isDiscarded) {
      return;
    }
    this.#isDiscarded = true;
    this.#channel.close();
  }

  // IsDiscarded implements the [Client.IsDiscarded] interface method.
  IsDiscarded(): boolean {
    return this.#isDiscarded;
  }

  // Send sends the specified message to the client's channel (if not discarded).
  Send(m: Message): void {
    if (this.#isDiscarded) {
      return;
    }
    this.#channel.send(m);
  }
}

export class Channel<T> implements AsyncIterable<T> {
  #queue: T[] = [];
  #resolvers: Array<(result: IteratorResult<T>) => void> = [];
  #closed = false;

  send(value: T): void {
    if (this.#closed) {
      return;
    }
    const resolver = this.#resolvers.shift();
    if (resolver) {
      resolver({ value, done: false });
      return;
    }
    this.#queue.push(value);
  }

  close(): void {
    if (this.#closed) {
      return;
    }
    this.#closed = true;
    for (const resolver of this.#resolvers) {
      resolver({ value: undefined as T, done: true });
    }
    this.#resolvers = [];
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return {
      next: () => {
        if (this.#queue.length > 0) {
          const value = this.#queue.shift() as T;
          return Promise.resolve({ value, done: false });
        }
        if (this.#closed) {
          return Promise.resolve({ value: undefined as T, done: true });
        }
        return new Promise((resolve) => {
          this.#resolvers.push(resolve);
        });
      },
    };
  }
}
