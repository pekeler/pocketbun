// Ported from pocketbase/core/db_retry_test.go.

import { describe, expect, it } from "bun:test";
import { baseLockRetry, getDefaultRetryInterval } from "./db_retry.ts";

describe("db retry", () => {
  it("GetDefaultRetryInterval", () => {
    expect(getDefaultRetryInterval(-1)).toBe(1000);
    expect(getDefaultRetryInterval(999)).toBe(1000);
    expect(getDefaultRetryInterval(3)).toBe(200);
  });

  it("BaseLockRetry", async () => {
    const scenarios = [
      { err: null, failUntilAttempt: 3, expectedAttempts: 1 },
      { err: new Error("test"), failUntilAttempt: 3, expectedAttempts: 1 },
      { err: new Error("database is locked"), failUntilAttempt: 3, expectedAttempts: 3 },
      { err: new Error("table is locked"), failUntilAttempt: 3, expectedAttempts: 3 },
    ];

    for (const scenario of scenarios) {
      let lastAttempt = 0;

      const err = await baseLockRetry((attempt) => {
        lastAttempt = attempt;

        if (attempt < scenario.failUntilAttempt) {
          return scenario.err;
        }

        return null;
      }, scenario.failUntilAttempt + 2);

      expect(lastAttempt).toBe(scenario.expectedAttempts);

      if (scenario.failUntilAttempt === scenario.expectedAttempts) {
        expect(err).toBeNull();
      } else if (scenario.err) {
        expect(err).not.toBeNull();
      }
    }
  });
});
