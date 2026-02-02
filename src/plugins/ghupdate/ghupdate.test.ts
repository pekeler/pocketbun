// Ported from pocketbase/plugins/ghupdate/ghupdate_test.go

import { describe, it } from "bun:test";
import { compareVersions } from "./ghupdate.ts";

describe("ghupdate compareVersions", () => {
  it("matches upstream comparisons", () => {
    const scenarios: Array<{ a: string; b: string; expected: number }> = [
      { a: "", b: "", expected: 0 },
      { a: "0", b: "", expected: 0 },
      { a: "1", b: "1.0.0", expected: 0 },
      { a: "1.1", b: "1.1.0", expected: 0 },
      { a: "1.1", b: "1.1.1", expected: 1 },
      { a: "1.1", b: "1.0.1", expected: -1 },
      { a: "1.0", b: "1.0.1", expected: 1 },
      { a: "1.10", b: "1.9", expected: -1 },
      { a: "1.2", b: "1.12", expected: 1 },
      { a: "3.2", b: "1.6", expected: -1 },
      { a: "0.0.2", b: "0.0.1", expected: -1 },
      { a: "0.16.2", b: "0.17.0", expected: 1 },
      { a: "1.15.0", b: "0.16.1", expected: -1 },
      { a: "1.2.9", b: "1.2.10", expected: 1 },
      { a: "3.2", b: "4.0", expected: 1 },
      { a: "3.2.4", b: "3.2.3", expected: -1 },
    ];

    for (const scenario of scenarios) {
      const result = compareVersions(scenario.a, scenario.b);
      if (result !== scenario.expected) {
        throw new Error(
          `Expected ${JSON.stringify(scenario.a)} vs ${JSON.stringify(scenario.b)} to result in ${scenario.expected}, got ${result}`,
        );
      }
    }
  });
});
