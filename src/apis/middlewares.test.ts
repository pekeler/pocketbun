// Ported from pocketbase/apis/middlewares_test.go.

import { describe, it } from "bun:test";
import type { ServeEvent } from "../core/events.ts";
import type { ApiScenario } from "../tests/api.ts";
import type { TestApp } from "../tests/app.ts";
import { RequireGuestOnly as ExportedRequireGuestOnly } from "../../index.ts";
import { runApiScenario } from "../tests/api.ts";
import {
  RequireAuth,
  RequireGuestOnly,
  RequireSameCollectionContextAuth,
  RequireSuperuserAuth,
  RequireSuperuserOrOwnerAuth,
} from "./middlewares.ts";

const regularAuthToken =
  "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjRxMXhsY2xtZmxva3UzMyIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoiX3BiX3VzZXJzX2F1dGhfIiwiZXhwIjoyNTI0NjA0NDYxLCJyZWZyZXNoYWJsZSI6dHJ1ZX0.ZT3F0Z3iM-xbGgSG3LEKiEzHrPHr8t8IuHLZGGNuxLo";
const regularStaticToken =
  "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjRxMXhsY2xtZmxva3UzMyIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoiX3BiX3VzZXJzX2F1dGhfIiwiZXhwIjoyNTI0NjA0NDYxLCJyZWZyZXNoYWJsZSI6ZmFsc2V9.4IsO6YMsR19crhwl_YWzvRH8pfq2Ri4Gv2dzGyneLak";
const superuserToken =
  "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InN5d2JoZWNuaDQ2cmhtMCIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoicGJjXzMxNDI2MzU4MjMiLCJleHAiOjI1MjQ2MDQ0NjEsInJlZnJlc2hhYmxlIjp0cnVlfQ.UXgO3j-0BumcugrFjbd7j0M4MQvbrLggLlcu_YNGjoY";
const expiredRegularToken =
  "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjRxMXhsY2xtZmxva3UzMyIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoiX3BiX3VzZXJzX2F1dGhfIiwiZXhwIjoxNjQwOTkxNjYxLCJyZWZyZXNoYWJsZSI6dHJ1ZX0.2D3tmqPn3vc5LoqqCz8V-iCDVXo9soYiH0d32G7FQT4";
const expiredSuperuserToken =
  "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InN5d2JoZWNuaDQ2cmhtMCIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoicGJjXzMxNDI2MzU4MjMiLCJleHAiOjE2NDA5OTE2NjEsInJlZnJlc2hhYmxlIjp0cnVlfQ.0pDcBPGDpL2Khh76ivlRi7ugiLBSYvasct3qpHV3rfs";
const invalidToken =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InN5d2JoZWNuaDQ2cmhtMCIsImV4cCI6MjUyNDYwNDQ2MSwidHlwZSI6ImZpbGUiLCJjb2xsZWN0aW9uSWQiOiJwYmNfMzE0MjYzNTgyMyJ9.Lupz541xRvrktwkrl55p5pPCF77T69ZRsohsIcb2dxc";

function bindServeRoute(setup: (event: ServeEvent) => void): (app: TestApp) => void {
  return (app) => {
    app.OnServe().BindFunc((event) => {
      setup(event);
      return event.Next();
    });
  };
}

