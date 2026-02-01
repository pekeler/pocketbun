// Ported from pocketbase/apis/record_auth_email_change_confirm_test.go.

import { describe, it } from "bun:test";
import { runApiScenario, type ApiScenario } from "../../tests/api.ts";

type Scenario = ApiScenario & { todo?: boolean };

const scenarios: Scenario[] = [
  {
    name: "not an auth collection",
    method: "POST",
    url: "/api/collections/demo1/confirm-email-change",
    expectedStatus: 404,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "empty data",
    method: "POST",
    url: "/api/collections/users/confirm-email-change",
    body: "",
    expectedStatus: 400,
    expectedContent: ['"data":', '"token":{"code":"validation_required"', '"password":{"code":"validation_required"'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "invalid data",
    method: "POST",
    url: "/api/collections/users/confirm-email-change",
    body: '{"token',
    expectedStatus: 400,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "expired token and correct password",
    method: "POST",
    url: "/api/collections/users/confirm-email-change",
    body: `{
      "token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjRxMXhsY2xtZmxva3UzMyIsImNvbGxlY3Rpb25JZCI6Il9wYl91c2Vyc19hdXRoXyIsInR5cGUiOiJlbWFpbENoYW5nZSIsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsIm5ld0VtYWlsIjoiY2hhbmdlQGV4YW1wbGUuY29tIiwiZXhwIjoxNjQwOTkxNjYxfQ.dff842MO0mgRTHY8dktp0dqG9-7LGQOgRuiAbQpYBls",
      "password":"1234567890"
    }`,
    expectedStatus: 400,
    expectedContent: ['"data":{', '"token":{', '"code":"validation_invalid_token"'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "non-email change token",
    method: "POST",
    url: "/api/collections/users/confirm-email-change",
    body: `{
      "token":"eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjRxMXhsY2xtZmxva3UzMyIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoiX3BiX3VzZXJzX2F1dGhfIiwiZXhwIjoyNTI0NjA0NDYxLCJyZWZyZXNoYWJsZSI6dHJ1ZX0.ZT3F0Z3iM-xbGgSG3LEKiEzHrPHr8t8IuHLZGGNuxLo",
      "password":"1234567890"
    }`,
    expectedStatus: 400,
    expectedContent: ['"data":{', '"token":{', '"code":"validation_invalid_token_payload"'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "valid token and incorrect password",
    method: "POST",
    url: "/api/collections/users/confirm-email-change",
    body: `{
      "token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjRxMXhsY2xtZmxva3UzMyIsImNvbGxlY3Rpb25JZCI6Il9wYl91c2Vyc19hdXRoXyIsInR5cGUiOiJlbWFpbENoYW5nZSIsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsIm5ld0VtYWlsIjoiY2hhbmdlQGV4YW1wbGUuY29tIiwiZXhwIjoyNTI0NjA0NDYxfQ.Y7mVlaEPhJiNPoIvIqbIosZU4c4lEhwysOrRR8c95iU",
      "password":"1234567891"
    }`,
    expectedStatus: 400,
    expectedContent: ['"data":{', '"password":{', '"code":"validation_invalid_password"'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "valid token and correct password",
    method: "POST",
    url: "/api/collections/users/confirm-email-change",
    body: `{
      "token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjRxMXhsY2xtZmxva3UzMyIsImNvbGxlY3Rpb25JZCI6Il9wYl91c2Vyc19hdXRoXyIsInR5cGUiOiJlbWFpbENoYW5nZSIsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsIm5ld0VtYWlsIjoiY2hhbmdlQGV4YW1wbGUuY29tIiwiZXhwIjoyNTI0NjA0NDYxfQ.Y7mVlaEPhJiNPoIvIqbIosZU4c4lEhwysOrRR8c95iU",
      "password":"1234567890"
    }`,
    expectedStatus: 204,
    expectedEvents: {
      "*": 0,
      OnRecordConfirmEmailChangeRequest: 1,
      OnModelUpdate: 1,
      OnModelUpdateExecute: 1,
      OnModelAfterUpdateSuccess: 1,
      OnModelValidate: 1,
      OnRecordUpdate: 1,
      OnRecordUpdateExecute: 1,
      OnRecordAfterUpdateSuccess: 1,
      OnRecordValidate: 1,
    },
    afterTest: (app) => {
      app.FindAuthRecordByEmail("users", "change@example.com");
    },
  },
  {
    name: "valid token in different auth collection",
    method: "POST",
    url: "/api/collections/clients/confirm-email-change",
    body: `{
      "token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjRxMXhsY2xtZmxva3UzMyIsImNvbGxlY3Rpb25JZCI6Il9wYl91c2Vyc19hdXRoXyIsInR5cGUiOiJlbWFpbENoYW5nZSIsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsIm5ld0VtYWlsIjoiY2hhbmdlQGV4YW1wbGUuY29tIiwiZXhwIjoyNTI0NjA0NDYxfQ.Y7mVlaEPhJiNPoIvIqbIosZU4c4lEhwysOrRR8c95iU",
      "password":"1234567890"
    }`,
    expectedStatus: 400,
    expectedContent: ['"data":{', '"token":{"code":"validation_token_collection_mismatch"'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "OnRecordConfirmEmailChangeRequest tx body write check",
    method: "POST",
    url: "/api/collections/users/confirm-email-change",
    body: `{
      "token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjRxMXhsY2xtZmxva3UzMyIsImNvbGxlY3Rpb25JZCI6Il9wYl91c2Vyc19hdXRoXyIsInR5cGUiOiJlbWFpbENoYW5nZSIsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsIm5ld0VtYWlsIjoiY2hhbmdlQGV4YW1wbGUuY29tIiwiZXhwIjoyNTI0NjA0NDYxfQ.Y7mVlaEPhJiNPoIvIqbIosZU4c4lEhwysOrRR8c95iU",
      "password":"1234567890"
    }`,
    beforeTest: (app) => {
      app.OnRecordConfirmEmailChangeRequest().BindFunc((event: any) => {
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
    expectedEvents: { OnRecordConfirmEmailChangeRequest: 1 },
    expectedContent: ["TX_ERROR"],
  },

  // rate limit checks
  // -----------------------------------------------------------
  {
    name: "RateLimit rule - users:confirmEmailChange",
    method: "POST",
    url: "/api/collections/users/confirm-email-change",
    body: `{
      "token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjRxMXhsY2xtZmxva3UzMyIsImNvbGxlY3Rpb25JZCI6Il9wYl91c2Vyc19hdXRoXyIsInR5cGUiOiJlbWFpbENoYW5nZSIsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsIm5ld0VtYWlsIjoiY2hhbmdlQGV4YW1wbGUuY29tIiwiZXhwIjoyNTI0NjA0NDYxfQ.Y7mVlaEPhJiNPoIvIqbIosZU4c4lEhwysOrRR8c95iU",
      "password":"1234567890"
    }`,
    beforeTest: (app) => {
      app.settings().rateLimits.enabled = true;
      app.settings().rateLimits.rules = [
        { maxRequests: 100, label: "abc", duration: 1 },
        { maxRequests: 100, label: "*:confirmEmailChange", duration: 1 },
        { maxRequests: 0, label: "users:confirmEmailChange", duration: 1 },
      ];
    },
    expectedStatus: 429,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "RateLimit rule - *:confirmEmailChange",
    method: "POST",
    url: "/api/collections/users/confirm-email-change",
    body: `{
      "token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjRxMXhsY2xtZmxva3UzMyIsImNvbGxlY3Rpb25JZCI6Il9wYl91c2Vyc19hdXRoXyIsInR5cGUiOiJlbWFpbENoYW5nZSIsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsIm5ld0VtYWlsIjoiY2hhbmdlQGV4YW1wbGUuY29tIiwiZXhwIjoyNTI0NjA0NDYxfQ.Y7mVlaEPhJiNPoIvIqbIosZU4c4lEhwysOrRR8c95iU",
      "password":"1234567890"
    }`,
    beforeTest: (app) => {
      app.settings().rateLimits.enabled = true;
      app.settings().rateLimits.rules = [
        { maxRequests: 100, label: "abc", duration: 1 },
        { maxRequests: 0, label: "*:confirmEmailChange", duration: 1 },
      ];
    },
    expectedStatus: 429,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
];

describe("record auth email change confirm", () => {
  for (const scenario of scenarios) {
    const name = scenario.name ?? "scenario";
    it(name, async () => {
      await runApiScenario(scenario);
    });
  }
});
