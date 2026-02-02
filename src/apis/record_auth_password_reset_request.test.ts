// Ported from pocketbase/apis/record_auth_password_reset_request_test.go.

import { describe, it } from "bun:test";
import type { TestApp } from "../tests/app.ts";
import { runApiScenario, type ApiScenario } from "../tests/api.ts";

type Scenario = ApiScenario & { todo?: boolean };

const scenarios: Scenario[] = [
  {
    name: "not an auth collection",
    method: "POST",
    url: "/api/collections/demo1/request-password-reset",
    body: "",
    expectedStatus: 404,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "empty data",
    method: "POST",
    url: "/api/collections/users/request-password-reset",
    body: "",
    expectedStatus: 400,
    expectedContent: ['"data":{"email":{"code":"validation_required","message":"Cannot be blank."}}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "invalid data",
    method: "POST",
    url: "/api/collections/users/request-password-reset",
    body: '{"email',
    expectedStatus: 400,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "existing auth record in a collection with disabled password login",
    method: "POST",
    url: "/api/collections/nologin/request-password-reset",
    body: '{"email":"test@example.com"}',
    expectedStatus: 400,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "missing auth record",
    method: "POST",
    url: "/api/collections/users/request-password-reset",
    body: '{"email":"missing@example.com"}',
    delayMs: 100,
    expectedStatus: 204,
    expectedEvents: { "*": 0 },
    afterTest: (app: TestApp) => {
      if (app.testMailer.TotalSend() !== 0) {
        throw new Error(`Expected zero emails, got ${app.testMailer.TotalSend()}`);
      }
    },
  },
  {
    name: "existing auth record",
    method: "POST",
    url: "/api/collections/users/request-password-reset",
    body: '{"email":"test@example.com"}',
    delayMs: 100,
    expectedStatus: 204,
    expectedEvents: {
      "*": 0,
      OnRecordRequestPasswordResetRequest: 1,
      OnMailerSend: 1,
      OnMailerRecordPasswordResetSend: 1,
    },
    afterTest: (app: TestApp) => {
      if (!app.testMailer.LastMessage().HTML.includes("/auth/confirm-password-reset")) {
        throw new Error(`Expected password reset email, got\n${app.testMailer.LastMessage().HTML}`);
      }
    },
  },
  {
    name: "existing auth record (after already sent)",
    method: "POST",
    url: "/api/collections/users/request-password-reset",
    body: '{"email":"test@example.com"}',
    delayMs: 100,
    expectedStatus: 204,
    expectedEvents: { "*": 0 },
    beforeTest: (app: TestApp) => {
      const authRecord = app.FindAuthRecordByEmail("users", "test@example.com");
      const resendKey = `@limitPasswordResetEmail_${authRecord.collection().Id}${authRecord.Id}`;
      app.store().set(resendKey, {});
    },
  },
  {
    name: "OnRecordRequestPasswordResetRequest tx body write check",
    method: "POST",
    url: "/api/collections/users/request-password-reset",
    body: '{"email":"test@example.com"}',
    beforeTest: (app: TestApp) => {
      app.OnRecordRequestPasswordResetRequest().BindFunc((event: any) => {
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
    expectedEvents: { OnRecordRequestPasswordResetRequest: 1 },
    expectedContent: ["TX_ERROR"],
  },

  // rate limit checks
  // -----------------------------------------------------------
  {
    name: "RateLimit rule - users:requestPasswordReset",
    method: "POST",
    url: "/api/collections/users/request-password-reset",
    body: '{"email":"missing@example.com"}',
    beforeTest: (app) => {
      app.settings().rateLimits.enabled = true;
      app.settings().rateLimits.rules = [
        { maxRequests: 100, label: "abc", duration: 1 },
        { maxRequests: 100, label: "*:requestPasswordReset", duration: 1 },
        { maxRequests: 0, label: "users:requestPasswordReset", duration: 1 },
      ];
    },
    expectedStatus: 429,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "RateLimit rule - *:requestPasswordReset",
    method: "POST",
    url: "/api/collections/users/request-password-reset",
    body: '{"email":"missing@example.com"}',
    beforeTest: (app) => {
      app.settings().rateLimits.enabled = true;
      app.settings().rateLimits.rules = [
        { maxRequests: 100, label: "abc", duration: 1 },
        { maxRequests: 0, label: "*:requestPasswordReset", duration: 1 },
      ];
    },
    expectedStatus: 429,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
];

describe("record auth password reset request", () => {
  for (const scenario of scenarios) {
    const name = scenario.name ?? "scenario";
    it(name, async () => {
      await runApiScenario(scenario);
    });
  }
});
