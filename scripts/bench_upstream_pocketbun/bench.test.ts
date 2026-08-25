// PocketBun-only: verifies the capped benchmark warmup used before measured upstream scenarios.

import { expect, test } from "bun:test";
import { BenchResult, bench, setBenchIterationLimit } from "./bench.ts";

test.serial("bench caps and clears the warmup iteration limit", async () => {
  let calls = 0;
  setBenchIterationLimit(2);
  try {
    await bench(
      async () => {
        calls += 1;
      },
      5,
      1,
    );
  } finally {
    setBenchIterationLimit(0);
  }
  expect(calls).toBe(2);

  await bench(
    async () => {
      calls += 1;
    },
    3,
    1,
  );
  expect(calls).toBe(5);
});

test("bench result reports worker distribution when available", () => {
  const result = new BenchResult([], 1, 2, 3, { "0": 6, "1": 4 });
  expect(result.String()).toContain("├─ Workers:   0=6 1=4");
});
