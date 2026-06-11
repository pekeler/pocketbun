// Ported from pocketbase/tools/router/route_test.go

import { describe, expect, it } from "bun:test";
import { Event } from "./event.ts";
import { Route } from "./route.ts";

describe("Route", () => {
  it("BindFunc", () => {
    const route = new Route<Event>("GET", "/test", () => null);
    let calls = "";

    route.BindFunc(() => {
      calls += "a";
      return null;
    });
    route.BindFunc(
      () => {
        calls += "b";
        return null;
      },
      () => {
        calls += "c";
        return null;
      },
    );

    expect(route.Middlewares.length).toBe(3);
    for (const handler of route.Middlewares) {
      handler.Func(null as unknown as Event);
    }
    expect(calls).toBe("abc");
  });

  it("Bind", () => {
    const route = new Route<Event>("GET", "/test", () => null);
    route.excludedMiddlewares = new Set(["test2"]);

    let calls = "";
    route.Bind({
      Func: () => {
        calls += "a";
        return null;
      },
    });
    route.Bind(
      {
        Id: "test1",
        Func: () => {
          calls += "b";
          return null;
        },
      },
      {
        Id: "test2",
        Func: () => {
          calls += "c";
          return null;
        },
      },
    );

    expect(route.Middlewares.length).toBe(3);
    for (const handler of route.Middlewares) {
      handler.Func(null as unknown as Event);
    }
    expect(calls).toBe("abc");
    expect(route.excludedMiddlewares?.size ?? 0).toBe(0);
  });

  it("Unbind", () => {
    const route = new Route<Event>("GET", "/test", () => null);
    let calls = "";

    route.Bind({
      Func: () => {
        calls += "a";
        return null;
      },
    });
    route.Bind(
      {
        Id: "test1",
        Func: () => {
          calls += "b";
          return null;
        },
      },
      {
        Id: "test2",
        Func: () => {
          calls += "c";
          return null;
        },
      },
      {
        Id: "test3",
        Func: () => {
          calls += "d";
          return null;
        },
      },
    );

    route.Unbind("");
    route.Unbind("test1", "test3");

    expect(route.Middlewares.length).toBe(2);
    for (const handler of route.Middlewares) {
      handler.Func(null as unknown as Event);
    }
    expect(calls).toBe("ac");
    expect(route.excludedMiddlewares?.has("test1")).toBe(true);
    expect(route.excludedMiddlewares?.has("test3")).toBe(true);
  });

  it("lowercase aliases", () => {
    const route = new Route<Event>("GET", "/test", () => null);
    let calls = "";

    route.bindFunc(() => {
      calls += "a";
      return null;
    });
    route.bind({
      id: "test1",
      func: () => {
        calls += "b";
        return null;
      },
    });
    route.bind({
      id: "test2",
      func: () => {
        calls += "c";
        return null;
      },
    });

    route.unbind("test1");

    expect(route.Middlewares.length).toBe(2);
    for (const handler of route.Middlewares) {
      handler.Func(null as unknown as Event);
    }
    expect(calls).toBe("ac");
    expect(route.excludedMiddlewares?.has("test1")).toBe(true);
  });
});
