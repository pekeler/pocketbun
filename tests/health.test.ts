import { describe, expect, it } from "bun:test";
import { BaseApp } from "../src/core/base_app.ts";
import { buildServeHandler } from "../src/apis/serve.ts";

describe("health api", () => {
  it("returns the guest health response", async () => {
    const app = new BaseApp();
    const handler = buildServeHandler(app);
    const response = await handler(new Request("http://localhost/api/health"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      code: 200,
      message: "API is healthy.",
      data: {},
    });
  });
});
