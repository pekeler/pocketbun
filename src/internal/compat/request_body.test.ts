// PocketBun-only: regression tests for request body rebind helpers.
//
// Why this file exists:
// `src/internal/compat/request_body.ts` is a hot-path compatibility shim used
// by request parsing and auth handlers to preserve reread behavior in Bun.

import { describe, expect, it } from "bun:test";
import { readRequestBytesAndRebind, readRequestTextAndRebind } from "./request_body.ts";

describe("request body compat helpers", () => {
  describe("readRequestTextAndRebind", () => {
    it("reads text and returns a rebound request for body-capable methods", async () => {
      const request = new Request("http://localhost/example", {
        method: "POST",
        body: '{"name":"test"}',
        headers: { "content-type": "application/json" },
      });

      const bound = await readRequestTextAndRebind(request);

      expect(bound.text).toBe('{"name":"test"}');
      expect(request.bodyUsed).toBe(true);
      expect(bound.request.bodyUsed).toBe(false);
      expect(await bound.request.text()).toBe('{"name":"test"}');
    });

    it("returns the original request when there is no body", async () => {
      const request = new Request("http://localhost/example", { method: "POST" });

      const bound = await readRequestTextAndRebind(request);

      expect(bound.request).toBe(request);
      expect(bound.text).toBe("");
    });
  });

  describe("readRequestBytesAndRebind", () => {
    it("reads bytes and returns a rebound request", async () => {
      const sourceBytes = new Uint8Array([1, 2, 3, 4]);
      const request = new Request("http://localhost/example", {
        method: "POST",
        body: sourceBytes,
        headers: { "content-type": "application/octet-stream" },
      });

      const bound = await readRequestBytesAndRebind(request);

      expect(Array.from(bound.body)).toEqual([1, 2, 3, 4]);
      expect(request.bodyUsed).toBe(true);

      // Returned body bytes are intentionally copied and safe to mutate.
      bound.body[0] = 9;
      const reboundBytes = new Uint8Array(await bound.request.arrayBuffer());
      expect(Array.from(reboundBytes)).toEqual([1, 2, 3, 4]);
    });

    it("returns empty bytes and the original request when no body is present", async () => {
      const request = new Request("http://localhost/example", { method: "POST" });

      const bound = await readRequestBytesAndRebind(request);

      expect(bound.request).toBe(request);
      expect(bound.body).toEqual(new Uint8Array(0));
    });
  });
});
