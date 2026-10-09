// Ported from pocketbase/tools/routine/routine_test.go

import { describe, expect, it, spyOn } from "bun:test";
import { FireAndForget, SafeWrap } from "./routine.ts";

describe("FireAndForget", () => {
  it.serial("executes and recovers with a capped stack trace", async () => {
    let called = false;
    const warnings: unknown[][] = [];
    const error = new Error("test");
    error.stack = "x".repeat(3000);
    using _warnSpy = spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
      warnings.push(args);
    });

    FireAndForget(() => {
      called = true;
      throw error;
    });

    // FireAndForget schedules work via queueMicrotask(), so draining one
    // microtask turn is enough and avoids a real timer delay in the test.
    await Promise.resolve();

    expect(called).toBe(true);
    expect(warnings).toHaveLength(2);
    expect(warnings[0]?.[0]).toBe("RECOVERED FROM PANIC (safe to ignore):");
    expect(warnings[0]?.[1]).toBe(error);
    expect(warnings[1]?.[0]).toBe("x".repeat(2048));
  });

  it.serial("recovers rejected promises without an unhandled rejection", async () => {
    const warnings: unknown[][] = [];
    const unhandled: unknown[] = [];
    const error = new Error("test_recover");
    using _warnSpy = spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
      warnings.push(args);
    });
    const onUnhandled = (reason: unknown) => {
      unhandled.push(reason);
    };
    process.on("unhandledRejection", onUnhandled);

    try {
      FireAndForget(async () => {
        throw error;
      });

      await Promise.resolve();
      await Promise.resolve();

      expect(warnings[0]?.[0]).toBe("RECOVERED FROM PANIC (safe to ignore):");
      expect(warnings[0]?.[1]).toBe(error);
      expect(unhandled).toHaveLength(0);
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
  });
});

describe("SafeWrap", () => {
  it("converts a panic to an error with its capped stack", () => {
    let called = false;
    const error = new Error("test_recover");
    error.stack = "x".repeat(3000);
    const result = SafeWrap(() => {
      called = true;
      throw error;
    })();
    expect(called).toBe(true);
    expect(result?.message).toBe(`[SafeWrap] recovered from panic: Error: test_recover\n${"x".repeat(2048)}`);
  });

  it("preserves regular errors and successful results", () => {
    const error = new Error("test_error");
    expect(SafeWrap(() => error)()).toBe(error);
    expect(SafeWrap(() => null)()).toBeNull();
  });

  it("caps multibyte stacks at 2 KB and handles non-Error throws", () => {
    const error = new Error("unicode");
    error.stack = "€".repeat(2000);
    const result = SafeWrap(() => {
      throw error;
    })();
    expect(new TextEncoder().encode(result!.message.split("\n")[1]).length).toBeLessThanOrEqual(2048);
    expect(result!.message).not.toContain("�");
    expect(
      SafeWrap(() => {
        throw "string panic";
      })()?.message,
    ).toContain("string panic");
  });
});
