// Ported from pocketbase/apis/cron_test.go.

import { describe, it } from "bun:test";
import type { ApiScenario } from "../tests/api.ts";
import type { TestApp } from "../tests/app.ts";
import { runApiScenario } from "../tests/api.ts";

const regularAuthToken =
  "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjRxMXhsY2xtZmxva3UzMyIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoiX3BiX3VzZXJzX2F1dGhfIiwiZXhwIjoyNTI0NjA0NDYxLCJyZWZyZXNoYWJsZSI6dHJ1ZX0.ZT3F0Z3iM-xbGgSG3LEKiEzHrPHr8t8IuHLZGGNuxLo";
const superuserToken =
  "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InN5d2JoZWNuaDQ2cmhtMCIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoicGJjXzMxNDI2MzU4MjMiLCJleHAiOjI1MjQ2MDQ0NjEsInJlZnJlc2hhYmxlIjp0cnVlfQ.UXgO3j-0BumcugrFjbd7j0M4MQvbrLggLlcu_YNGjoY";

describe("cron api", () => {
  it("crons list", async () => {
    const scenarios: ApiScenario[] = [
      {
        name: "unauthorized",
        method: "GET",
        url: "/api/crons",
        expectedStatus: 401,
        expectedContent: ['"data":{}'],
        expectedEvents: { "*": 0 },
      },
      {
        name: "authorized as regular user",
        method: "GET",
        url: "/api/crons",
        headers: { Authorization: regularAuthToken },
        expectedStatus: 403,
        expectedContent: ['"data":{}'],
        expectedEvents: { "*": 0 },
      },
      {
        name: "authorized as superuser (empty list)",
        method: "GET",
        url: "/api/crons",
        headers: { Authorization: superuserToken },
        beforeTest: (app) => {
          app.Cron().RemoveAll();
        },
        expectedStatus: 200,
        expectedContent: ["[]"],
        expectedEvents: { "*": 0 },
      },
      {
        name: "authorized as superuser",
        method: "GET",
        url: "/api/crons",
        headers: { Authorization: superuserToken },
        expectedStatus: 200,
        expectedContent: [
          '{"id":"__pbLogsCleanup__","expression":"0 */6 * * *"}',
          '{"id":"__pbDBOptimize__","expression":"0 0 * * *"}',
          '{"id":"__pbMFACleanup__","expression":"0 * * * *"}',
          '{"id":"__pbOTPCleanup__","expression":"0 * * * *"}',
        ],
        expectedEvents: { "*": 0 },
      },
    ];

    for (const scenario of scenarios) {
      await runApiScenario(scenario);
    }
  });

  it("crons run", async () => {
    const beforeTest = (app: TestApp) => {
      const err = app.Cron().Add("test", "* * * * *", () => {
        const current = Number(app.store().get("testJobCalls") ?? 0);
        app.store().set("testJobCalls", current + 1);
      });
      if (err) {
        throw err;
      }
    };

    const expectedCalls = (expected: number) => {
      return (app: TestApp) => {
        const total = Number(app.store().get("testJobCalls") ?? 0);
        if (total !== expected) {
          throw new Error(`Expected total testJobCalls ${expected}, got ${total}`);
        }
      };
    };

    const scenarios: ApiScenario[] = [
      {
        name: "unauthorized",
        method: "POST",
        url: "/api/crons/test",
        delayMs: 50,
        beforeTest,
        afterTest: (app) => expectedCalls(0)(app),
        expectedStatus: 401,
        expectedContent: ['"data":{}'],
        expectedEvents: { "*": 0 },
      },
      {
        name: "authorized as regular user",
        method: "POST",
        url: "/api/crons/test",
        headers: { Authorization: regularAuthToken },
        delayMs: 50,
        beforeTest,
        afterTest: (app) => expectedCalls(0)(app),
        expectedStatus: 403,
        expectedContent: ['"data":{}'],
        expectedEvents: { "*": 0 },
      },
      {
        name: "authorized as superuser (missing job)",
        method: "POST",
        url: "/api/crons/missing",
        headers: { Authorization: superuserToken },
        delayMs: 50,
        beforeTest,
        afterTest: (app) => expectedCalls(0)(app),
        expectedStatus: 404,
        expectedContent: ['"data":{}'],
        expectedEvents: { "*": 0 },
      },
      {
        name: "authorized as superuser (existing job)",
        method: "POST",
        url: "/api/crons/test",
        headers: { Authorization: superuserToken },
        delayMs: 50,
        beforeTest,
        afterTest: (app) => expectedCalls(1)(app),
        expectedStatus: 204,
        expectedEvents: { "*": 0 },
      },
    ];

    for (const scenario of scenarios) {
      await runApiScenario(scenario);
    }
  });
});
