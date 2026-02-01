// Ported from pocketbase/apis/record_auth_impersonate_test.go

import { describe, it } from "bun:test";
import { runApiScenario, type ApiScenario } from "../../tests/api.ts";

const superuserToken =
  "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InN5d2JoZWNuaDQ2cmhtMCIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoicGJjXzMxNDI2MzU4MjMiLCJleHAiOjI1MjQ2MDQ0NjEsInJlZnJlc2hhYmxlIjp0cnVlfQ.UXgO3j-0BumcugrFjbd7j0M4MQvbrLggLlcu_YNGjoY";

const otherUserToken =
  "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6Im9hcDY0MGNvdDR5cnUycyIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoiX3BiX3VzZXJzX2F1dGhfIiwiZXhwIjoyNTI0NjA0NDYxLCJyZWZyZXNoYWJsZSI6dHJ1ZX0.GfJo6EHIobgas_AXt-M-tj5IoQendPnrkMSe9ExuSEY";

const userToken =
  "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjRxMXhsY2xtZmxva3UzMyIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoiX3BiX3VzZXJzX2F1dGhfIiwiZXhwIjoyNTI0NjA0NDYxLCJyZWZyZXNoYWJsZSI6dHJ1ZX0.ZT3F0Z3iM-xbGgSG3LEKiEzHrPHr8t8IuHLZGGNuxLo";

const scenarios: ApiScenario[] = [
  {
    name: "unauthorized",
    method: "POST",
    url: "/api/collections/users/impersonate/4q1xlclmfloku33",
    expectedStatus: 401,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "authorized as different user",
    method: "POST",
    url: "/api/collections/users/impersonate/4q1xlclmfloku33",
    headers: { Authorization: otherUserToken },
    expectedStatus: 403,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "authorized as the same user",
    method: "POST",
    url: "/api/collections/users/impersonate/4q1xlclmfloku33",
    headers: { Authorization: userToken },
    expectedStatus: 403,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "authorized as superuser",
    method: "POST",
    url: "/api/collections/users/impersonate/4q1xlclmfloku33",
    headers: { Authorization: superuserToken },
    expectedStatus: 200,
    expectedContent: ['"token":"', '"id":"4q1xlclmfloku33"', '"record":{'],
    notExpectedContent: ['"tokenKey"', '"password"'],
    expectedEvents: {
      "*": 0,
      OnRecordAuthRequest: 1,
      OnRecordEnrich: 1,
    },
  },
  {
    name: "authorized as superuser with custom invalid duration",
    method: "POST",
    url: "/api/collections/users/impersonate/4q1xlclmfloku33",
    headers: { Authorization: superuserToken },
    body: JSON.stringify({ duration: -1 }),
    expectedStatus: 400,
    expectedContent: ['"data":{', '"duration":{'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "authorized as superuser with custom valid duration",
    method: "POST",
    url: "/api/collections/users/impersonate/4q1xlclmfloku33",
    headers: { Authorization: superuserToken },
    body: JSON.stringify({ duration: 100 }),
    expectedStatus: 200,
    expectedContent: ['"token":"', '"id":"4q1xlclmfloku33"', '"record":{'],
    expectedEvents: {
      "*": 0,
      OnRecordAuthRequest: 1,
      OnRecordEnrich: 1,
    },
  },
];

describe("record auth impersonate", () => {
  it("scenarios", async () => {
    for (const scenario of scenarios) {
      await runApiScenario(scenario);
    }
  });
});
