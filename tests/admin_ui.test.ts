import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { startTestServer } from "./helpers.ts";

describe("admin ui", () => {
  let server: ReturnType<typeof startTestServer>["server"];
  let baseUrl = "";
  let cleanup: (() => Promise<void>) | null = null;

  beforeAll(async () => {
    const started = await startTestServer();
    server = started.server;
    baseUrl = started.baseUrl;
    cleanup = started.cleanup;
  });

  afterAll(() => {
    server?.stop();
    return cleanup?.();
  });

  it("serves the admin index.html", async () => {
    const response = await fetch(`${baseUrl}/_/`);
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain("<title>PocketBase</title>");
  });
});
