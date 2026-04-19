// Ported from pocketbase/apis/record_auth_methods_test.go.

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { runApiScenario } from "../tests/api.ts";
import { startTestServer } from "../tests/helpers.ts";

type StartedServer = Awaited<ReturnType<typeof startTestServer>>;

describe("record auth methods", () => {
  let server: StartedServer["server"];
  let baseUrl = "";
  let cleanup: StartedServer["cleanup"] | null = null;

  beforeEach(async () => {
    const started = await startTestServer();
    server = started.server;
    baseUrl = started.baseUrl;
    cleanup = started.cleanup;
  });

  afterEach(async () => {
    await server?.stop();
    return cleanup?.();
  });

  it.serial("returns 404 for missing collection", async () => {
    const res = await fetch(`${baseUrl}/api/collections/missing/auth-methods`);
    expect(res.status).toBe(404);
    const body = (await res.json()) as { data?: unknown };
    expect(body.data).toEqual({});
  });

  it.serial("returns 404 for non-auth collection", async () => {
    const res = await fetch(`${baseUrl}/api/collections/demo1/auth-methods`);
    expect(res.status).toBe(404);
    const body = (await res.json()) as { data?: unknown };
    expect(body.data).toEqual({});
  });

  it.serial("returns empty auth methods for nologin collection", async () => {
    const res = await fetch(`${baseUrl}/api/collections/nologin/auth-methods`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.password.enabled).toBe(false);
    expect(body.password.identityFields).toEqual([]);
    expect(body.oauth2.enabled).toBe(false);
    expect(body.oauth2.providers).toEqual([]);
    expect(body.mfa.enabled).toBe(false);
    expect(body.mfa.duration).toBe(0);
    expect(body.otp.enabled).toBe(false);
    expect(body.otp.duration).toBe(0);
    expect(body.emailPassword).toBe(false);
    expect(body.usernamePassword).toBe(false);
  });

  it.serial("returns auth methods for users collection", async () => {
    const res = await fetch(`${baseUrl}/api/collections/users/auth-methods`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;

    expect(body.password.enabled).toBe(true);
    expect(body.password.identityFields).toEqual(["email", "username"]);

    expect(body.mfa.enabled).toBe(true);
    expect(body.mfa.duration).toBe(1800);
    expect(body.otp.enabled).toBe(true);
    expect(body.otp.duration).toBe(300);

    expect(body.oauth2.enabled).toBe(true);
    expect(Array.isArray(body.oauth2.providers)).toBe(true);
    expect(body.oauth2.providers.length).toBeGreaterThan(0);

    const providerNames = body.oauth2.providers.map((provider: any) => provider.name);
    expect(providerNames.includes("google")).toBe(true);
    expect(providerNames.includes("gitlab")).toBe(true);

    for (const provider of body.oauth2.providers) {
      expect(typeof provider.name).toBe("string");
      expect(typeof provider.displayName).toBe("string");
      expect(typeof provider.logo).toBe("string");
      expect(typeof provider.state).toBe("string");
      expect(typeof provider.codeVerifier).toBe("string");
      expect(typeof provider.codeChallenge).toBe("string");
      expect(typeof provider.codeChallengeMethod).toBe("string");
      expect(typeof provider.authURL).toBe("string");
      expect(typeof provider.authUrl).toBe("string");
      expect(provider.authURL.endsWith("redirect_uri=")).toBe(true);
    }

    expect(body.authProviders.length).toBe(body.oauth2.providers.length);
    expect(body.oauth2.providers.some((provider: any) => provider.logo.startsWith("<svg"))).toBeTrue();
    expect(body.authProviders.every((provider: any) => provider.logo === "")).toBeTrue();
    expect(body.emailPassword).toBe(true);
    expect(body.usernamePassword).toBe(true);
  });
});

describe("record auth methods rate limit", () => {
  it.serial("RateLimit rule - nologin:listAuthMethods", async () => {
    await runApiScenario({
      method: "GET",
      url: "/api/collections/nologin/auth-methods",
      beforeTest: (app) => {
        app.settings().rateLimits.enabled = true;
        app.settings().rateLimits.rules = [
          { maxRequests: 100, label: "abc", duration: 1 },
          { maxRequests: 100, label: "*:listAuthMethods", duration: 1 },
          { maxRequests: 0, label: "nologin:listAuthMethods", duration: 1 },
        ];
      },
      expectedStatus: 429,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    });
  });

  it.serial("RateLimit rule - *:listAuthMethods", async () => {
    await runApiScenario({
      method: "GET",
      url: "/api/collections/nologin/auth-methods",
      beforeTest: (app) => {
        app.settings().rateLimits.enabled = true;
        app.settings().rateLimits.rules = [
          { maxRequests: 100, label: "abc", duration: 1 },
          { maxRequests: 0, label: "*:listAuthMethods", duration: 1 },
        ];
      },
      expectedStatus: 429,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    });
  });
});
