// Ported from pocketbase/core/validators/validators_test.go

import { describe, expect, it } from "bun:test";
import { ValidationErrors } from "../src/internal/compat/validation.ts";
import { joinValidationErrors } from "../src/core/validators/validators.ts";

function formatError(err: Error | null): string {
  if (!err) {
    return "<nil>";
  }
  return err.message ?? String(err);
}

describe("validators", () => {
  it("joins validation errors", () => {
    const scenarios: Array<{
      errA: Error | null;
      errB: Error | null;
      expected: string;
    }> = [
      { errA: null, errB: null, expected: "<nil>" },
      { errA: new Error("abc"), errB: null, expected: "abc" },
      { errA: null, errB: new Error("abc"), expected: "abc" },
      { errA: new Error("abc"), errB: new Error("456"), expected: "abc\n456" },
      {
        errA: new ValidationErrors({ test1: new Error("test1_err") }),
        errB: null,
        expected: "test1: test1_err.",
      },
      {
        errA: null,
        errB: new ValidationErrors({ test2: new Error("test2_err") }),
        expected: "test2: test2_err.",
      },
      {
        errA: new ValidationErrors({}),
        errB: new Error("456"),
        expected: "\n456",
      },
      {
        errA: new Error("456"),
        errB: new ValidationErrors({}),
        expected: "456\n",
      },
      {
        errA: new ValidationErrors({ test1: new Error("test1_err") }),
        errB: new Error("456"),
        expected: "test1: test1_err.",
      },
      {
        errA: new Error("456"),
        errB: new ValidationErrors({ test2: new Error("test2_err") }),
        expected: "test2: test2_err.",
      },
      {
        errA: new ValidationErrors({ test1: new Error("test1_err") }),
        errB: new ValidationErrors({ test2: new Error("test2_err") }),
        expected: "test1: test1_err; test2: test2_err.",
      },
    ];

    for (const scenario of scenarios) {
      const result = joinValidationErrors(scenario.errA, scenario.errB);
      expect(formatError(result)).toBe(scenario.expected);
    }
  });
});
