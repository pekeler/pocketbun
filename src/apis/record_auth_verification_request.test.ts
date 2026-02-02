// Ported from pocketbase/apis/record_auth_verification_request_test.go.

import { describe, it } from "bun:test";
import type { TestApp } from "../tests/app.ts";
import { runApiScenario, type ApiScenario } from "../tests/api.ts";

type Scenario = ApiScenario & { todo?: boolean };

const scenarios: Scenario[] = [
  {
    name: "not an auth collection",
    method: "POST",
    url: "/api/collections/demo1/request-verification",
    body: "",
    expectedStatus: 404,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "empty data",
    method: "POST",
    url: "/api/collections/users/request-verification",
    body: "",
    expectedStatus: 400,
    expectedContent: ['"data":{"email":{"code":"validation_required","message":"Cannot be blank."}}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "invalid data",
    method: "POST",
    url: "/api/collections/users/request-verification",
    body: '{"email',
    expectedStatus: 400,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "missing auth record",
    method: "POST",
    url: "/api/collections/users/request-verification",
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
    name: "already verified auth record",
    method: "POST",
    url: "/api/collections/users/request-verification",
    body: '{"email":"test2@example.com"}',
    delayMs: 100,
    expectedStatus: 204,
    expectedEvents: {
      "*": 0,
      OnRecordRequestVerificationRequest: 1,
    },
    afterTest: (app: TestApp) => {
      if (app.testMailer.TotalSend() !== 0) {
        throw new Error(`Expected zero emails, got ${app.testMailer.TotalSend()}`);
      }
    },
  },
  {
    name: "existing auth record",
    method: "POST",
    url: "/api/collections/users/request-verification",
    body: '{"email":"test@example.com"}',
    delayMs: 100,
    expectedStatus: 204,
    expectedEvents: {
      "*": 0,
      OnRecordRequestVerificationRequest: 1,
      OnMailerSend: 1,
      OnMailerRecordVerificationSend: 1,
    },
    afterTest: (app: TestApp) => {
      if (!app.testMailer.LastMessage().HTML.includes("/auth/confirm-verification")) {
        throw new Error(`Expected verification email, got\n${app.testMailer.LastMessage().HTML}`);
      }
    },
  },
  {
    name: "existing auth record (after already sent)",
    method: "POST",
    url: "/api/collections/users/request-verification",
    body: '{"email":"test@example.com"}',
    delayMs: 100,
    expectedStatus: 204,
    expectedEvents: { "*": 0 },
    beforeTest: (app: TestApp) => {
      const authRecord = app.FindFirstRecordByData("users", "email", "test@example.com");
      const resendKey = `@limitVerificationEmail_${authRecord.collection().Id}${authRecord.Id}`;
      app.store().set(resendKey, {});
    },
    afterTest: (app: TestApp) => {
      if (app.testMailer.TotalSend() !== 0) {
        throw new Error(`Expected zero emails, got ${app.testMailer.TotalSend()}`);
      }
    },
  },
  {
    name: "OnRecordRequestVerificationRequest tx body write check",
    method: "POST",
    url: "/api/collections/users/request-verification",
    body: '{"email":"test@example.com"}',
    beforeTest: (app: TestApp) => {
      app.OnRecordRequestVerificationRequest().BindFunc((event: any) => {
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
    expectedEvents: { OnRecordRequestVerificationRequest: 1 },
    expectedContent: ["TX_ERROR"],
  },

  // rate limit checks
  // -----------------------------------------------------------
  {
    name: "RateLimit rule - users:requestVerification",
    method: "POST",
    url: "/api/collections/users/request-verification",
    body: '{"email":"test@example.com"}',
    beforeTest: (app) => {
      app.settings().rateLimits.enabled = true;
      app.settings().rateLimits.rules = [
        { maxRequests: 100, label: "abc", duration: 1 },
        { maxRequests: 100, label: "*:requestVerification", duration: 1 },
        { maxRequests: 0, label: "users:requestVerification", duration: 1 },
      ];
    },
    expectedStatus: 429,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "RateLimit rule - *:requestVerification",
    method: "POST",
    url: "/api/collections/users/request-verification",
    body: '{"email":"test@example.com"}',
    beforeTest: (app) => {
      app.settings().rateLimits.enabled = true;
      app.settings().rateLimits.rules = [
        { maxRequests: 100, label: "abc", duration: 1 },
        { maxRequests: 0, label: "*:requestVerification", duration: 1 },
      ];
    },
    expectedStatus: 429,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
];

describe("record auth verification request", () => {
  for (const scenario of scenarios) {
    const name = scenario.name ?? "scenario";
    it(name, async () => {
      await runApiScenario(scenario);
    });
  }
});
