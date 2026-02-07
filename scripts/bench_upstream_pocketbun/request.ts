// Ported from vendor/pocketbase-benchmarks/benchmarks/request.go.
import type { BodyInit } from "bun";
import { setTimeout as delay } from "node:timers/promises";

export type BenchRequestOptions = {
  Body?: BodyInit | null;
  Context?: AbortSignal;
  Headers?: Record<string, string>;
  Method: string;
  Url: string;
};

export class BenchRequest {
  Body: BodyInit | null;
  Context?: AbortSignal;
  Headers: Record<string, string>;
  Method: string;
  Url: string;

  constructor(options: BenchRequestOptions) {
    this.Body = options.Body ?? null;
    this.Context = options.Context;
    this.Headers = options.Headers ?? {};
    this.Method = options.Method;
    this.Url = options.Url;
  }

  // If destBody is non-nil, it will read and unmarshal the request
  // response body into the specified variable.
  async Send(destBody: Record<string, unknown> | null): Promise<void> {
    const headers = new Headers();

    for (const [key, value] of Object.entries(this.Headers)) {
      headers.set(key, value);
    }

    // set default content-type header (if missing)
    if (!headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }

    // PocketBun-only: mirror upstream benchmark-runner retry behavior for
    // transient local socket exhaustion under very high client concurrency.
    let response: Response | null = null;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      try {
        response = await fetch(this.Url, {
          method: this.Method,
          body: this.Body,
          headers,
          signal: this.Context,
        });
        break;
      } catch (error) {
        if (!String(error).includes("can't assign requested address")) {
          throw error;
        }
        await delay(2);
      }
    }
    if (response == null) {
      throw new Error(`request transport failed for ${this.Method} ${this.Url}`);
    }

    if (response.status >= 400) {
      throw new Error(`request failed with status ${response.status}`);
    }

    // Read to EOF so HTTP keep-alive connections are reusable.
    const bodyRaw = await response.text();

    if (destBody != null) {
      const payload = JSON.parse(bodyRaw) as Record<string, unknown>;
      Object.assign(destBody, payload);
    }
  }
}
