import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { startTestServer } from "./helpers.ts";

describe("health api", () => {
  let server: ReturnType<typeof startTestServer>["server"];
  let baseUrl = "";

  beforeAll(async () => {
    const started = await startTestServer();
    server = started.server;
    baseUrl = started.baseUrl;
  });

  afterAll(() => {
    server?.stop();
  });

  it("returns the guest health response", async () => {
    const response = await fetch(`${baseUrl}/api/health`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      code: 200,
      message: "API is healthy.",
      data: {},
    });
  });
});
