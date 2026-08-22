// Ported from pocketbase/apis/middlewares_rate_limit.go so the cluster primary can reuse the exact limiter algorithm.

export class RateLimiter {
  private clients: Map<string, RateClient>;
  private readonly maxAllowed: number;
  private readonly interval: number;
  private readonly minDeleteInterval: number;
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

  isLimited(key: string): boolean {
    const client = this.clients.get(key);
    return Boolean(client && client.available <= 0 && Date.now() / 1000 - client.start < client.interval);
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
  readonly maxAllowed: number;
  available: number;
  readonly interval: number;
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
