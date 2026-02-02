// Ported from pocketbase/apis/middlewares_body_limit_test.go.

import { describe, expect, it } from "bun:test";
import { RequestEvent } from "../core/event_request.ts";
import { newTestApp } from "../tests/app.ts";
import { Router } from "../tools/router/router.ts";
import { BodyLimit, DefaultMaxBodySize } from "./middlewares_body_limit.ts";

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
