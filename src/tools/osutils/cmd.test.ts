// Ported from pocketbase/tools/osutils/cmd_test.go

import { afterEach, describe, expect, it } from "bun:test";
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

  const originalPrompt = globalThis.prompt;

  afterEach(() => {
    if (originalPrompt) {
      globalThis.prompt = originalPrompt;
      return;
    }

    Reflect.deleteProperty(globalThis, "prompt");
  });

  for (const s of scenarios) {
    const name = `${s.stdin}_${s.fallback}`;

    it(name, () => {
      const parts = s.stdin === "" ? [""] : s.stdin.split("|");
      let index = 0;
      const originalWrite = process.stderr.write.bind(process.stderr);

      globalThis.prompt = () => {
        const value = parts[index] ?? "";
        index += 1;
        return value;
      };
      process.stderr.write = (() => true) as typeof process.stderr.write;

      try {
        const result = YesNoPrompt("test", s.fallback);
        expect(result).toBe(s.expected);
      } finally {
        process.stderr.write = originalWrite;
      }
    });
  }
});
