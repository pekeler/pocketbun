// Ported from pocketbase/apis/record_auth_refresh_test.go.

import { describe, it } from "bun:test";
import { runApiScenario, type ApiScenario } from "../tests/api.ts";

const superuserToken =
  "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InN5d2JoZWNuaDQ2cmhtMCIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoicGJjXzMxNDI2MzU4MjMiLCJleHAiOjI1MjQ2MDQ0NjEsInJlZnJlc2hhYmxlIjp0cnVlfQ.UXgO3j-0BumcugrFjbd7j0M4MQvbrLggLlcu_YNGjoY";

const userToken =
  "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjRxMXhsY2xtZmxva3UzMyIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoiX3BiX3VzZXJzX2F1dGhfIiwiZXhwIjoyNTI0NjA0NDYxLCJyZWZyZXNoYWJsZSI6dHJ1ZX0.ZT3F0Z3iM-xbGgSG3LEKiEzHrPHr8t8IuHLZGGNuxLo";

const unrefreshableUserToken =
  "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjRxMXhsY2xtZmxva3UzMyIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoiX3BiX3VzZXJzX2F1dGhfIiwiZXhwIjoyNTI0NjA0NDYxLCJyZWZyZXNoYWJsZSI6ZmFsc2V9.4IsO6YMsR19crhwl_YWzvRH8pfq2Ri4Gv2dzGyneLak";

const unverifiedClientToken =
  "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6Im8xeTBkZDBzcGQ3ODZtZCIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoidjg1MXE0cjc5MHJoa25sIiwiZXhwIjoyNTI0NjA0NDYxLCJyZWZyZXNoYWJsZSI6dHJ1ZX0.Zi0yXE-CNmnbTdVaQEzYZVuECqRdn3LgEM6pmB3XWBE";

const verifiedClientToken =
  "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6ImdrMzkwcWVnczR5NDd3biIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoidjg1MXE0cjc5MHJoa25sIiwiZXhwIjoyNTI0NjA0NDYxLCJyZWZyZXNoYWJsZSI6dHJ1ZX0.0ONnm_BsvPRZyDNT31GN1CKUB6uQRxvVvQ-Wc9AZfG0";

type Scenario = ApiScenario & { todo?: boolean };

const scenarios: Scenario[] = [
  {
    name: "unauthorized",
    method: "POST",
    url: "/api/collections/users/auth-refresh",
    expectedStatus: 401,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "superuser trying to refresh the auth of another auth collection",
    method: "POST",
    url: "/api/collections/users/auth-refresh",
    headers: { Authorization: superuserToken },
    expectedStatus: 403,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "auth record + not an auth collection",
    method: "POST",
    url: "/api/collections/demo1/auth-refresh",
    headers: { Authorization: userToken },
    expectedStatus: 403,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "auth record + different auth collection",
    method: "POST",
    url: "/api/collections/clients/auth-refresh?expand=rel,missing",
    headers: { Authorization: userToken },
    expectedStatus: 403,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "auth record + same auth collection as the token",
    method: "POST",
    url: "/api/collections/users/auth-refresh?expand=rel,missing",
    headers: { Authorization: userToken },
    expectedStatus: 200,
    expectedContent: [
      '"token":',
      '"record":',
      '"id":"4q1xlclmfloku33"',
      '"emailVisibility":false',
      '"email":"test@example.com"',
      '"expand":',
      '"rel":',
      '"id":"llvuca81nly1qls"',
    ],
    notExpectedContent: ['"missing":', userToken],
    expectedEvents: {
      "*": 0,
      OnRecordAuthRefreshRequest: 1,
      OnRecordAuthRequest: 1,
      OnRecordEnrich: 2,
    },
  },
  {
    name: "auth record + same auth collection as the token but static/unrefreshable",
    method: "POST",
    url: "/api/collections/users/auth-refresh",
    headers: { Authorization: unrefreshableUserToken },
    expectedStatus: 200,
    expectedContent: [
      `"token":"${unrefreshableUserToken}"`,
      '"record":',
      '"id":"4q1xlclmfloku33"',
      '"emailVisibility":false',
      '"email":"test@example.com"',
    ],
    expectedEvents: {
      "*": 0,
      OnRecordAuthRefreshRequest: 1,
      OnRecordAuthRequest: 1,
      OnRecordEnrich: 1,
    },
  },
  {
    name: "unverified auth record in onlyVerified collection",
    method: "POST",
    url: "/api/collections/clients/auth-refresh",
    headers: { Authorization: unverifiedClientToken },
    expectedStatus: 403,
    expectedContent: ['"data":{}'],
    expectedEvents: {
      "*": 0,
      OnRecordAuthRefreshRequest: 1,
    },
  },
  {
    name: "verified auth record in onlyVerified collection",
    method: "POST",
    url: "/api/collections/clients/auth-refresh",
    headers: { Authorization: verifiedClientToken },
    expectedStatus: 200,
    expectedContent: ['"token":', '"record":', '"id":"gk390qegs4y47wn"', '"verified":true', '"email":"test@example.com"'],
    expectedEvents: {
      "*": 0,
      OnRecordAuthRefreshRequest: 1,
      OnRecordAuthRequest: 1,
      OnRecordEnrich: 1,
    },
  },
  {
    name: "OnRecordAuthRefreshRequest tx body write check",
    method: "POST",
    url: "/api/collections/users/auth-refresh",
    headers: { Authorization: userToken },
    beforeTest: (app) => {
      app.OnRecordAuthRefreshRequest().BindFunc((event: any) => {
        const original = event.App;
        event.App.RunInTransaction((txApp: any) => {
          event.App = txApp;
          void event.Next();
          event.App = original;
          return new Error("TX_ERROR");
        });

        return event.RequestEvent.json(400, {
          status: 400,
          message: "TX_ERROR",
          data: {},
        });
      });
    },
    expectedStatus: 400,
    expectedContent: ["TX_ERROR"],
    expectedEvents: { OnRecordAuthRefreshRequest: 1 },
  },
  {
    name: "RateLimit rule - users:authRefresh",
    method: "POST",
    url: "/api/collections/users/auth-refresh",
    beforeTest: (app) => {
      app.settings().rateLimits.enabled = true;
      app.settings().rateLimits.rules = [
        { maxRequests: 100, label: "abc", duration: 1 },
        { maxRequests: 100, label: "*:authRefresh", duration: 1 },
        { maxRequests: 0, label: "users:authRefresh", duration: 1 },
      ];
    },
    expectedStatus: 429,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "RateLimit rule - *:authRefresh",
    method: "POST",
    url: "/api/collections/users/auth-refresh",
    beforeTest: (app) => {
      app.settings().rateLimits.enabled = true;
      app.settings().rateLimits.rules = [
        { maxRequests: 100, label: "abc", duration: 1 },
        { maxRequests: 0, label: "*:authRefresh", duration: 1 },
      ];
    },
    expectedStatus: 429,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
];

describe("record auth refresh", () => {
  for (const scenario of scenarios) {
    const name = scenario.name ?? `${scenario.method}:${scenario.url}`;
    it(name, async () => {
      await runApiScenario(scenario);
    });
  }
});
