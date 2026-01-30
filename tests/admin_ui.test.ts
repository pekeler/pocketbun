import { describe, expect, it } from "bun:test";
import { BaseApp } from "../src/core/base_app.ts";
import { buildServeHandler } from "../src/apis/serve.ts";

describe("admin ui", () => {
  it("serves the admin index.html", async () => {
    const app = new BaseApp();
    const handler = buildServeHandler(app);
    const response = await handler(new Request("http://localhost/_/"));
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain("<title>PocketBase</title>");
  });
});
