import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { startTestServer } from "./helpers.ts";

describe("health api", () => {
  type StartedServer = Awaited<ReturnType<typeof startTestServer>>;
  type HealthResponse = { code: number; message: string; data: Record<string, unknown> };
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

  it("returns the guest health response", async () => {
    const response = await fetch(`${baseUrl}/api/health`);
    const body = (await response.json()) as HealthResponse;

    expect(response.status).toBe(200);
    expect(body).toEqual({
      code: 200,
      message: "API is healthy.",
      data: {},
    });
  });

  it("returns the regular user health response", async () => {
    const response = await fetch(`${baseUrl}/api/health`, {
      headers: {
        Authorization:
          "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjRxMXhsY2xtZmxva3UzMyIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoiX3BiX3VzZXJzX2F1dGhfIiwiZXhwIjoyNTI0NjA0NDYxLCJyZWZyZXNoYWJsZSI6dHJ1ZX0.ZT3F0Z3iM-xbGgSG3LEKiEzHrPHr8t8IuHLZGGNuxLo",
      },
    });
    const body = (await response.json()) as HealthResponse;

    expect(response.status).toBe(200);
    expect(body).toEqual({
      code: 200,
      message: "API is healthy.",
      data: {},
    });
  });

  it("returns the superuser health response", async () => {
    const response = await fetch(`${baseUrl}/api/health`, {
      headers: {
        Authorization:
          "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InN5d2JoZWNuaDQ2cmhtMCIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoicGJjXzMxNDI2MzU4MjMiLCJleHAiOjI1MjQ2MDQ0NjEsInJlZnJlc2hhYmxlIjp0cnVlfQ.UXgO3j-0BumcugrFjbd7j0M4MQvbrLggLlcu_YNGjoY",
      },
    });
    const body = (await response.json()) as HealthResponse;

    expect(response.status).toBe(200);
    expect(body.code).toBe(200);
    expect(body.message).toBe("API is healthy.");
    expect(body.data).toEqual(
      expect.objectContaining({
        canBackup: true,
      }),
    );
    expect(typeof body.data.realIP).toBe("string");
    expect(typeof body.data.possibleProxyHeader).toBe("string");
  });
});
