// Ported from pocketbase/apis/logs_test.go

import { describe, it } from "bun:test";
import type { ApiScenario } from "../tests/api.ts";
import { runApiScenario } from "../tests/api.ts";
import { StubLogsData } from "../tests/dynamic_stubs.ts";

const scenarios: ApiScenario[] = [
  {
    name: "unauthorized",
    method: "GET",
    url: "/api/logs",
    expectedStatus: 401,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "authorized as regular user",
    method: "GET",
    url: "/api/logs",
    headers: {
      Authorization:
        "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjRxMXhsY2xtZmxva3UzMyIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoiX3BiX3VzZXJzX2F1dGhfIiwiZXhwIjoyNTI0NjA0NDYxLCJyZWZyZXNoYWJsZSI6dHJ1ZX0.ZT3F0Z3iM-xbGgSG3LEKiEzHrPHr8t8IuHLZGGNuxLo",
    },
    expectedStatus: 403,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "authorized as superuser",
    method: "GET",
    url: "/api/logs",
    headers: {
      Authorization:
        "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InN5d2JoZWNuaDQ2cmhtMCIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoicGJjXzMxNDI2MzU4MjMiLCJleHAiOjI1MjQ2MDQ0NjEsInJlZnJlc2hhYmxlIjp0cnVlfQ.UXgO3j-0BumcugrFjbd7j0M4MQvbrLggLlcu_YNGjoY",
    },
    beforeTest: (app) => {
      const err = StubLogsData(app);
      if (err) {
        throw err;
      }
    },
    expectedStatus: 200,
    expectedContent: [
      '"page":1',
      '"perPage":30',
      '"totalItems":2',
      '"items":[{',
      '"id":"873f2133-9f38-44fb-bf82-c8f53b310d91"',
      '"id":"f2133873-44fb-9f38-bf82-c918f53b310d"',
    ],
    expectedEvents: { "*": 0 },
  },
  {
    name: "authorized as superuser + filter",
    method: "GET",
    url: "/api/logs?filter=data.status>200",
    headers: {
      Authorization:
        "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InN5d2JoZWNuaDQ2cmhtMCIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoicGJjXzMxNDI2MzU4MjMiLCJleHAiOjI1MjQ2MDQ0NjEsInJlZnJlc2hhYmxlIjp0cnVlfQ.UXgO3j-0BumcugrFjbd7j0M4MQvbrLggLlcu_YNGjoY",
    },
    beforeTest: (app) => {
      const err = StubLogsData(app);
      if (err) {
        throw err;
      }
    },
    expectedStatus: 200,
    expectedContent: [
      '"page":1',
      '"perPage":30',
      '"totalItems":1',
      '"items":[{',
      '"id":"f2133873-44fb-9f38-bf82-c918f53b310d"',
    ],
    expectedEvents: { "*": 0 },
  },
  {
    name: "log view unauthorized",
    method: "GET",
    url: "/api/logs/873f2133-9f38-44fb-bf82-c8f53b310d91",
    expectedStatus: 401,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "log view authorized as regular user",
    method: "GET",
    url: "/api/logs/873f2133-9f38-44fb-bf82-c8f53b310d91",
    headers: {
      Authorization:
        "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjRxMXhsY2xtZmxva3UzMyIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoiX3BiX3VzZXJzX2F1dGhfIiwiZXhwIjoyNTI0NjA0NDYxLCJyZWZyZXNoYWJsZSI6dHJ1ZX0.ZT3F0Z3iM-xbGgSG3LEKiEzHrPHr8t8IuHLZGGNuxLo",
    },
    expectedStatus: 403,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "log view authorized as superuser (nonexisting request log)",
    method: "GET",
    url: "/api/logs/missing1-9f38-44fb-bf82-c8f53b310d91",
    headers: {
      Authorization:
        "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InN5d2JoZWNuaDQ2cmhtMCIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoicGJjXzMxNDI2MzU4MjMiLCJleHAiOjI1MjQ2MDQ0NjEsInJlZnJlc2hhYmxlIjp0cnVlfQ.UXgO3j-0BumcugrFjbd7j0M4MQvbrLggLlcu_YNGjoY",
    },
    beforeTest: (app) => {
      const err = StubLogsData(app);
      if (err) {
        throw err;
      }
    },
    expectedStatus: 404,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "log view authorized as superuser (existing request log)",
    method: "GET",
    url: "/api/logs/873f2133-9f38-44fb-bf82-c8f53b310d91",
    headers: {
      Authorization:
        "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InN5d2JoZWNuaDQ2cmhtMCIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoicGJjXzMxNDI2MzU4MjMiLCJleHAiOjI1MjQ2MDQ0NjEsInJlZnJlc2hhYmxlIjp0cnVlfQ.UXgO3j-0BumcugrFjbd7j0M4MQvbrLggLlcu_YNGjoY",
    },
    beforeTest: (app) => {
      const err = StubLogsData(app);
      if (err) {
        throw err;
      }
    },
    expectedStatus: 200,
    expectedContent: ['"id":"873f2133-9f38-44fb-bf82-c8f53b310d91"'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "logs stats unauthorized",
    method: "GET",
    url: "/api/logs/stats",
    expectedStatus: 401,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "logs stats authorized as regular user",
    method: "GET",
    url: "/api/logs/stats",
    headers: {
      Authorization:
        "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjRxMXhsY2xtZmxva3UzMyIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoiX3BiX3VzZXJzX2F1dGhfIiwiZXhwIjoyNTI0NjA0NDYxLCJyZWZyZXNoYWJsZSI6dHJ1ZX0.ZT3F0Z3iM-xbGgSG3LEKiEzHrPHr8t8IuHLZGGNuxLo",
    },
    expectedStatus: 403,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "logs stats authorized as superuser",
    method: "GET",
    url: "/api/logs/stats",
    headers: {
      Authorization:
        "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InN5d2JoZWNuaDQ2cmhtMCIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoicGJjXzMxNDI2MzU4MjMiLCJleHAiOjI1MjQ2MDQ0NjEsInJlZnJlc2hhYmxlIjp0cnVlfQ.UXgO3j-0BumcugrFjbd7j0M4MQvbrLggLlcu_YNGjoY",
    },
    beforeTest: (app) => {
      const err = StubLogsData(app);
      if (err) {
        throw err;
      }
    },
    expectedStatus: 200,
    expectedContent: ['[{"date":"2022-05-01 10:00:00.000Z","total":1},{"date":"2022-05-02 10:00:00.000Z","total":1}]'],
  },
  {
    name: "logs stats authorized as superuser + filter",
    method: "GET",
    url: "/api/logs/stats?filter=data.status>200",
    headers: {
      Authorization:
        "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InN5d2JoZWNuaDQ2cmhtMCIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoicGJjXzMxNDI2MzU4MjMiLCJleHAiOjI1MjQ2MDQ0NjEsInJlZnJlc2hhYmxlIjp0cnVlfQ.UXgO3j-0BumcugrFjbd7j0M4MQvbrLggLlcu_YNGjoY",
    },
    beforeTest: (app) => {
      const err = StubLogsData(app);
      if (err) {
        throw err;
      }
    },
    expectedStatus: 200,
    expectedContent: ['[{"date":"2022-05-02 10:00:00.000Z","total":1}]'],
  },
];

describe("logs api", () => {
  for (const scenario of scenarios) {
    const name = scenario.name ?? `${scenario.method}:${scenario.url}`;
    it(name, async () => {
      await runApiScenario(scenario);
    });
  }
});
