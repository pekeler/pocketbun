// Ported from pocketbase/core/validators/string_test.go

import { describe, expect, it } from "bun:test";
import { IPOrSubnet, isRegex } from "./string.ts";

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

  it("IPOrSubnet", () => {
    const scenarios: Array<{ val: string; expectError: boolean }> = [
      { val: "", expectError: false },
      { val: "invalid", expectError: true },
      { val: "127.0", expectError: true },
      { val: "127.0.0.1", expectError: false },
      { val: "::1", expectError: false },
      { val: "0000:0000:0000:0000:0000:0000:0000:0001", expectError: false },
      { val: "127.0.0.1/24", expectError: false },
      { val: "::/128", expectError: false },
    ];

    for (const scenario of scenarios) {
      const err = IPOrSubnet(scenario.val);
      expect(Boolean(err)).toBe(scenario.expectError);
    }
  });
});
