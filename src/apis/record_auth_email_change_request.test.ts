// Ported from pocketbase/apis/record_auth_email_change_request_test.go.

import { describe, it } from "bun:test";
import { runApiScenario, type ApiScenario } from "../tests/api.ts";

const regularUserToken =
  "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjRxMXhsY2xtZmxva3UzMyIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoiX3BiX3VzZXJzX2F1dGhfIiwiZXhwIjoyNTI0NjA0NDYxLCJyZWZyZXNoYWJsZSI6dHJ1ZX0.ZT3F0Z3iM-xbGgSG3LEKiEzHrPHr8t8IuHLZGGNuxLo";

const superuserToken =
  "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InN5d2JoZWNuaDQ2cmhtMCIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoicGJjXzMxNDI2MzU4MjMiLCJleHAiOjI1MjQ2MDQ0NjEsInJlZnJlc2hhYmxlIjp0cnVlfQ.UXgO3j-0BumcugrFjbd7j0M4MQvbrLggLlcu_YNGjoY";

type Scenario = ApiScenario & { todo?: boolean };

const scenarios: Scenario[] = [
  {
    name: "unauthorized",
    method: "POST",
    url: "/api/collections/users/request-email-change",
    body: '{"newEmail":"change@example.com"}',
    expectedStatus: 401,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "not an auth collection",
    method: "POST",
    url: "/api/collections/demo1/request-email-change",
    body: '{"newEmail":"change@example.com"}',
    expectedStatus: 401,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "record authentication but from different auth collection",
    method: "POST",
    url: "/api/collections/clients/request-email-change",
    body: '{"newEmail":"change@example.com"}',
    headers: { Authorization: regularUserToken },
    expectedStatus: 403,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "superuser authentication",
    method: "POST",
    url: "/api/collections/users/request-email-change",
    body: '{"newEmail":"change@example.com"}',
    headers: { Authorization: superuserToken },
    expectedStatus: 403,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "invalid data",
    method: "POST",
    url: "/api/collections/users/request-email-change",
    body: '{"newEmail',
    headers: { Authorization: regularUserToken },
    expectedStatus: 400,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "empty data",
    method: "POST",
    url: "/api/collections/users/request-email-change",
    body: "{}",
    headers: { Authorization: regularUserToken },
    expectedStatus: 400,
    expectedContent: ['"data":', '"newEmail":{"code":"validation_required"'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "valid data (existing email)",
    method: "POST",
    url: "/api/collections/users/request-email-change",
    body: '{"newEmail":"test2@example.com"}',
    headers: { Authorization: regularUserToken },
    expectedStatus: 400,
    expectedContent: ['"data":', '"newEmail":{"code":"validation_invalid_new_email"'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "valid data (new email)",
    method: "POST",
    url: "/api/collections/users/request-email-change",
    body: '{"newEmail":"change@example.com"}',
    headers: { Authorization: regularUserToken },
    expectedStatus: 204,
    expectedEvents: {
      "*": 0,
      OnRecordRequestEmailChangeRequest: 1,
      OnMailerSend: 1,
      OnMailerRecordEmailChangeSend: 1,
    },
    afterTest: (app) => {
      if (!app.testMailer.LastMessage().HTML.includes("/auth/confirm-email-change")) {
        throw new Error(`Expected email change email, got\n${app.testMailer.LastMessage().HTML}`);
      }
    },
  },
  {
    name: "OnRecordRequestEmailChangeRequest tx body write check",
    method: "POST",
    url: "/api/collections/users/request-email-change",
    body: '{"newEmail":"change@example.com"}',
    headers: { Authorization: regularUserToken },
    beforeTest: (app) => {
      app.OnRecordRequestEmailChangeRequest().BindFunc(async (event: any) => {
        const original = event.App;
        await event.App.RunInTransaction(async (txApp: any) => {
          event.App = txApp;
          await event.Next();
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
    expectedEvents: { OnRecordRequestEmailChangeRequest: 1 },
    expectedContent: ["TX_ERROR"],
  },

  // rate limit checks
  // -----------------------------------------------------------
  {
    name: "RateLimit rule - users:requestEmailChange",
    method: "POST",
    url: "/api/collections/users/request-email-change",
    body: '{"newEmail":"change@example.com"}',
    headers: { Authorization: regularUserToken },
    beforeTest: (app) => {
      app.settings().rateLimits.enabled = true;
      app.settings().rateLimits.rules = [
        { maxRequests: 100, label: "abc", duration: 1 },
        { maxRequests: 100, label: "*:requestEmailChange", duration: 1 },
        { maxRequests: 0, label: "users:requestEmailChange", duration: 1 },
      ];
    },
    expectedStatus: 429,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "RateLimit rule - *:requestEmailChange",
    method: "POST",
    url: "/api/collections/users/request-email-change",
    body: '{"newEmail":"change@example.com"}',
    headers: { Authorization: regularUserToken },
    beforeTest: (app) => {
      app.settings().rateLimits.enabled = true;
      app.settings().rateLimits.rules = [
        { maxRequests: 100, label: "abc", duration: 1 },
        { maxRequests: 0, label: "*:requestEmailChange", duration: 1 },
      ];
    },
    expectedStatus: 429,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
];

describe("record auth email change request", () => {
  for (const scenario of scenarios) {
    const name = scenario.name ?? "scenario";
    it(name, async () => {
      await runApiScenario(scenario);
    });
  }
});
