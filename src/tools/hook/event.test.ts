// Ported from pocketbase/tools/hook/event_test.go

import { describe, it } from "bun:test";
import { Event } from "./event.ts";

describe("hook event", () => {
  it("Next", async () => {
    let calls = 0;

    const event = new Event();

    if (event.nextFunc() !== null) {
      throw new Error("Expected nextFunc to be null");
    }

    event.setNextFunc(async () => {
      calls += 1;
      return null;
    });

    if (event.nextFunc() === null) {
      throw new Error("Expected nextFunc to be non-null");
    }

    await event.Next();
    await event.Next();

    if (calls !== 2) {
      throw new Error(`Expected 2 calls, got ${calls}`);
    }
  });
});
