// Ported from pocketbase/tools/router/router_test.go

import { describe, expect, it } from "bun:test";
import { Event } from "./event.ts";
import { Router } from "./router.ts";

describe("Router", () => {
  it("routes and middlewares", async () => {
    let calls = "";

    const router = new Router<Event>();

    router.BindFunc((event) => {
      calls += "root_m:";
      const result = event.Next();
      if (result instanceof Error) {
        calls += "/error";
      }
      return result;
    });

    router.Any("/any", () => {
      calls += "/any";
      return null;
    });

    router.GET("/a", () => {
      calls += "/a";
      return null;
    });

    const group = router.Group("/a/b").BindFunc((event) => {
      calls += "a_b_group_m:";
      return event.Next();
    });

    group
      .GET("/1", () => {
        calls += "/1_get";
        return null;
      })
      .BindFunc((event) => {
        calls += "1_get_m:";
        return event.Next();
      });

    group.POST("/1", () => {
      calls += "/1_post";
      return null;
    });

    group.GET("/{param}", (event) => {
      calls += `/${event.params.param ?? ""}`;
      return new Error("test");
    });

    const handler = router.buildHandler(({ request, params, remoteAddress }) => ({
      event: new Event({ request, params, remoteAddress }),
      cleanup: () => {
        calls += ":cleanup";
      },
    }));

    const scenarios = [
      { method: "GET", path: "/any", calls: "root_m:/any:cleanup" },
      { method: "OPTIONS", path: "/any", calls: "root_m:/any:cleanup" },
      { method: "PATCH", path: "/any", calls: "root_m:/any:cleanup" },
      { method: "PUT", path: "/any", calls: "root_m:/any:cleanup" },
      { method: "POST", path: "/any", calls: "root_m:/any:cleanup" },
      { method: "DELETE", path: "/any", calls: "root_m:/any:cleanup" },
      { method: "POST", path: "/a", calls: "root_m:/error:cleanup" },
      { method: "GET", path: "/a", calls: "root_m:/a:cleanup" },
      { method: "HEAD", path: "/a", calls: "root_m:/a:cleanup" },
      { method: "GET", path: "/a/b/1", calls: "root_m:a_b_group_m:1_get_m:/1_get:cleanup" },
      { method: "HEAD", path: "/a/b/1", calls: "root_m:a_b_group_m:1_get_m:/1_get:cleanup" },
      { method: "POST", path: "/a/b/1", calls: "root_m:a_b_group_m:/1_post:cleanup" },
      { method: "GET", path: "/a/b/456", calls: "root_m:a_b_group_m:/456/error:cleanup" },
    ];

    for (const scenario of scenarios) {
      calls = "";
      const req = new Request(`http://localhost${scenario.path}`, { method: scenario.method });
      await handler(req);
      expect(calls).toBe(scenario.calls);
    }
  });

  it("Unbind", async () => {
    let calls = "";

    const router = new Router<Event>();

    router.Bind({
      Id: "root_1",
      Func: (event) => {
        calls += "root_1:";
        return event.Next();
      },
    });
    router.Bind({
      Id: "root_2",
      Func: (event) => {
        calls += "root_2:";
        return event.Next();
      },
    });
    router.Bind({
      Id: "root_3",
      Func: (event) => {
        calls += "root_3:";
        return event.Next();
      },
    });

    router
      .GET("/action", () => {
        calls += "root_action";
        return null;
      })
      .Unbind("root_1");

    const ga = router.Group("/group_a");
    ga.Unbind("root_1");
    ga.Bind({
      Id: "group_a_1",
      Func: (event) => {
        calls += "group_a_1:";
        return event.Next();
      },
    });
    ga.Bind({
      Id: "group_a_2",
      Func: (event) => {
        calls += "group_a_2:";
        return event.Next();
      },
    });
    ga.Bind({
      Id: "group_a_3",
      Func: (event) => {
        calls += "group_a_3:";
        return event.Next();
      },
    });
    ga.GET("/action", () => {
      calls += "group_a_action";
      return null;
    }).Unbind("root_2", "group_b_1", "group_a_1");

    const gb = router.Group("/group_b");
    gb.Unbind("root_2");
    gb.Bind({
      Id: "group_b_1",
      Func: (event) => {
        calls += "group_b_1:";
        return event.Next();
      },
    });
    gb.Bind({
      Id: "group_b_2",
      Func: (event) => {
        calls += "group_b_2:";
        return event.Next();
      },
    });
    gb.Bind({
      Id: "group_b_3",
      Func: (event) => {
        calls += "group_b_3:";
        return event.Next();
      },
    });
    gb.GET("/action", () => {
      calls += "group_b_action";
      return null;
    }).Unbind("group_b_3", "group_a_3", "root_3");

    const handler = router.buildHandler(({ request, params, remoteAddress }) => ({
      event: new Event({ request, params, remoteAddress }),
      cleanup: () => {
        calls += ":cleanup";
      },
    }));

    const scenarios = [
      { method: "GET", path: "/action", calls: "root_2:root_3:root_action:cleanup" },
      { method: "GET", path: "/group_a/action", calls: "root_3:group_a_2:group_a_3:group_a_action:cleanup" },
      { method: "GET", path: "/group_b/action", calls: "root_1:group_b_1:group_b_2:group_b_action:cleanup" },
    ];

    for (const scenario of scenarios) {
      calls = "";
      const req = new Request(`http://localhost${scenario.path}`, { method: scenario.method });
      await handler(req);
      expect(calls).toBe(scenario.calls);
    }
  });

  it("can resolve remoteAddress lazily", async () => {
    const router = new Router<Event>();
    let requestIpCalls = 0;
    let seenRemoteIp = "";
    let seenPathname = "";

    router.GET("/lazy", (event) => {
      seenRemoteIp = event.RemoteIP();
      seenPathname = event.requestUrl().pathname;
      return null;
    });

    const handler = router.buildHandler(
      ({ request, params, remoteAddress, remoteAddressResolver }) => ({
        event: new Event({ request, params, remoteAddress, remoteAddressResolver }),
      }),
      { lazyRemoteAddress: true, lazyRequestUrl: true },
    );

    const req = new Request("http://localhost/lazy");
    const server = {
      requestIP() {
        requestIpCalls += 1;
        return { address: "127.0.0.1", port: 8090 };
      },
    };

    expect(requestIpCalls).toBe(0);
    await handler(req, server);
    expect(seenRemoteIp).toBe("127.0.0.1");
    expect(seenPathname).toBe("/lazy");
    expect(requestIpCalls).toBe(1);
  });
});
