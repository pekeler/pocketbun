// PocketBun-only: verifies documented automatic HTTPS serve differences.

import { describe, expect, it } from "bun:test";
import type { App } from "../core/app.ts";
import { serve, serveAsync } from "./serve.ts";

describe("serve HTTPS config", () => {
  it("rejects unsupported sync automatic HTTPS config before starting a server", () => {
    expect(() => serve({} as App, { httpsAddr: "0.0.0.0:443" })).toThrow("does not support PocketBase's automatic HTTPS");
  });

  it("rejects unsupported async certificate domain config before starting a server", async () => {
    const result = await tryCall(() => serveAsync({} as App, { certificateDomains: ["example.com"] }));

    expect(result.error).toBeInstanceOf(Error);
    expect((result.error as Error).message).toContain("does not support PocketBase's automatic HTTPS");
  });
});

async function tryCall<T>(fn: () => Promise<T> | T): Promise<{ value: T | null; error: unknown }> {
  try {
    return { value: await fn(), error: null };
  } catch (error) {
    return { value: null, error };
  }
}
