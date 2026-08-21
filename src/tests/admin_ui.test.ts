// PocketBun-only: Bun test for Admin UI static serving.

import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { startTestServer } from "./helpers.ts";

describe("admin ui", () => {
  type StartedServer = Awaited<ReturnType<typeof startTestServer>>;
  let server: StartedServer["server"];
  let baseUrl = "";
  let cleanup: StartedServer["cleanup"] | null = null;

  beforeAll(async () => {
    const started = await startTestServer();
    server = started.server;
    baseUrl = started.baseUrl;
    cleanup = started.cleanup;
  });

  afterAll(async () => {
    await server?.stop();
    return cleanup?.();
  });

  it("serves the admin index.html", async () => {
    const response = await fetch(`${baseUrl}/_/`);
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain("<title>PocketBase</title>");
    expect(body).toContain("/_/pocketbun-branding.js");
    expect(response.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
  });

  it("serves the injected admin branding script", async () => {
    const response = await fetch(`${baseUrl}/_/pocketbun-branding.js`);
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/javascript");
    expect(response.headers.get("cache-control")).toBe("max-age=300, stale-while-revalidate=86400");
    expect(response.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    expect(body).toContain("PocketBun backend");
    expect(body).toContain("https://github.com/pekeler/pocketbun");
  });

  it("serves Admin UI assets with caching, security policy, and native ranges", async () => {
    const url = `${baseUrl}/_/images/favicon_prod.png`;
    const response = await fetch(url);
    const body = await response.bytes();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toBe("max-age=1209600, stale-while-revalidate=86400");
    expect(response.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    expect(body.length).toBeGreaterThan(0);

    const rangeResponse = await fetch(url, { headers: { "Accept-Encoding": "identity", Range: "bytes=0-3" } });
    expect(rangeResponse.status).toBe(206);
    expect(rangeResponse.headers.get("content-range")).toBe(`bytes 0-3/${body.length}`);
    expect((await rangeResponse.bytes()).length).toBe(4);
  });
});
