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
  });
});
