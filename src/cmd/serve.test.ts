// PocketBun-only: verifies documented serve command differences from PocketBase.

import { describe, expect, it } from "bun:test";
import type { App } from "../core/app.ts";
import { NewServeCommand } from "./serve.ts";

describe("serve command", () => {
  it("rejects PocketBase automatic HTTPS domain arguments", async () => {
    const command = NewServeCommand({} as App, false);

    const err = await command.Execute(["example.com"]);

    expect(err).toBeInstanceOf(Error);
    expect(err?.message).toContain("does not support PocketBase's automatic HTTPS");
    expect(err?.message).toContain("reverse proxy");
  });

  it("rejects the unsupported --https flag", async () => {
    const command = NewServeCommand({} as App, false);

    const err = await command.Execute(["--https", "0.0.0.0:443"]);

    expect(err).toBeInstanceOf(Error);
    expect(err?.message).toContain("does not support PocketBase's automatic HTTPS");
    expect(err?.message).toContain("pocketbun serve --http 127.0.0.1:8090");
  });
});
