// PocketBun-only: verifies gzip middleware behavior since upstream lacks direct tests.

import { describe, expect, it } from "bun:test";
import { gunzipSync } from "node:zlib";
import type { RequestEvent } from "../core/event_request.ts";
import { GzipWithConfig } from "./middlewares_gzip.ts";

describe("gzip middleware", () => {
  it("compresses response when client accepts gzip", async () => {
    const middleware = GzipWithConfig({});
    const event = {
      responseHeaders: new Headers(),
      request: new Request("http://127.0.0.1/test", {
        headers: { "Accept-Encoding": "gzip, deflate" },
      }),
      Next: async () => new Response("hello gzip"),
    };

    const response = await middleware.Func(event as unknown as RequestEvent);
    expect(response).toBeInstanceOf(Response);

    const responseObj = response as Response;
    expect(responseObj.headers.get("Content-Encoding")).toBe("gzip");
    const compressed = new Uint8Array(await responseObj.arrayBuffer());
    const plain = gunzipSync(compressed);
    expect(new TextDecoder().decode(plain)).toBe("hello gzip");
  });

  it("keeps small responses uncompressed when MinLength is set", async () => {
    const middleware = GzipWithConfig({ MinLength: 1024 });
    const event = {
      responseHeaders: new Headers(),
      request: new Request("http://127.0.0.1/test", {
        headers: { "Accept-Encoding": "gzip" },
      }),
      Next: async () => new Response("tiny"),
    };

    const response = await middleware.Func(event as unknown as RequestEvent);
    expect(response).toBeInstanceOf(Response);

    const responseObj = response as Response;
    expect(responseObj.headers.get("Content-Encoding")).toBeNull();
    expect(await responseObj.text()).toBe("tiny");
  });

  it("returns uncompressed response when gzip is not accepted", async () => {
    const middleware = GzipWithConfig({});
    const event = {
      responseHeaders: new Headers(),
      request: new Request("http://127.0.0.1/test", {
        headers: { "Accept-Encoding": "br" },
      }),
      Next: async () => new Response("plain"),
    };

    const response = await middleware.Func(event as unknown as RequestEvent);
    expect(response).toBeInstanceOf(Response);

    const responseObj = response as Response;
    expect(responseObj.headers.get("Content-Encoding")).toBeNull();
    expect(await responseObj.text()).toBe("plain");
  });

  it("throws on invalid compression level", () => {
    expect(() => GzipWithConfig({ Level: 10 })).toThrow("invalid gzip level");
  });
});
