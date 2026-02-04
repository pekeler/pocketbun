// PocketBun-only: end-to-end smoke test for the HTTP server and Admin UI.

import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { startTestServer } from "../helpers.ts";

describe("e2e smoke", () => {
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

  it("serves the admin UI index", async () => {
    const response = await fetch(`${baseUrl}/_/`);
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain("<title>PocketBase</title>");
  });

  it("serves the health endpoint", async () => {
    const response = await fetch(`${baseUrl}/api/health`);
    const body = (await response.json()) as { code: number; message: string };

    expect(response.status).toBe(200);
    expect(body.code).toBe(200);
    expect(body.message).toBe("API is healthy.");
  });
});
