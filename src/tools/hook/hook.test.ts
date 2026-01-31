// Ported from pocketbase/tools/hook/hook_test.go

import { describe, it } from "bun:test";
import { Event } from "./event.ts";
import { Hook } from "./hook.ts";

describe("hook", () => {
  it("Bind and trigger", async () => {
    let calls = "";

    const hook = new Hook<Event>();

    hook.BindFunc(async (event) => {
      calls += "1";
      return event.Next();
    });
    hook.BindFunc(async (event) => {
      calls += "2";
      return event.Next();
    });
    const h3Id = hook.BindFunc(async (event) => {
      calls += "3";
      return event.Next();
    });
    hook.Bind({
      Id: h3Id,
      Func: async (event) => {
        calls += "3'";
        return event.Next();
      },
    });
    hook.Bind({
      Func: async (event) => {
        calls += "4";
        return event.Next();
      },
      Priority: -2,
    });
    hook.Bind({
      Func: async (event) => {
        calls += "5";
        return event.Next();
      },
      Priority: -1,
    });
    hook.Bind({
      Func: async (event) => {
        calls += "6";
        return event.Next();
      },
    });
    hook.Bind({
      Func: async (event) => {
        calls += "7";
        await event.Next();
        return new Error("test");
      },
    });

    await hook.Trigger(
      new Event(),
      async (event) => {
        calls += "8";
        return event.Next();
      },
      async (_event) => {
        calls += "9";
        return null;
      },
      async (event) => {
        calls += "10";
        return event.Next();
      },
    );

    if (hook.Length() !== 7) {
      throw new Error(`Expected 7 handlers, found ${hook.Length()}`);
    }

    const expectedCalls = "45123'6789";

    if (calls !== expectedCalls) {
      throw new Error(`Expected calls sequence ${expectedCalls}, got ${calls}`);
    }
  });

  it("Length", () => {
    const hook = new Hook<Event>();

    if (hook.Length() !== 0) {
      throw new Error(`Expected 0 hook handlers, got ${hook.Length()}`);
    }

    hook.BindFunc(async (event) => event.Next());
    hook.BindFunc(async (event) => event.Next());

    if (hook.Length() !== 2) {
      throw new Error(`Expected 2 hook handlers, got ${hook.Length()}`);
    }
  });

  it("Unbind", async () => {
    const hook = new Hook<Event>();

    let calls = "";

    const id0 = hook.BindFunc(async (event) => {
      calls += "0";
      return event.Next();
    });
    const id1 = hook.BindFunc(async (event) => {
      calls += "1";
      return event.Next();
    });
    hook.BindFunc(async (event) => {
      calls += "2";
      return event.Next();
    });
    hook.Bind({
      Func: async (event) => {
        calls += "3";
        return event.Next();
      },
    });

    hook.Unbind("missing");

    if (hook.Length() !== 4) {
      throw new Error(`Expected 4 handlers, got ${hook.Length()}`);
    }

    hook.Unbind(id1, id0);

    if (hook.Length() !== 2) {
      throw new Error(`Expected 2 handlers, got ${hook.Length()}`);
    }

    const err = await hook.Trigger(new Event(), async (event) => {
      calls += "4";
      return event.Next();
    });
    if (err) {
      throw err;
    }

    const expectedCalls = "234";

    if (calls !== expectedCalls) {
      throw new Error(`Expected calls sequence ${expectedCalls}, got ${calls}`);
    }
  });

  it("UnbindAll", () => {
    const hook = new Hook<Event>();

    hook.UnbindAll();

    hook.BindFunc(async () => null);
    hook.BindFunc(async () => null);

    if (hook.Length() !== 2) {
      throw new Error(`Expected 2 handlers before UnbindAll, found ${hook.Length()}`);
    }

    hook.UnbindAll();

    if (hook.Length() !== 0) {
      throw new Error(`Expected no handlers after UnbindAll, found ${hook.Length()}`);
    }
  });

  it("Trigger error propagation", async () => {
    const err = new Error("test");

    const scenarios: Array<{
      name: string;
      handlers: Array<(event: Event) => Promise<unknown>>;
      expectedError: Error | null;
    }> = [
      {
        name: "without error",
        handlers: [
          async (event) => event.Next(),
          async (event) => event.Next(),
        ],
        expectedError: null,
      },
      {
        name: "with error",
        handlers: [
          async (event) => event.Next(),
          async (event) => {
            await event.Next();
            return err;
          },
          async (event) => event.Next(),
        ],
        expectedError: err,
      },
    ];

    for (const scenario of scenarios) {
      const hook = new Hook<Event>();
      for (const handler of scenario.handlers) {
        hook.BindFunc(handler);
      }
      const result = await hook.Trigger(new Event());
      if (result !== scenario.expectedError) {
        throw new Error(
          `Expected ${String(scenario.expectedError)}, got ${String(result)}`,
        );
      }
    }
  });
});
