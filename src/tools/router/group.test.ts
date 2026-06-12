// Ported from pocketbase/tools/router/group_test.go

import { describe, expect, it } from "bun:test";
import { Event } from "./event.ts";
import { RouterGroup } from "./group.ts";

describe("RouterGroup", () => {
  it("Group", () => {
    const root = new RouterGroup<Event>();
    const g1 = root.Group("test1");
    const g2 = root.Group("test2");

    expect(root.children.length).toBe(2);
    expect(g1.Prefix).toBe("test1");
    expect(g2.Prefix).toBe("test2");
  });

  it("BindFunc", () => {
    const group = new RouterGroup<Event>();
    let calls = "";

    group.BindFunc(() => {
      calls += "a";
      return null;
    });

    group.BindFunc(
      () => {
        calls += "b";
        return null;
      },
      () => {
        calls += "c";
        return null;
      },
    );

    expect(group.Middlewares.length).toBe(3);
    for (const handler of group.Middlewares) {
      handler.Func(null as unknown as Event);
    }

    expect(calls).toBe("abc");
  });

  it("Bind", () => {
    const group = new RouterGroup<Event>();
    group.excludedMiddlewares = new Set(["test2"]);

    let calls = "";

    group.Bind({
      Func: () => {
        calls += "a";
        return null;
      },
    });

    group.Bind(
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

    expect(group.Middlewares.length).toBe(3);
    for (const handler of group.Middlewares) {
      handler.Func(null as unknown as Event);
    }
    expect(calls).toBe("abc");
    expect(group.excludedMiddlewares?.size ?? 0).toBe(0);
  });

  it("Unbind", () => {
    const group = new RouterGroup<Event>();
    let calls = "";

    group.Bind({
      Func: () => {
        calls += "a";
        return null;
      },
    });
    group.Bind(
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

    group.Unbind("");
    group.Unbind("test1", "test3");

    expect(group.Middlewares.length).toBe(2);
    for (const handler of group.Middlewares) {
      handler.Func(null as unknown as Event);
    }
    expect(calls).toBe("ac");

    expect(group.excludedMiddlewares?.has("test1")).toBe(true);
    expect(group.excludedMiddlewares?.has("test3")).toBe(true);
  });

  it("lowercase aliases", () => {
    const group = new RouterGroup<Event>();
    group.excludedMiddlewares = new Set(["test2"]);
    let calls = "";

    group.bindFunc(() => {
      calls += "a";
      return null;
    });
    group.bind({
      id: "test1",
      func: () => {
        calls += "b";
        return null;
      },
    });
    group.bind({
      id: "test2",
      func: () => {
        calls += "c";
        return null;
      },
    });

    group.unbind("test1");

    expect(group.Middlewares.length).toBe(2);
    for (const handler of group.Middlewares) {
      handler.Func(null as unknown as Event);
    }
    expect(calls).toBe("ac");
    expect(group.excludedMiddlewares?.has("test1")).toBe(true);
    expect(group.excludedMiddlewares?.has("test2")).toBe(false);
  });

  it("Route", () => {
    const group = new RouterGroup<Event>();
    const sub = group.Group("sub");
    let called = false;

    const route = group.Route("POST", "/test", () => {
      called = true;
      return null;
    });

    expect(sub.children.length).toBe(0);
    expect(group.children.length).toBe(2);
    expect(group.children[1]).toBe(route);
    expect(route.Method).toBe("POST");
    expect(route.Path).toBe("/test");

    route.Action(null as unknown as Event);
    expect(called).toBe(true);
  });

  it("Route aliases", () => {
    const group = new RouterGroup<Event>();
    const testErr = new Error("test");
    const testAction = () => testErr;

    const scenarios = [
      { route: group.Any("/test", testAction), method: "", path: "/test" },
      { route: group.GET("/test", testAction), method: "GET", path: "/test" },
      { route: group.SEARCH("/test", testAction), method: "SEARCH", path: "/test" },
      { route: group.POST("/test", testAction), method: "POST", path: "/test" },
      { route: group.DELETE("/test", testAction), method: "DELETE", path: "/test" },
      { route: group.PATCH("/test", testAction), method: "PATCH", path: "/test" },
      { route: group.PUT("/test", testAction), method: "PUT", path: "/test" },
      { route: group.HEAD("/test", testAction), method: "HEAD", path: "/test" },
      { route: group.OPTIONS("/test", testAction), method: "OPTIONS", path: "/test" },
    ];

    for (const scenario of scenarios) {
      expect(scenario.route.Method).toBe(scenario.method);
      expect(scenario.route.Path).toBe(scenario.path);
      const result = scenario.route.Action(null as unknown as Event);
      expect(result).toBe(testErr);
    }
  });

  it("HasRoute", () => {
    const group = new RouterGroup<Event>();

    group.Any("/any", () => null);
    group.GET("/base", () => null);
    group.DELETE("/base", () => null);

    const sub = group.Group("/sub1");
    sub.GET("/a", () => null);
    sub.POST("/a", () => null);

    const sub2 = sub.Group("/sub2");
    sub2.GET("/b", () => null);
    sub2.GET("/b/{test}", () => null);

    group.GET("/c/", () => null);
    group.GET("/d/{test...}", () => null);

    const scenarios = [
      { method: "GET", path: "", expected: false },
      { method: "", path: "/any", expected: true },
      { method: "POST", path: "/base", expected: false },
      { method: "GET", path: "/base", expected: true },
      { method: "DELETE", path: "/base", expected: true },
      { method: "GET", path: "/sub1", expected: false },
      { method: "GET", path: "/sub1/a", expected: true },
      { method: "POST", path: "/sub1/a", expected: true },
      { method: "DELETE", path: "/sub1/a", expected: false },
      { method: "GET", path: "/sub2/b", expected: false },
      { method: "GET", path: "/sub1/sub2/b", expected: true },
      { method: "GET", path: "/sub1/sub2/b/{test}", expected: true },
      { method: "GET", path: "/sub1/sub2/b/{test2}", expected: false },
      { method: "GET", path: "/c/{test...}", expected: true },
      { method: "GET", path: "/d/", expected: true },
    ];

    for (const scenario of scenarios) {
      const has = group.HasRoute(scenario.method, scenario.path);
      expect(has).toBe(scenario.expected);
      expect(group.hasRoute(scenario.method, scenario.path)).toBe(scenario.expected);
    }
  });
});
