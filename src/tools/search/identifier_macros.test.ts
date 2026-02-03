// Ported from pocketbase/tools/search/identifier_macros_test.go.

import { describe, expect, it } from "bun:test";
import { resolveIdentifierMacro } from "./identifier_macros.ts";

describe("identifier macros", () => {
  it("resolves known macros", () => {
    const now = new Date(Date.UTC(2023, 1, 3, 4, 5, 6, 0));
    const scenarios: Record<string, unknown> = {
      "@now": "2023-02-03 04:05:06.000Z",
      "@yesterday": "2023-02-02 04:05:06.000Z",
      "@tomorrow": "2023-02-04 04:05:06.000Z",
      "@second": 6,
      "@minute": 5,
      "@hour": 4,
      "@day": 3,
      "@month": 2,
      "@weekday": 5,
      "@year": 2023,
      "@todayStart": "2023-02-03 00:00:00.000Z",
      "@todayEnd": "2023-02-03 23:59:59.999Z",
      "@monthStart": "2023-02-01 00:00:00.000Z",
      "@monthEnd": "2023-02-28 23:59:59.999Z",
      "@yearStart": "2023-01-01 00:00:00.000Z",
      "@yearEnd": "2023-12-31 23:59:59.999Z",
    };

    for (const [key, expected] of Object.entries(scenarios)) {
      const result = resolveIdentifierMacro(key, now);
      expect(result).toBe(expected);
    }
  });

  it("returns undefined for unknown macros", () => {
    const result = resolveIdentifierMacro("@unknown", new Date());
    expect(result).toBeUndefined();
  });
});
