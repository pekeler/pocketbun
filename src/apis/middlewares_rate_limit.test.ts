// Ported from pocketbase/apis/middlewares_rate_limit_test.go.

import { afterAll, describe, it } from "bun:test";
import { setTimeout as delay } from "node:timers/promises";
import { RequestEvent } from "../core/event_request.ts";
import { newTestApp } from "../tests/app.ts";
import { Router } from "../tools/router/router.ts";
import { loadAuthToken, panicRecover, securityHeaders } from "./middlewares.ts";
import { rateLimit } from "./middlewares_rate_limit.ts";

describe("middlewares rate limit", () => {
  let cleanup: (() => Promise<void>) | null = null;

  afterAll(async () => {
    if (cleanup) {
      await cleanup();
    }
  });

  const setup = async () => {
    const { app, cleanup } = await newTestApp();
    // Use a 2s window to avoid second-boundary flakes on slower CI runners.
    app.settings().rateLimits.enabled = true;
    app.settings().rateLimits.rules = [
      { label: "/rate/", maxRequests: 2, duration: 2 },
      { label: "/rate/b", maxRequests: 3, duration: 2 },
      { label: "POST /rate/b", maxRequests: 1, duration: 2 },
      { label: "/rate/guest", maxRequests: 1, duration: 2, audience: "@guest" },
      { label: "/rate/auth", maxRequests: 1, duration: 2, audience: "@auth" },
    ];

    const router = new Router<RequestEvent>();
    router.Bind(panicRecover());
    router.Bind(rateLimit());
    router.Bind(loadAuthToken());
    router.Bind(securityHeaders());
    router.get("/norate", (event) => event.json(200, "norate"));
    router.get("/rate/a", (event) => event.json(200, "a"));
    router.get("/rate/b", (event) => event.json(200, "b"));
    router.get("/rate/guest", (event) => event.json(200, "guest"));
    router.get("/rate/auth", (event) => event.json(200, "auth"));

    const handler = router.buildHandler(({ request, params, remoteAddress, pattern }) => {
      return new RequestEvent({ app, request, params, remoteAddress, pattern });
    });

    return { app, cleanup, handler };
  };

  it("applies rate limits based on rules and audience", async () => {
    const setupResult = await setup();
    cleanup = setupResult.cleanup;
    const { app, handler } = setupResult;

    const scenarios = [
      { url: "/norate", wait: 0, authenticated: false, expectedStatus: 200 },
      { url: "/norate", wait: 0, authenticated: false, expectedStatus: 200 },
      { url: "/norate", wait: 0, authenticated: false, expectedStatus: 200 },
      { url: "/norate", wait: 0, authenticated: false, expectedStatus: 200 },
      { url: "/norate", wait: 0, authenticated: false, expectedStatus: 200 },
      { url: "/rate/a", wait: 0, authenticated: false, expectedStatus: 200 },
      { url: "/rate/a", wait: 0, authenticated: false, expectedStatus: 200 },
      { url: "/rate/a", wait: 0, authenticated: false, expectedStatus: 429 },
      { url: "/rate/a", wait: 0, authenticated: false, expectedStatus: 429 },
      { url: "/rate/a", wait: 2.1, authenticated: false, expectedStatus: 200 },
      { url: "/rate/a", wait: 0, authenticated: false, expectedStatus: 200 },
      { url: "/rate/a", wait: 0, authenticated: false, expectedStatus: 429 },
      { url: "/rate/b", wait: 0, authenticated: false, expectedStatus: 200 },
      { url: "/rate/b", wait: 0, authenticated: false, expectedStatus: 200 },
      { url: "/rate/b", wait: 0, authenticated: false, expectedStatus: 200 },
      { url: "/rate/b", wait: 0, authenticated: false, expectedStatus: 429 },
      { url: "/rate/b", wait: 2.1, authenticated: false, expectedStatus: 200 },
      { url: "/rate/b", wait: 0, authenticated: false, expectedStatus: 200 },
      { url: "/rate/b", wait: 0, authenticated: false, expectedStatus: 200 },
      { url: "/rate/b", wait: 0, authenticated: false, expectedStatus: 429 },
      { url: "/rate/auth", wait: 0, authenticated: false, expectedStatus: 200 },
      { url: "/rate/auth", wait: 0, authenticated: false, expectedStatus: 200 },
      { url: "/rate/auth", wait: 0, authenticated: false, expectedStatus: 429 },
      { url: "/rate/auth", wait: 0, authenticated: false, expectedStatus: 429 },
      { url: "/rate/auth", wait: 0, authenticated: true, expectedStatus: 200 },
      { url: "/rate/auth", wait: 0, authenticated: true, expectedStatus: 429 },
      { url: "/rate/auth", wait: 0, authenticated: true, expectedStatus: 429 },
      { url: "/rate/guest", wait: 0, authenticated: false, expectedStatus: 200 },
      { url: "/rate/guest", wait: 0, authenticated: false, expectedStatus: 429 },
      { url: "/rate/guest", wait: 0, authenticated: false, expectedStatus: 429 },
      { url: "/rate/guest", wait: 2.1, authenticated: true, expectedStatus: 200 },
      { url: "/rate/guest", wait: 0, authenticated: true, expectedStatus: 200 },
      { url: "/rate/guest", wait: 0, authenticated: true, expectedStatus: 429 },
      { url: "/rate/guest", wait: 0, authenticated: true, expectedStatus: 429 },
    ];

    for (const scenario of scenarios) {
      if (scenario.wait > 0) {
        await delay(scenario.wait * 1000);
      }

      const headers = new Headers();
      if (scenario.authenticated) {
        const auth = app.FindAuthRecordByEmail("users", "test@example.com");
        const token = auth.NewAuthToken();
        headers.set("Authorization", token);
      }

      const response = await handler(
        new Request(`http://localhost${scenario.url}`, {
          method: "GET",
          headers,
        }),
      );

      if (response.status !== scenario.expectedStatus) {
        throw new Error(`Expected response status ${scenario.expectedStatus}, got ${response.status}`);
      }
    }
  }, 15000);
});
