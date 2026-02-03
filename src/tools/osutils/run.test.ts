// Ported from pocketbase/tools/osutils/run_test.go

import { afterEach, describe, expect, it } from "bun:test";
import * as osutilsRun from "./run.ts";

describe("IsProbablyGoRun", () => {
  const scenarios = [
    { arg0: "", runDirs: null, expected: false },
    { arg0: "/a/b", runDirs: null, expected: false },
    { arg0: "/a/b", runDirs: [""], expected: false },
    { arg0: "/a/b", runDirs: ["/b/"], expected: false },
    { arg0: "/a/b", runDirs: ["/a/"], expected: true },
    { arg0: "/a/b", runDirs: ["", "/b/", "/a/"], expected: true },
  ];

  const originalArgs = process.argv.slice();
  const originalRunDirs = osutilsRun.runDirs.slice();

  afterEach(() => {
    process.argv = originalArgs.slice();
    osutilsRun.setRunDirsForTest(originalRunDirs.slice());
  });

  for (const [index, s] of scenarios.entries()) {
    it(`${index}_${s.arg0}`, () => {
      process.argv = [s.arg0];
      if (s.runDirs) {
        osutilsRun.setRunDirsForTest(s.runDirs);
      } else {
        osutilsRun.setRunDirsForTest([]);
      }

      const result = osutilsRun.IsProbablyGoRun();

      expect(result).toBe(s.expected);
    });
  }
});
