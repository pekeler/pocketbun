// Ported from pocketbase/tools/hook/event_test.go

import { describe, expect, it } from "bun:test";
import { Event } from "./event.ts";
import { Hook } from "./hook.ts";

describe("hook event", () => {
  it("shares extra between handlers with both public casings and isolates events", () => {
    const event = new Event();
    const hook = new Hook<Event>();
    expect(event.extra).toBeNull();
    hook.bindFunc((e) => {
      e.extra = { value: 1 };
      e.next();
      expect(e.extra.value).toBe(2);
    });
    hook.bindFunc((e) => {
      expect(e.Extra).toBe(e.extra);
      e.Extra!.value = 2;
      return e.next();
    });
    hook.trigger(event);
    expect(new Event().extra).toBeNull();
    event.Extra = { replacement: true };
    expect(event.extra).toEqual({ replacement: true });
  });

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
