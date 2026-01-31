// PocketBun-only: Bun tests for collections list/view compatibility.

import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { startTestServer } from "./helpers.ts";

type StartedServer = Awaited<ReturnType<typeof startTestServer>>;
type ApiErrorResponse = { status: number; message: string; data: Record<string, unknown> };
type CollectionItem = { name: string };
type CollectionsListResponse = {
  page: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
  items: CollectionItem[];
};

const regularUserToken =
  "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjRxMXhsY2xtZmxva3UzMyIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoiX3BiX3VzZXJzX2F1dGhfIiwiZXhwIjoyNTI0NjA0NDYxLCJyZWZyZXNoYWJsZSI6dHJ1ZX0.ZT3F0Z3iM-xbGgSG3LEKiEzHrPHr8t8IuHLZGGNuxLo";
const superuserToken =
  "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InN5d2JoZWNuaDQ2cmhtMCIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoicGJjXzMxNDI2MzU4MjMiLCJleHAiOjI1MjQ2MDQ0NjEsInJlZnJlc2hhYmxlIjp0cnVlfQ.UXgO3j-0BumcugrFjbd7j0M4MQvbrLggLlcu_YNGjoY";

describe("collections api", () => {
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

  it("rejects unauthorized requests", async () => {
    const response = await fetch(`${baseUrl}/api/collections`);
    const body = (await response.json()) as ApiErrorResponse;

    expect(response.status).toBe(401);
    expect(body.data).toEqual({});
  });

  it("rejects regular auth records", async () => {
    const response = await fetch(`${baseUrl}/api/collections`, {
      headers: { Authorization: regularUserToken },
    });
    const body = (await response.json()) as ApiErrorResponse;

    expect(response.status).toBe(403);
    expect(body.data).toEqual({});
  });

  it("lists collections for superusers", async () => {
    const response = await fetch(`${baseUrl}/api/collections`, {
      headers: { Authorization: superuserToken },
    });
    const body = (await response.json()) as CollectionsListResponse;

    expect(response.status).toBe(200);
    expect(body.page).toBe(1);
    expect(body.perPage).toBe(30);
    expect(body.totalItems).toBeGreaterThan(0);
    expect(body.totalPages).toBeGreaterThan(0);

    const names = body.items.map((item) => item.name);
    expect(names).toContain("_superusers");
    expect(names).toContain("users");
  });

  it("filters by name contains", async () => {
    const response = await fetch(`${baseUrl}/api/collections?filter=name~'demo'`, {
      headers: { Authorization: superuserToken },
    });
    const body = (await response.json()) as CollectionsListResponse;

    expect(response.status).toBe(200);
    expect(body.items.length).toBeGreaterThan(0);
    for (const item of body.items) {
      expect(item.name.includes("demo")).toBe(true);
    }
  });

  it("rejects invalid filters", async () => {
    const response = await fetch(`${baseUrl}/api/collections?filter=invalidfield~'demo'`, {
      headers: { Authorization: superuserToken },
    });
    const body = (await response.json()) as ApiErrorResponse;

    expect(response.status).toBe(400);
    expect(body.data).toEqual({});
  });
});
