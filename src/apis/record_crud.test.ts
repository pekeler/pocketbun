// Ported from pocketbase/apis/record_crud_test.go
// Note: partial port covering basic create/update/delete scenarios.

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { startTestServer } from "../../tests/helpers.ts";

type StartedServer = Awaited<ReturnType<typeof startTestServer>>;

const regularUserToken =
  "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjRxMXhsY2xtZmxva3UzMyIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoiX3BiX3VzZXJzX2F1dGhfIiwiZXhwIjoyNTI0NjA0NDYxLCJyZWZyZXNoYWJsZSI6dHJ1ZX0.ZT3F0Z3iM-xbGgSG3LEKiEzHrPHr8t8IuHLZGGNuxLo";
const superuserToken =
  "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InN5d2JoZWNuaDQ2cmhtMCIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoicGJjXzMxNDI2MzU4MjMiLCJleHAiOjI1MjQ2MDQ0NjEsInJlZnJlc2hhYmxlIjp0cnVlfQ.UXgO3j-0BumcugrFjbd7j0M4MQvbrLggLlcu_YNGjoY";

describe("record CRUD write", () => {
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

  it("creates records (basic cases)", async () => {
    const missing = await fetch(`${baseUrl}/api/collections/missing/records`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "new" }),
    });
    expect(missing.status).toBe(404);

    const forbidden = await fetch(`${baseUrl}/api/collections/demo1/records`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "new" }),
    });
    expect(forbidden.status).toBe(403);

    const view = await fetch(`${baseUrl}/api/collections/view1/records`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "new" }),
    });
    expect(view.status).toBe(400);

    const invalid = await fetch(`${baseUrl}/api/collections/demo2/records`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{\"",
    });
    expect(invalid.status).toBe(400);

    const created = await fetch(`${baseUrl}/api/collections/demo2/records`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "new" }),
    });
    expect(created.status).toBe(200);
    const createdBody = (await created.json()) as { id?: string; title?: string };
    expect(createdBody.id).toBeTruthy();
    expect(createdBody.title).toBe("new");
  });

  it("updates records (basic cases)", async () => {
    const missing = await fetch(`${baseUrl}/api/collections/missing/records/0yxhwia2amd8gec`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "new" }),
    });
    expect(missing.status).toBe(404);

    const forbidden = await fetch(`${baseUrl}/api/collections/demo1/records/imy661ixudk5izi`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "new" }),
    });
    expect(forbidden.status).toBe(403);

    const view = await fetch(`${baseUrl}/api/collections/view1/records/imy661ixudk5izi`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "new" }),
    });
    expect(view.status).toBe(400);

    const invalid = await fetch(`${baseUrl}/api/collections/demo2/records/0yxhwia2amd8gec`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: "{\"",
    });
    expect(invalid.status).toBe(400);

    const updated = await fetch(`${baseUrl}/api/collections/demo2/records/0yxhwia2amd8gec`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(updated.status).toBe(200);
  });

  it("deletes records (basic cases)", async () => {
    const missing = await fetch(`${baseUrl}/api/collections/missing/records/0yxhwia2amd8gec`, {
      method: "DELETE",
    });
    expect(missing.status).toBe(404);

    const forbidden = await fetch(`${baseUrl}/api/collections/demo1/records/imy661ixudk5izi`, {
      method: "DELETE",
      headers: { Authorization: regularUserToken },
    });
    expect(forbidden.status).toBe(403);

    const view = await fetch(`${baseUrl}/api/collections/view1/records/imy661ixudk5izi`, {
      method: "DELETE",
    });
    expect(view.status).toBe(400);

    const deleted = await fetch(`${baseUrl}/api/collections/demo2/records/0yxhwia2amd8gec`, {
      method: "DELETE",
      headers: { Authorization: superuserToken },
    });
    expect(deleted.status).toBe(204);
  });
});
