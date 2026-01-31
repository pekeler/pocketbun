// Ported from pocketbase/core/validators/string_test.go

import { describe, expect, it } from "bun:test";
import { isRegex } from "./string.ts";

describe("validators string", () => {
  it("validates regex patterns", () => {
    const scenarios: Array<{ val: string; expectError: boolean }> = [
      { val: "", expectError: false },
      { val: "abc", expectError: false },
      { val: "\\w+", expectError: false },
      { val: "\\w*((abc+", expectError: true },
    ];

    for (const scenario of scenarios) {
      const err = isRegex(scenario.val);
      expect(Boolean(err)).toBe(scenario.expectError);
    }
  });
});