describe("middlewares", () => {
  it("panic recover", async () => {
    const scenarios: ApiScenario[] = [
      {
        name: "panic from route",
        method: "GET",
        url: "/my/test",
        beforeTest: bindServeRoute((event) => {
          event.Router.get("/my/test", () => {
            throw "123";
          });
        }),
        expectedStatus: 500,
        expectedContent: ['"data":{}'],
        expectedEvents: { "*": 0 },
      },
      {
        name: "panic from middleware",
        method: "GET",
        url: "/my/test",
        beforeTest: bindServeRoute((event) => {
          event.Router.get("/my/test", (reqEvent) => reqEvent.String(200, "test")).BindFunc(() => {
            throw 123;
          });
        }),
        expectedStatus: 500,
        expectedContent: ['"data":{}'],
        expectedEvents: { "*": 0 },
      },
    ];

    for (const scenario of scenarios) {
      await runApiScenario(scenario);
    }
  });

  it("require guest only", async () => {
    const beforeTest = bindServeRoute((event) => {
      event.Router.get("/my/test", (reqEvent) => reqEvent.String(200, "test123")).Bind(RequireGuestOnly());
    });

    const scenarios: ApiScenario[] = [
      {
        name: "valid regular user token",
        method: "GET",
        url: "/my/test",
        headers: { Authorization: regularAuthToken },
        beforeTest,
        expectedStatus: 400,
        expectedContent: ['"data":{}'],
        expectedEvents: { "*": 0 },
      },
      {
        name: "valid superuser auth token",
        method: "GET",
        url: "/my/test",
        headers: { Authorization: superuserToken },
        beforeTest,
        expectedStatus: 400,
        expectedContent: ['"data":{}'],
        expectedEvents: { "*": 0 },
      },
      {
        name: "expired/invalid token",
        method: "GET",
        url: "/my/test",
        headers: { Authorization: expiredRegularToken },
        beforeTest,
        expectedStatus: 200,
        expectedContent: ["test123"],
        expectedEvents: { "*": 0 },
      },
      {
        name: "guest",
        method: "GET",
        url: "/my/test",
        beforeTest,
        expectedStatus: 200,
        expectedContent: ["test123"],
        expectedEvents: { "*": 0 },
      },
    ];

    for (const scenario of scenarios) {
      await runApiScenario(scenario);
    }
  });

  it("re-exports require guest only in the package entrypoint", async () => {
    const beforeTest = bindServeRoute((event) => {
      event.Router.get("/my/test", (reqEvent) => reqEvent.String(200, "test123")).Bind(ExportedRequireGuestOnly());
    });

    const scenarios: ApiScenario[] = [
      {
        name: "guest",
        method: "GET",
        url: "/my/test",
        beforeTest,
        expectedStatus: 200,
        expectedContent: ["test123"],
        expectedEvents: { "*": 0 },
      },
      {
        name: "valid regular user token",
        method: "GET",
        url: "/my/test",
        headers: { Authorization: regularAuthToken },
        beforeTest,
        expectedStatus: 400,
        expectedContent: ['"data":{}'],
        expectedEvents: { "*": 0 },
      },
    ];

    for (const scenario of scenarios) {
      await runApiScenario(scenario);
    }
  });

  it("require auth", async () => {
    const buildRoute = (handler: typeof RequireAuth) =>
      bindServeRoute((event) => {
        event.Router.get("/my/test", (reqEvent) => reqEvent.String(200, "test123")).Bind(handler());
      });

    const scenarios: ApiScenario[] = [
      {
        name: "guest",
        method: "GET",
        url: "/my/test",
        beforeTest: buildRoute(RequireAuth),
        expectedStatus: 401,
        expectedContent: ['"data":{}'],
        expectedEvents: { "*": 0 },
      },
      {
        name: "expired token",
        method: "GET",
        url: "/my/test",
        headers: { Authorization: expiredRegularToken },
        beforeTest: buildRoute(RequireAuth),
        expectedStatus: 401,
        expectedContent: ['"data":{}'],
        expectedEvents: { "*": 0 },
      },
      {
        name: "invalid token",
        method: "GET",
        url: "/my/test",
        headers: { Authorization: invalidToken },
        beforeTest: buildRoute(RequireAuth),
        expectedStatus: 401,
        expectedContent: ['"data":{}'],
        expectedEvents: { "*": 0 },
      },
      {
        name: "valid record auth token with no collection restrictions",
        method: "GET",
        url: "/my/test",
        headers: { Authorization: regularAuthToken },
        beforeTest: buildRoute(RequireAuth),
        expectedStatus: 200,
        expectedContent: ["test123"],
      },
      {
        name: "valid record auth token with Bearer case-insensitive prefix",
        method: "GET",
        url: "/my/test",
        headers: { Authorization: `BeArEr ${regularAuthToken}` },
        beforeTest: buildRoute(RequireAuth),
        expectedStatus: 200,
        expectedContent: ["test123"],
      },
      {
        name: "valid record static auth token",
        method: "GET",
        url: "/my/test",
        headers: { Authorization: regularStaticToken },
        beforeTest: buildRoute(RequireAuth),
        expectedStatus: 200,
        expectedContent: ["test123"],
      },
      {
        name: "valid record auth token with collection not in the restricted list",
        method: "GET",
        url: "/my/test",
        headers: { Authorization: superuserToken },
        beforeTest: bindServeRoute((event) => {
          event.Router.get("/my/test", (reqEvent) => reqEvent.String(200, "test123")).Bind(RequireAuth("users", "demo1"));
        }),
        expectedStatus: 403,
        expectedContent: ['"data":{}'],
        expectedEvents: { "*": 0 },
      },
      {
        name: "valid record auth token with collection in the restricted list",
        method: "GET",
        url: "/my/test",
        headers: { Authorization: superuserToken },
        beforeTest: bindServeRoute((event) => {
          event.Router.get("/my/test", (reqEvent) => reqEvent.String(200, "test123")).Bind(RequireAuth("users", "_superusers"));
        }),
        expectedStatus: 200,
        expectedContent: ["test123"],
      },
    ];

    for (const scenario of scenarios) {
      await runApiScenario(scenario);
    }
  });

  it("require superuser auth", async () => {
    const beforeTest = bindServeRoute((event) => {
      event.Router.get("/my/test", (reqEvent) => reqEvent.String(200, "test123")).Bind(RequireSuperuserAuth());
    });

    const scenarios: ApiScenario[] = [
      {
        name: "guest",
        method: "GET",
        url: "/my/test",
        beforeTest,
        expectedStatus: 401,
        expectedContent: ['"data":{}'],
        expectedEvents: { "*": 0 },
      },
      {
        name: "expired/invalid token",
        method: "GET",
        url: "/my/test",
        headers: { Authorization: expiredSuperuserToken },
        beforeTest,
        expectedStatus: 401,
        expectedContent: ['"data":{}'],
        expectedEvents: { "*": 0 },
      },
      {
        name: "valid regular user auth token",
        method: "GET",
        url: "/my/test",
        headers: { Authorization: regularAuthToken },
        beforeTest,
        expectedStatus: 403,
        expectedContent: ['"data":{}'],
        expectedEvents: { "*": 0 },
      },
      {
        name: "valid superuser auth token",
        method: "GET",
        url: "/my/test",
        headers: { Authorization: superuserToken },
        beforeTest,
        expectedStatus: 200,
        expectedContent: ["test123"],
      },
    ];

    for (const scenario of scenarios) {
      await runApiScenario(scenario);
    }
  });

  it("require superuser or owner auth", async () => {
    const scenarios: ApiScenario[] = [
      {
        name: "guest",
        method: "GET",
        url: "/my/test/4q1xlclmfloku33",
        beforeTest: bindServeRoute((event) => {
          event.Router.get("/my/test/{id}", (reqEvent) => reqEvent.String(200, "test123")).Bind(
            RequireSuperuserOrOwnerAuth(""),
          );
        }),
        expectedStatus: 401,
        expectedContent: ['"data":{}'],
        expectedEvents: { "*": 0 },
      },
      {
        name: "expired/invalid token",
        method: "GET",
        url: "/my/test/4q1xlclmfloku33",
        headers: { Authorization: expiredSuperuserToken },
        beforeTest: bindServeRoute((event) => {
          event.Router.get("/my/test/{id}", (reqEvent) => reqEvent.String(200, "test123")).Bind(
            RequireSuperuserOrOwnerAuth(""),
          );
        }),
        expectedStatus: 401,
        expectedContent: ['"data":{}'],
        expectedEvents: { "*": 0 },
      },
      {
        name: "valid record auth token (different user)",
        method: "GET",
        url: "/my/test/oap640cot4yru2s",
        headers: { Authorization: regularAuthToken },
        beforeTest: bindServeRoute((event) => {
          event.Router.get("/my/test/{id}", (reqEvent) => reqEvent.String(200, "test123")).Bind(
            RequireSuperuserOrOwnerAuth(""),
          );
        }),
        expectedStatus: 403,
        expectedContent: ['"data":{}'],
        expectedEvents: { "*": 0 },
      },
      {
        name: "valid record auth token (owner)",
        method: "GET",
        url: "/my/test/4q1xlclmfloku33",
        headers: { Authorization: regularAuthToken },
        beforeTest: bindServeRoute((event) => {
          event.Router.get("/my/test/{id}", (reqEvent) => reqEvent.String(200, "test123")).Bind(
            RequireSuperuserOrOwnerAuth(""),
          );
        }),
        expectedStatus: 200,
        expectedContent: ["test123"],
      },
      {
        name: "valid record auth token (owner + non-matching custom owner param)",
        method: "GET",
        url: "/my/test/4q1xlclmfloku33",
        headers: { Authorization: regularAuthToken },
        beforeTest: bindServeRoute((event) => {
          event.Router.get("/my/test/{id}", (reqEvent) => reqEvent.String(200, "test123")).Bind(
            RequireSuperuserOrOwnerAuth("test"),
          );
        }),
        expectedStatus: 403,
        expectedContent: ['"data":{}'],
        expectedEvents: { "*": 0 },
      },
      {
        name: "valid record auth token (owner + matching custom owner param)",
        method: "GET",
        url: "/my/test/4q1xlclmfloku33",
        headers: { Authorization: regularAuthToken },
        beforeTest: bindServeRoute((event) => {
          event.Router.get("/my/test/{test}", (reqEvent) => reqEvent.String(200, "test123")).Bind(
            RequireSuperuserOrOwnerAuth("test"),
          );
        }),
        expectedStatus: 200,
        expectedContent: ["test123"],
      },
      {
        name: "valid superuser auth token",
        method: "GET",
        url: "/my/test/4q1xlclmfloku33",
        headers: { Authorization: superuserToken },
        beforeTest: bindServeRoute((event) => {
          event.Router.get("/my/test/{id}", (reqEvent) => reqEvent.String(200, "test123")).Bind(
            RequireSuperuserOrOwnerAuth(""),
          );
        }),
        expectedStatus: 200,
        expectedContent: ["test123"],
      },
    ];

    for (const scenario of scenarios) {
      await runApiScenario(scenario);
    }
  });

  it("require same collection context auth", async () => {
    const scenarios: ApiScenario[] = [
      {
        name: "guest",
        method: "GET",
        url: "/my/test/_pb_users_auth_",
        beforeTest: bindServeRoute((event) => {
          event.Router.get("/my/test/{collection}", (reqEvent) => reqEvent.String(200, "test123")).Bind(
            RequireSameCollectionContextAuth(""),
          );
        }),
        expectedStatus: 401,
        expectedContent: ['"data":{}'],
        expectedEvents: { "*": 0 },
      },
      {
        name: "expired/invalid token",
        method: "GET",
        url: "/my/test/_pb_users_auth_",
        headers: { Authorization: expiredRegularToken },
        beforeTest: bindServeRoute((event) => {
          event.Router.get("/my/test/{collection}", (reqEvent) => reqEvent.String(200, "test123")).Bind(
            RequireSameCollectionContextAuth(""),
          );
        }),
        expectedStatus: 401,
        expectedContent: ['"data":{}'],
        expectedEvents: { "*": 0 },
      },
      {
        name: "valid record auth token (different collection)",
        method: "GET",
        url: "/my/test/clients",
        headers: { Authorization: regularAuthToken },
        beforeTest: bindServeRoute((event) => {
          event.Router.get("/my/test/{collection}", (reqEvent) => reqEvent.String(200, "test123")).Bind(
            RequireSameCollectionContextAuth(""),
          );
        }),
        expectedStatus: 403,
        expectedContent: ['"data":{}'],
        expectedEvents: { "*": 0 },
      },
      {
        name: "valid record auth token (same collection)",
        method: "GET",
        url: "/my/test/_pb_users_auth_",
        headers: { Authorization: regularAuthToken },
        beforeTest: bindServeRoute((event) => {
          event.Router.get("/my/test/{collection}", (reqEvent) => reqEvent.String(200, "test123")).Bind(
            RequireSameCollectionContextAuth(""),
          );
        }),
        expectedStatus: 200,
        expectedContent: ["test123"],
      },
      {
        name: "valid record auth token (non-matching/missing collection param)",
        method: "GET",
        url: "/my/test/_pb_users_auth_",
        headers: { Authorization: regularAuthToken },
        beforeTest: bindServeRoute((event) => {
          event.Router.get("/my/test/{id}", (reqEvent) => reqEvent.String(200, "test123")).Bind(
            RequireSuperuserOrOwnerAuth(""),
          );
        }),
        expectedStatus: 403,
        expectedContent: ['"data":{}'],
        expectedEvents: { "*": 0 },
      },
      {
        name: "valid record auth token (matching custom collection param)",
        method: "GET",
        url: "/my/test/_pb_users_auth_",
        headers: { Authorization: regularAuthToken },
        beforeTest: bindServeRoute((event) => {
          event.Router.get("/my/test/{test}", (reqEvent) => reqEvent.String(200, "test123")).Bind(
            RequireSuperuserOrOwnerAuth("test"),
          );
        }),
        expectedStatus: 403,
        expectedContent: ['"data":{}'],
        expectedEvents: { "*": 0 },
      },
      {
        name: "superuser no exception check",
        method: "GET",
        url: "/my/test/_pb_users_auth_",
        headers: { Authorization: superuserToken },
        beforeTest: bindServeRoute((event) => {
          event.Router.get("/my/test/{collection}", (reqEvent) => reqEvent.String(200, "test123")).Bind(
            RequireSameCollectionContextAuth(""),
          );
        }),
        expectedStatus: 403,
        expectedContent: ['"data":{}'],
        expectedEvents: { "*": 0 },
      },
    ];

    for (const scenario of scenarios) {
      await runApiScenario(scenario);
    }
  });

  it("superuser IPs whitelist", async () => {
    const setupWhitelist = (...superuserIPs: string[]) =>
      bindServeRoute((event) => {
        event.App.settings().trustedProxy = {
          headers: ["x-test-ip"],
          useLeftmostIP: false,
        };
        event.App.settings().superuserIPs = superuserIPs;
        event.Router.get("/my/test", (reqEvent) => reqEvent.String(200, "test123"));
      });

    const scenarios: ApiScenario[] = [
      {
        name: "guest with non-matching IP",
        method: "GET",
        url: "/my/test",
        headers: { "x-test-ip": "127.0.0.1" },
        beforeTest: setupWhitelist("0.0.0.0"),
        expectedStatus: 200,
        expectedContent: ["test123"],
        expectedEvents: { "*": 0 },
      },
      {
        name: "regular user with non-matching IP",
        method: "GET",
        url: "/my/test",
        headers: { "x-test-ip": "127.0.0.1", Authorization: regularAuthToken },
        beforeTest: setupWhitelist("0.0.0.0"),
        expectedStatus: 200,
        expectedContent: ["test123"],
        expectedEvents: { "*": 0 },
      },
      {
        name: "superuser with non-matching IP",
        method: "GET",
        url: "/my/test",
        headers: { "x-test-ip": "127.0.0.1", Authorization: superuserToken },
        beforeTest: setupWhitelist("0.0.0.0"),
        expectedStatus: 403,
        expectedContent: ['"data":{}'],
        expectedEvents: { "*": 0 },
      },
      {
        name: "superuser with matching IP",
        method: "GET",
        url: "/my/test",
        headers: { "x-test-ip": "127.0.0.1", Authorization: superuserToken },
        beforeTest: setupWhitelist("127.0.0.1"),
        expectedStatus: 200,
        expectedContent: ["test123"],
        expectedEvents: { "*": 0 },
      },
      {
        name: "superuser with matching subnet",
        method: "GET",
        url: "/my/test",
        headers: { "x-test-ip": "127.0.0.1", Authorization: superuserToken },
        beforeTest: setupWhitelist("127.0.0.0/24"),
        expectedStatus: 200,
        expectedContent: ["test123"],
        expectedEvents: { "*": 0 },
      },
    ];

    for (const scenario of scenarios) {
      await runApiScenario(scenario);
    }
  });
});
