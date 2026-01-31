// PocketBun-only: Bun tests for records list/view compatibility.

import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { startTestServer } from "./helpers.ts";

type StartedServer = Awaited<ReturnType<typeof startTestServer>>;

type ApiErrorResponse = { status: number; message: string; data: Record<string, unknown> };

type RecordItem = {
  id: string;
  collectionId?: string;
  collectionName?: string;
  password?: string;
  tokenKey?: string;
};

type RecordsListResponse = {
  page: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
  items: RecordItem[];
};

const regularUserToken =
  "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjRxMXhsY2xtZmxva3UzMyIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoiX3BiX3VzZXJzX2F1dGhfIiwiZXhwIjoyNTI0NjA0NDYxLCJyZWZyZXNoYWJsZSI6dHJ1ZX0.ZT3F0Z3iM-xbGgSG3LEKiEzHrPHr8t8IuHLZGGNuxLo";
const superuserToken =
  "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InN5d2JoZWNuaDQ2cmhtMCIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoicGJjXzMxNDI2MzU4MjMiLCJleHAiOjI1MjQ2MDQ0NjEsInJlZnJlc2hhYmxlIjp0cnVlfQ.UXgO3j-0BumcugrFjbd7j0M4MQvbrLggLlcu_YNGjoY";

describe("records api", () => {
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
    const response = await fetch(`${baseUrl}/api/collections/_superusers/records`);
    const body = (await response.json()) as ApiErrorResponse;

    expect(response.status).toBe(403);
    expect(body.data).toEqual({});
  });

  it("rejects regular auth records", async () => {
    const response = await fetch(`${baseUrl}/api/collections/_superusers/records`, {
      headers: { Authorization: regularUserToken },
    });
    const body = (await response.json()) as ApiErrorResponse;

    expect(response.status).toBe(403);
    expect(body.data).toEqual({});
  });

  it("lists records for superusers", async () => {
    const response = await fetch(`${baseUrl}/api/collections/_superusers/records`, {
      headers: { Authorization: superuserToken },
    });
    const body = (await response.json()) as RecordsListResponse;

    expect(response.status).toBe(200);
    expect(body.page).toBe(1);
    expect(body.perPage).toBe(30);
    expect(body.totalItems).toBeGreaterThan(0);
    expect(body.totalPages).toBeGreaterThan(0);
    expect(body.items.length).toBeGreaterThan(0);

    const item = body.items[0];
    expect(item?.id).toBeTruthy();
    expect(item?.collectionId).toBeTruthy();
    expect(item?.collectionName).toBe("_superusers");
    expect(item?.password).toBeUndefined();
    expect(item?.tokenKey).toBeUndefined();
  });

  it("returns record details for superusers", async () => {
    const listResponse = await fetch(`${baseUrl}/api/collections/_superusers/records`, {
      headers: { Authorization: superuserToken },
    });
    const listBody = (await listResponse.json()) as RecordsListResponse;
    const recordId = listBody.items[0]?.id ?? "";

    const response = await fetch(`${baseUrl}/api/collections/_superusers/records/${recordId}`, {
      headers: { Authorization: superuserToken },
    });
    const body = (await response.json()) as RecordItem;

    expect(response.status).toBe(200);
    expect(body.id).toBe(recordId);
    expect(body.collectionId).toBeTruthy();
    expect(body.collectionName).toBe("_superusers");
    expect(body.password).toBeUndefined();
    expect(body.tokenKey).toBeUndefined();
  });

  it("applies list rules for regular auth users", async () => {
    const response = await fetch(`${baseUrl}/api/collections/demo3/records`, {
      headers: { Authorization: regularUserToken },
    });
    const body = (await response.json()) as RecordsListResponse;

    expect(response.status).toBe(200);
    expect(body.totalItems).toBe(0);
    expect(body.items.length).toBe(0);
  });

  it("allows regular auth users to view their own record via view rule", async () => {
    const response = await fetch(`${baseUrl}/api/collections/users/records/4q1xlclmfloku33`, {
      headers: { Authorization: regularUserToken },
    });
    const body = (await response.json()) as RecordItem;

    expect(response.status).toBe(200);
    expect(body.id).toBe("4q1xlclmfloku33");
    expect(body.collectionName).toBe("users");
    expect(body.password).toBeUndefined();
    expect(body.tokenKey).toBeUndefined();
  });

  it("denies regular auth users from viewing other records via view rule", async () => {
    const response = await fetch(`${baseUrl}/api/collections/users/records/bgs820n361vj1qd`, {
      headers: { Authorization: regularUserToken },
    });
    const body = (await response.json()) as ApiErrorResponse;

    expect(response.status).toBe(404);
    expect(body.data).toEqual({});
  });
});
