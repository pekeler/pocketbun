// PocketBun-only: verifies the capped benchmark warmup used before measured upstream scenarios.

import { expect, test } from "bun:test";
import { bench, setBenchIterationLimit } from "./bench.ts";

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
