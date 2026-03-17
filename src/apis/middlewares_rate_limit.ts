// Ported from pocketbase/apis/middlewares_rate_limit.go

import type { App } from "../core/app.ts";
import type { Collection } from "../core/collection_model.ts";
import type { RequestEvent } from "../core/event_request.ts";
import type { Handler } from "../tools/hook/hook.ts";
import {
  RateLimitRuleAudienceAll,
  RateLimitRuleAudienceAuth,
  RateLimitRuleAudienceGuest,
  type RateLimitRule,
} from "../core/settings_model.ts";
import { Store } from "../tools/store/store.ts";
import { tooManyRequests } from "./api_errors.ts";
import { DefaultRateLimitMiddlewareId, DefaultRateLimitMiddlewarePriority } from "./middlewares.ts";

const rateLimitersStoreKey = "__pbRateLimiters__";
const rateLimitersCronKey = "__pbRateLimitersCleanup__";
const rateLimitersSettingsHookId = "__pbRateLimitersSettingsHook__";

// rateLimit defines the global rate limit middleware.
//
// This middleware is registered by default for all routes.
export function rateLimit(): Handler<RequestEvent> {
  return {
    Id: DefaultRateLimitMiddlewareId,
    Priority: DefaultRateLimitMiddlewarePriority,
    Func: (event) => {
      if (skipRateLimit(event)) {
        return event.Next();
      }

      const [rule, ok] = event.app
        .settings()
        .rateLimits.findRateLimitRule(defaultRateLimitLabels(event), ...defaultRateLimitAudience(event));

      if (ok && rule) {
        const audience = rule.audience ?? RateLimitRuleAudienceAll;
        const response = checkRateLimit(event, rule.label + audience, rule);
        if (response) {
          return response;
        }
      }

      return event.Next();
    },
  };
}

// collectionPathRateLimit defines a rate limit middleware for the internal collection handlers.
export function collectionPathRateLimit(collectionPathParam: string, ...baseTags: string[]): Handler<RequestEvent> {
  const param = collectionPathParam || "collection";

  return {
    Id: DefaultRateLimitMiddlewareId,
    Priority: DefaultRateLimitMiddlewarePriority,
    Func: (event) => {
      const collectionId = event.params[param] ?? "";
      let collection: ReturnType<App["FindCachedCollectionByNameOrId"]> | null = null;
      try {
        collection = event.app.FindCachedCollectionByNameOrId(collectionId);
      } catch {
        collection = null;
      }
      if (!collection) {
        return event.json(404, {
          status: 404,
          message: "Missing or invalid collection context.",
          data: {},
        });
      }

      const response = checkCollectionRateLimit(event, collection, ...baseTags);
      if (response) {
        return response;
      }

      return event.Next();
    },
  };
}

// checkCollectionRateLimit checks whether the current request satisfy the
// rate limit configuration for the specific collection.
//
// Each baseTags entry will be prefixed with the collection name and its wildcard variant.
export function checkCollectionRateLimit(event: RequestEvent, collection: Collection, ...baseTags: string[]): Response | null {
  if (skipRateLimit(event)) {
    return null;
  }

  const labels: string[] = [];
  let rtId = `${collection.id}${event.pattern || event.requestUrl().pathname}`;

  for (const baseTag of baseTags) {
    rtId += baseTag;
    labels.push(`${collection.name}:${baseTag}`);
  }

  for (const baseTag of baseTags) {
    labels.push(`*:${baseTag}`);
  }

  labels.push(...defaultRateLimitLabels(event));

  const [rule, ok] = event.app.settings().rateLimits.findRateLimitRule(labels, ...defaultRateLimitAudience(event));
  if (ok && rule) {
    const audience = rule.audience ?? RateLimitRuleAudienceAll;
    return checkRateLimit(event, rtId + audience, rule);
  }

  return null;
}

// @todo consider exporting as helper?
export function checkRateLimit(event: RequestEvent, rtId: string, rule: RateLimitRule): Response | null {
  const audience = rule.audience ?? RateLimitRuleAudienceAll;

  switch (audience) {
    case RateLimitRuleAudienceGuest:
      if (event.auth) {
        return null;
      }
      break;
    case RateLimitRuleAudienceAuth:
      if (!event.auth) {
        return null;
      }
      break;
    case RateLimitRuleAudienceAll:
    default:
      break;
  }

  const store = event.app.store().getOrSet(rateLimitersStoreKey, () => initRateLimitersStore(event.app)) as
    | Store<string, RateLimiter>
    | undefined;

  if (!store) {
    event.app.Logger().Warn("Failed to retrieve app rate limiters store");
    return null;
  }

  const limiter = store.getOrSet(rtId, () => newRateLimiter(rule.maxRequests, rule.duration, 1800));
  if (!limiter) {
    event.app.Logger().Warn("Failed to retrieve app rate limiter", "id", rtId);
    return null;
  }

  const key = event.realIP();
  if (!key) {
    event.app.Logger().Warn("Empty rate limit client key");
    return null;
  }

  if (!limiter.isAllowed(key)) {
    return tooManyRequests(event, "");
  }

  return null;
}

