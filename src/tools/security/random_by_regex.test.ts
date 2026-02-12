// Ported from pocketbase/tools/security/random_by_regex_test.go

import { describe, it } from "bun:test";
import { randomStringByRegex } from "./random.ts";

describe("security random by regex", () => {
  it("RandomStringByRegex", () => {
    const generated: string[] = [];
    const posixFlag = 1;

    const scenarios: Array<{
      pattern: string;
      flags?: number[];
      expectError: boolean;
    }> = [
      { pattern: "", expectError: true },
      { pattern: "test", expectError: false },
      { pattern: "\\d+", flags: [posixFlag], expectError: true },
      { pattern: "\\d+", expectError: false },
      { pattern: "\\d*", expectError: false },
      { pattern: "\\d{1,20}", expectError: false },
      { pattern: "\\d{5}", expectError: false },
      { pattern: "\\d{0,}-abc", expectError: false },
      { pattern: "[a-zA-Z_]*", expectError: false },
      { pattern: "[^a-zA-Z]{5,30}", expectError: false },
      { pattern: "\\w+_abc", expectError: false },
      { pattern: "\\W{6}", expectError: false },
      { pattern: "\\D{6}", expectError: false },
      { pattern: "\\S{6}", expectError: false },
      { pattern: "(?:ab|cd){3}", expectError: false },
      { pattern: "\\d+\\.\\d+", expectError: false },
      { pattern: "[a-z\\d]{12}", expectError: false },
      { pattern: "[2-9]{10}-\\w+", expectError: false },
      { pattern: "(a|b|c)", expectError: false },
    ];

    for (const scenario of scenarios) {
      const run = (attempt: number): void => {
        let value = "";
        let error: unknown = null;
        try {
          value = randomStringByRegex(scenario.pattern, ...(scenario.flags ?? []));
        } catch (err) {
          error = err;
        }

        const hasError = error != null;
        if (hasError !== scenario.expectError) {
          throw new Error(`Expected hasError ${scenario.expectError}, got ${hasError} (${String(error)})`);
        }

        if (hasError) {
          return;
        }

        const regex = new RegExp(scenario.pattern);
        if (!regex.test(value)) {
          throw new Error(`Expected ${value} to match pattern ${scenario.pattern}`);
        }

        if (generated.includes(value)) {
          if (attempt > 3) {
            throw new Error(`The generated string ${value} already exists in ${generated.join(", ")}`);
          }
          run(attempt + 1);
          return;
        }

        generated.push(value);
      };

      run(1);
    }
  });
});
