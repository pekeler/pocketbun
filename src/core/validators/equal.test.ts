// Ported from pocketbase/core/validators/equal_test.go

import { describe, expect, it } from "bun:test";
import { Equal } from "./equal.ts";

describe("validators equal", () => {
  it("compares values", () => {
    const strA = "abc";
    const strB = "abc";
    const strC = "123";
    const strNilPtr: string | null = null;
    const strNilPtr2: string | null = null;

    const strPtrA = new String(strA);
    const strPtrB = new String(strB);
    const strPtrC = new String(strC);

    const scenarios: Array<{ valA: unknown; valB: unknown; expectError: boolean }> = [
      { valA: null, valB: null, expectError: false },
      { valA: "", valB: "", expectError: false },
      { valA: "", valB: "456", expectError: true },
      { valA: "123", valB: "", expectError: true },
      { valA: "123", valB: "456", expectError: true },
      { valA: "123", valB: "123", expectError: false },
      { valA: true, valB: false, expectError: true },
      { valA: false, valB: true, expectError: true },
      { valA: false, valB: false, expectError: false },
      { valA: true, valB: true, expectError: false },
      { valA: 0, valB: 0, expectError: false },
      { valA: 0, valB: 1, expectError: true },
      { valA: 1, valB: 2, expectError: true },
      { valA: 1, valB: 1, expectError: false },
      { valA: strPtrA, valB: strPtrA, expectError: false },
      { valA: strPtrA, valB: strPtrB, expectError: false },
      { valA: strPtrA, valB: strPtrC, expectError: true },
      { valA: "abc", valB: strPtrA, expectError: false },
      { valA: strPtrA, valB: "abc", expectError: false },
      { valA: "abc", valB: strPtrC, expectError: true },
      { valA: "test", valB: 123, expectError: true },
      { valA: null, valB: 123, expectError: true },
      { valA: null, valB: strA, expectError: true },
      { valA: null, valB: strPtrA, expectError: true },
      { valA: null, valB: strNilPtr, expectError: false },
      { valA: strNilPtr, valB: strNilPtr2, expectError: false },
    ];

    for (const [index, scenario] of scenarios.entries()) {
      const err = Equal(scenario.valA)(scenario.valB);
      const hasErr = err !== null;
      expect(hasErr, `scenario ${index}`).toBe(scenario.expectError);
    }
  });
});
