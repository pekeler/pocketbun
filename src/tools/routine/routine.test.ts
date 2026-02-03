// Ported from pocketbase/tools/routine/routine_test.go

import { describe, expect, it } from "bun:test";
import { FireAndForget } from "./routine.ts";

describe("FireAndForget", () => {
  it("executes and recovers", async () => {
    let called = false;

    FireAndForget(() => {
      called = true;
      throw new Error("test");
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(called).toBe(true);
  });
});
