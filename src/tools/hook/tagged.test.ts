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

  it("lowercase aliases", async () => {
    let calls = "";
    const base = new Hook<MockTagsEvent>();
    const tagged = NewTaggedHook(base, "a");

    if (!tagged.canTriggerOn(["a"])) {
      throw new Error("Expected canTriggerOn to match tag");
    }

    const firstId = tagged.bind({
      Func: async (event) => {
        calls += "1";
        return event.Next();
      },
    });
    tagged.bindFunc(async (event) => {
      calls += "2";
      return event.Next();
    });

    if (tagged.length() !== 2) {
      throw new Error(`Expected 2 handlers, got ${tagged.length()}`);
    }

    const event = Object.assign(new Event(), {
      tags: ["a"],
      Tags() {
        return this.tags ?? [];
      },
    }) as MockTagsEvent;

    const result = await tagged.trigger(event, async (_event) => {
      calls += "3";
      return null;
    });

    if (result !== null) {
      throw new Error("Expected null result");
    }

    if (calls !== "123") {
      throw new Error(`Expected calls sequence 123, got ${calls}`);
    }

    tagged.unbind(firstId);
    if (tagged.length() !== 1) {
      throw new Error(`Expected 1 handler, got ${tagged.length()}`);
    }

    tagged.unbindAll();
    if (tagged.length() !== 0) {
      throw new Error(`Expected 0 handlers, got ${tagged.length()}`);
    }
  });

  it("CanTriggerOn checks underlying hook for untagged wrappers", () => {
    const base = new Hook<MockTagsEvent>();
    const global = NewTaggedHook(base);

    if (global.CanTriggerOn(["demo"])) {
      throw new Error("Expected empty untagged wrapper to report no matching handlers");
    }

    NewTaggedHook(base, "superusers").BindFunc(async (event) => event.Next());

    if (global.CanTriggerOn(["organizations"])) {
      throw new Error("Expected unrelated tags to not match through untagged wrapper");
    }

    if (!global.CanTriggerOn(["superusers"])) {
      throw new Error("Expected matching tags to match through untagged wrapper");
    }
  });
});
