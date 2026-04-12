// Ported from pocketbase/tools/osutils/cmd_test.go

import { describe, expect, it, spyOn } from "bun:test";
import { YesNoPrompt } from "./cmd.ts";

describe("YesNoPrompt", () => {
  const scenarios = [
    { stdin: "", fallback: false, expected: false },
    { stdin: "", fallback: true, expected: true },

    // yes
    { stdin: "y", fallback: false, expected: true },
    { stdin: "Y", fallback: false, expected: true },
    { stdin: "Yes", fallback: false, expected: true },
    { stdin: "yes", fallback: false, expected: true },

    // no
    { stdin: "n", fallback: true, expected: false },
    { stdin: "N", fallback: true, expected: false },
    { stdin: "No", fallback: true, expected: false },
    { stdin: "no", fallback: true, expected: false },

    // invalid -> no/yes
    { stdin: "invalid|no", fallback: true, expected: false },
    { stdin: "invalid|yes", fallback: false, expected: true },
  ];

  for (const s of scenarios) {
    const name = `${s.stdin}_${s.fallback}`;

    it.serial(name, () => {
      const parts = s.stdin === "" ? [""] : s.stdin.split("|");
      let index = 0;
      using _promptSpy = spyOn(globalThis, "prompt").mockImplementation(() => {
        const value = parts[index] ?? "";
        index += 1;
        return value;
      }) as unknown as { [Symbol.dispose](): void };
      using _stderrWriteSpy = spyOn(process.stderr, "write").mockImplementation(
        (() => true) as typeof process.stderr.write,
      ) as unknown as {
        [Symbol.dispose](): void;
      };

      const result = YesNoPrompt("test", s.fallback);
      expect(result).toBe(s.expected);
    });
  }
});