// @todo consider exporting as helper?
//
//nolint:unused
export function isClientRateLimited(event: RequestEvent, rtId: string): boolean {
  const rateLimiters = event.app.store().get(rateLimitersStoreKey) as Store<string, RateLimiter> | undefined;
  if (!rateLimiters) {
    return false;
  }

  const [rt, ok] = rateLimiters.getOk(rtId);
  if (!ok || !rt) {
    return false;
  }

  const [client, found] = rt.getClient(event.realIP());
  if (!found || !client) {
    return false;
  }

  return client.available <= 0 && Date.now() / 1000 - client.start < client.interval;
}

function skipRateLimit(event: RequestEvent): boolean {
  return !event.app.settings().rateLimits.enabled || event.hasSuperuserAuth();
}

const defaultAuthAudience = [RateLimitRuleAudienceAll, RateLimitRuleAudienceAuth];
const defaultGuestAudience = [RateLimitRuleAudienceAll, RateLimitRuleAudienceGuest];

function defaultRateLimitAudience(event: RequestEvent): string[] {
  return event.auth ? defaultAuthAudience : defaultGuestAudience;
}

function defaultRateLimitLabels(event: RequestEvent): string[] {
  const url = event.requestUrl();
  return [`${event.request.method} ${url.pathname}`, url.pathname];
}

function destroyRateLimitersStore(app: App): void {
  app.OnSettingsReload().Unbind(rateLimitersSettingsHookId);
  app.Cron().Remove(rateLimitersCronKey);
  app.store().remove(rateLimitersStoreKey);
}

function initRateLimitersStore(app: App): Store<string, RateLimiter> {
  app.Cron().Add(rateLimitersCronKey, "2 * * * *", () => {
    const limitersStore = app.store().get(rateLimitersStoreKey) as Store<string, RateLimiter> | undefined;
    if (!limitersStore) {
      return;
    }
    for (const limiter of limitersStore.values()) {
      limiter.clean();
    }
  });

  app.OnSettingsReload().Bind({
    Id: rateLimitersSettingsHookId,
    Func: (event) => {
      const result = event.Next();
      if (result instanceof Error) {
        return result;
      }
      destroyRateLimitersStore(event.App);
      return result;
    },
  });

  return new Store();
}

function newRateLimiter(maxAllowed: number, interval: number, minDeleteInterval: number): RateLimiter {
  return new RateLimiter(maxAllowed, interval, minDeleteInterval);
}

class RateLimiter {
  private clients: Map<string, RateClient>;
  private maxAllowed: number;
  private interval: number;
  private minDeleteInterval: number;
  private totalDeleted = 0;

  constructor(maxAllowed: number, interval: number, minDeleteInterval: number) {
    // Note: upstream guards this map with a RWMutex; Bun's single-threaded JS runtime makes this unnecessary here.
    this.clients = new Map();
    this.maxAllowed = maxAllowed;
    this.interval = interval;
    this.minDeleteInterval = minDeleteInterval;
  }

  getClient(key: string): [RateClient | undefined, boolean] {
    const client = this.clients.get(key);
    return [client, Boolean(client)];
  }

  isAllowed(key: string): boolean {
    let client = this.clients.get(key);
    if (!client) {
      client = new RateClient(this.maxAllowed, this.interval);
      this.clients.set(key, client);
    }

    return client.consume();
  }

  clean(): void {
    const now = Math.floor(Date.now() / 1000);

    for (const [key, client] of this.clients.entries()) {
      if (client.hasExpired(now, this.minDeleteInterval)) {
        this.clients.delete(key);
        this.totalDeleted += 1;
      }
    }

    if (this.totalDeleted >= 300) {
      this.clients = new Map(this.clients);
      this.totalDeleted = 0;
    }
  }
}

class RateClient {
  maxAllowed: number;
  available: number;
  interval: number;
  start: number;

  constructor(maxAllowed: number, interval: number) {
    this.maxAllowed = maxAllowed;
    this.interval = interval;
    this.available = 0;
    this.start = 0;
  }

  hasExpired(relativeNow: number, minElapsed: number): boolean {
    return relativeNow - (this.start + this.interval) > minElapsed;
  }

  consume(): boolean {
    const now = Math.floor(Date.now() / 1000);

    if (now - this.start >= this.interval) {
      this.available = this.maxAllowed;
      this.start = now;
    }

    if (this.available > 0) {
      this.available -= 1;
      return true;
    }

    return false;
  }
}
