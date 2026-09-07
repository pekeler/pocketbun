// Ported from pocketbase/apis/middlewares_body_limit_test.go.

import { describe, expect, it } from "bun:test";
import { RequestEvent } from "../core/event_request.ts";
import { newTestApp } from "../tests/app.ts";
import { Router } from "../tools/router/router.ts";
import { applyBodyLimit, BodyLimit, DefaultMaxBodySize } from "./middlewares_body_limit.ts";

const scenarios = [
  { url: "/a", size: 21, expectedStatus: 200 },
  { url: "/a", size: DefaultMaxBodySize + 1, expectedStatus: 413 },
  { url: "/b", size: 20, expectedStatus: 200 },
  { url: "/b", size: 21, expectedStatus: 413 },
];

describe("middlewares body limit", () => {
  it("applies limits", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const router = new Router<RequestEvent>();
      router.Bind(BodyLimit(DefaultMaxBodySize));
      router.post("/a", (event) => event.String(200, "a"));
      router.post("/b", (event) => event.String(200, "b")).Bind(BodyLimit(20));

      const handler = router.buildHandler(({ request, params, remoteAddress, pattern }) => {
        return new RequestEvent({ app, request, params, remoteAddress, pattern });
      });

      for (const scenario of scenarios) {
        const response = await handler(
          new Request(`http://localhost${scenario.url}`, {
            method: "POST",
            body: new Uint8Array(scenario.size),
          }),
        );

        expect(response.status).toBe(scenario.expectedStatus);
      }
    } finally {
      await cleanup();
    }
  });
});

it("stops pulling oversized streams and preserves exact-limit rereads", async () => {
  const { app, cleanup } = await newTestApp();
  try {
    let pulls = 0;
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          pulls++;
          controller.enqueue(new Uint8Array(21));
        },
        cancel() {
          cancelled = true;
        },
      },
      { highWaterMark: 0 },
    );
    const event = new RequestEvent({ app, request: new Request("http://localhost/", { method: "POST", body: stream }) });
    expect((await applyBodyLimit(event, 20))?.status).toBe(413);
    expect(pulls).toBe(1);
    expect(cancelled).toBe(true);
    for (const knownLength of [false, true]) {
      for (const size of [20, 21]) {
        const body = '"' + "a".repeat(size - 2) + '"';
        const event = new RequestEvent({
          app,
          request: new Request("http://localhost/", {
            method: "POST",
            body,
            headers: { "content-type": "application/json", ...(knownLength ? { "content-length": String(size) } : {}) },
          }),
        });
        const response = await applyBodyLimit(event, 20);
        if (size > 20) {
          expect(response?.status).toBe(413);
          continue;
        }
        expect(response).toBeNull();
        expect(await event.request.text()).toBe(body);
      }
    }
    const reread = new RequestEvent({
      app,
      request: new Request("http://localhost/", {
        method: "POST",
        body: '{"a":1}',
        headers: { "content-type": "application/json" },
      }),
    });
    expect(await applyBodyLimit(reread, 7)).toBeNull();
    const first = {};
    const second = {};
    await reread.BindBody(first);
    await reread.BindBody(second);
    expect(first).toEqual({ a: 1 });
    expect(second).toEqual(first);
  } finally {
    await cleanup();
  }
});
