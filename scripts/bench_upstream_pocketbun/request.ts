// Ported from vendor/pocketbase-benchmarks/benchmarks/request.go.
import type { BodyInit } from "bun";

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

    const response = await fetch(this.Url, {
      method: this.Method,
      body: this.Body,
      headers,
      signal: this.Context,
    });

    if (response.status >= 400) {
      throw new Error(`request failed with status ${response.status}`);
    }

    if (destBody != null) {
      const payload = (await response.json()) as Record<string, unknown>;
      Object.assign(destBody, payload);
    }
  }
}
