// Ported from pocketbase/tools/routine/routine_test.go

import { describe, expect, it, spyOn } from "bun:test";
import { FireAndForget } from "./routine.ts";

describe("FireAndForget", () => {
  it.serial("executes and recovers with a capped stack trace", async () => {
    let called = false;
    const warnings: unknown[][] = [];
    const error = new Error("test");
    error.stack = "x".repeat(3000);
    using _warnSpy = spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
      warnings.push(args);
    }) as unknown as { [Symbol.dispose](): void };

    FireAndForget(() => {
      called = true;
      throw error;
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(called).toBe(true);
    expect(warnings).toHaveLength(2);
    expect(warnings[0]?.[0]).toBe("RECOVERED FROM PANIC (safe to ignore):");
    expect(warnings[0]?.[1]).toBe(error);
    expect(warnings[1]?.[0]).toBe("x".repeat(2048));
  });
});
