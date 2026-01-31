// Ported from pocketbase/tools/hook/tagged_test.go

import { describe, it } from "bun:test";
import { Event } from "./event.ts";
import { Hook } from "./hook.ts";
import { NewTaggedHook } from "./tagged.ts";

type MockTagsEvent = Event & { tags?: string[]; Tags: () => string[] };

describe("tagged hook", () => {
  it("filters handlers by tags", async () => {
    let calls = "";

    const base = new Hook<MockTagsEvent>();
    base.BindFunc(async (event) => {
      calls += "f0";
      return event.Next();
    });

    const hA = NewTaggedHook(base);
    hA.BindFunc(async (event) => {
      calls += "a1";
      return event.Next();
    });
    hA.Bind({
      Func: async (event) => {
        calls += "a2";
        return event.Next();
      },
      Priority: -1,
    });

    const hB = NewTaggedHook(base, "b1", "b2");
    hB.BindFunc(async (event) => {
      calls += "b1";
      return event.Next();
    });
    hB.Bind({
      Func: async (event) => {
        calls += "b2";
        return event.Next();
      },
      Priority: -2,
    });

    const hC = NewTaggedHook(base, "c1", "c2");
    hC.BindFunc(async (event) => {
      calls += "c1";
      return event.Next();
    });
    hC.Bind({
      Func: async (event) => {
        calls += "c2";
        return event.Next();
      },
      Priority: -3,
    });

    const scenarios: Array<{ tags?: string[]; expectedCalls: string }> = [
      { tags: undefined, expectedCalls: "a2f0a1" },
      { tags: ["missing"], expectedCalls: "a2f0a1" },
      { tags: ["b2"], expectedCalls: "b2a2f0a1b1" },
      { tags: ["c1"], expectedCalls: "c2a2f0a1c1" },
      { tags: ["b1", "c2"], expectedCalls: "c2b2a2f0a1b1c1" },
    ];

    for (const scenario of scenarios) {
      calls = "";
      const event = Object.assign(new Event(), {
        tags: scenario.tags,
        Tags() {
          return this.tags ?? [];
        },
      }) as MockTagsEvent;

      const err = await base.Trigger(event);
      if (err) {
        throw err;
      }

      if (calls !== scenario.expectedCalls) {
        throw new Error(`Expected calls sequence ${scenario.expectedCalls}, got ${calls}`);
      }
    }
  });
});
