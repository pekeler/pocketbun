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
  });

  it("serves the injected admin branding script", async () => {
    const response = await fetch(`${baseUrl}/_/pocketbun-branding.js`);
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/javascript");
    expect(body).toContain("PocketBun backend");
    expect(body).toContain("https://github.com/pekeler/pocketbun");
  });
});
