// Ported from pocketbase/apis/record_auth_otp_request_test.go.

import { describe, it } from "bun:test";
import type { TestApp } from "../tests/app.ts";
import { CollectionNameOTPs, NewOTP } from "../core/otp_model.ts";
import { runApiScenario, type ApiScenario } from "../tests/api.ts";
import { NowDateTime } from "../tools/types/index.ts";

type Scenario = ApiScenario & { todo?: boolean };

const scenarios: Scenario[] = [
  {
    name: "not an auth collection",
    method: "POST",
    url: "/api/collections/demo1/request-otp",
    body: '{"email":"test@example.com"}',
    expectedStatus: 404,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "auth collection with disabled otp",
    method: "POST",
    url: "/api/collections/users/request-otp",
    body: '{"email":"test@example.com"}',
    beforeTest: async (app: TestApp) => {
      const usersCol = app.findCollectionByNameOrIdOrNull("users");
      if (!usersCol) {
        throw new Error("Missing users collection");
      }
      usersCol.OTP.Enabled = false;
      const err = await app.Save(usersCol);
      if (err) {
        throw new Error(err.message);
      }
    },
    expectedStatus: 403,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "empty body",
    method: "POST",
    url: "/api/collections/users/request-otp",
    body: "",
    expectedStatus: 400,
    expectedContent: ['"data":{"email":{"code":"validation_required"'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "invalid body",
    method: "POST",
    url: "/api/collections/users/request-otp",
    body: '{"email',
    expectedStatus: 400,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "invalid request data",
    method: "POST",
    url: "/api/collections/users/request-otp",
    body: '{"email":"invalid"}',
    expectedStatus: 400,
    expectedContent: ['"data":{', '"email":{"code":"validation_is_email"'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "missing auth record",
    method: "POST",
    url: "/api/collections/users/request-otp",
    body: '{"email":"missing@example.com"}',
    delayMs: 100,
    expectedStatus: 200,
    expectedContent: ['"otpId":"'],
    expectedEvents: {
      "*": 0,
      OnRecordCreateOTPRequest: 1,
    },
    afterTest: async (app) => {
      if (app.testMailer.TotalSend() !== 0) {
        throw new Error(`Expected zero emails, got ${app.testMailer.TotalSend()}`);
      }
    },
  },
  {
    name: "existing auth record (with < 9 non-expired)",
    method: "POST",
    url: "/api/collections/users/request-otp",
    body: '{"email":"test@example.com"}',
    delayMs: 100,
    beforeTest: async (app: TestApp) => {
      const user = app.FindAuthRecordByEmail("users", "test@example.com");
      for (let i = 0; i < 10; i += 1) {
        const otp = NewOTP(app);
        otp.Id = `otp_${i}`;
        otp.SetCollectionRef(user.collection().Id);
        otp.SetRecordRef(user.Id);
        otp.ProxyRecord().SetPassword("123456");
        if (i >= 8) {
          const expired = NowDateTime().addDate(-3, 0, 0);
          otp.ProxyRecord().SetRaw("created", expired);
          otp.ProxyRecord().SetRaw("updated", expired);
        }
        const err = await app.SaveNoValidate(otp);
        if (err) {
          throw new Error(err.message);
        }
      }
    },
    expectedStatus: 200,
    expectedContent: ['"otpId":"'],
    notExpectedContent: ['"otpId":"otp_'],
    expectedEvents: {
      "*": 0,
      OnRecordCreateOTPRequest: 1,
      OnMailerSend: 1,
      OnMailerRecordOTPSend: 1,
      OnModelCreate: 1,
      OnModelCreateExecute: 1,
      OnModelAfterCreateSuccess: 1,
      OnModelValidate: 2,
      OnRecordCreate: 1,
      OnRecordCreateExecute: 1,
      OnRecordAfterCreateSuccess: 1,
      OnRecordValidate: 2,
      OnModelUpdate: 1,
      OnModelUpdateExecute: 1,
      OnModelAfterUpdateSuccess: 1,
      OnRecordUpdate: 1,
      OnRecordUpdateExecute: 1,
      OnRecordAfterUpdateSuccess: 1,
    },
    afterTest: async (app: TestApp) => {
      if (app.testMailer.TotalSend() !== 1) {
        throw new Error(`Expected 1 email, got ${app.testMailer.TotalSend()}`);
      }
      const otps = app.FindRecordsByFilter(CollectionNameOTPs, "sentTo='test@example.com'", "", 0, 0);
      if (otps.length !== 1) {
        throw new Error(`Expected 1 OTP with sentTo test@example.com, got ${otps.length}`);
      }
    },
  },
  {
    name: "existing auth record with intercepted email (with < 9 non-expired)",
    method: "POST",
    url: "/api/collections/users/request-otp",
    body: '{"email":"test@example.com"}',
    delayMs: 100,
    beforeTest: async (app: TestApp) => {
      app.OnMailerRecordOTPSend().BindFunc(() => null);
    },
    expectedStatus: 200,
    expectedContent: ['"otpId":"'],
    notExpectedContent: ['"otpId":"otp_'],
    expectedEvents: {
      "*": 0,
      OnRecordCreateOTPRequest: 1,
      OnMailerRecordOTPSend: 1,
      OnModelCreate: 1,
      OnModelCreateExecute: 1,
      OnModelAfterCreateSuccess: 1,
      OnModelValidate: 1,
      OnRecordCreate: 1,
      OnRecordCreateExecute: 1,
      OnRecordAfterCreateSuccess: 1,
      OnRecordValidate: 1,
    },
    afterTest: async (app: TestApp) => {
      if (app.testMailer.TotalSend() !== 0) {
        throw new Error(`Expected 0 emails, got ${app.testMailer.TotalSend()}`);
      }
      const otps = app.FindRecordsByFilter(CollectionNameOTPs, "sentTo='test@example.com'", "", 0, 0);
      if (otps.length !== 0) {
        throw new Error(`Expected 0 OTPs with sentTo, got ${otps.length}`);
      }
    },
  },
  {
    name: "existing auth record (with > 9 non-expired)",
    method: "POST",
    url: "/api/collections/users/request-otp",
    body: '{"email":"test@example.com"}',
    delayMs: 100,
    beforeTest: async (app: TestApp) => {
      const user = app.FindAuthRecordByEmail("users", "test@example.com");
      for (let i = 0; i < 10; i += 1) {
        const otp = NewOTP(app);
        otp.Id = `otp_${i}`;
        otp.SetCollectionRef(user.collection().Id);
        otp.SetRecordRef(user.Id);
        otp.ProxyRecord().SetPassword("123456");
        const created = NowDateTime().Add(-1000 + i);
        otp.ProxyRecord().SetRaw("created", created);
        otp.ProxyRecord().SetRaw("updated", created);
        const err = await app.SaveNoValidate(otp);
        if (err) {
          throw new Error(err.message);
        }
      }
    },
    expectedStatus: 200,
    expectedContent: ['"otpId":"otp_9"'],
    expectedEvents: {
      "*": 0,
      OnRecordCreateOTPRequest: 1,
    },
    afterTest: async (app: TestApp) => {
      if (app.testMailer.TotalSend() !== 0) {
        throw new Error(`Expected 0 sent emails, got ${app.testMailer.TotalSend()}`);
      }
    },
  },
  {
    name: "OnRecordRequestOTPRequest tx body write check",
    method: "POST",
    url: "/api/collections/users/request-otp",
    body: '{"email":"test@example.com"}',
    delayMs: 100,
    beforeTest: async (app: TestApp) => {
      app.OnRecordCreateOTPRequest().BindFunc(async (event: any) => {
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
    expectedContent: ["TX_ERROR"],
    expectedEvents: { OnRecordCreateOTPRequest: 1 },
  },
  {
    name: "RateLimit rule - users:requestOTP",
    method: "POST",
    url: "/api/collections/users/request-otp",
    body: '{"email":"test@example.com"}',
    beforeTest: (app) => {
      app.settings().rateLimits.enabled = true;
      app.settings().rateLimits.rules = [
        { maxRequests: 100, label: "abc", duration: 1 },
        { maxRequests: 100, label: "*:requestOTP", duration: 1 },
        { maxRequests: 0, label: "users:requestOTP", duration: 1 },
      ];
    },
    expectedStatus: 429,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "RateLimit rule - *:requestOTP",
    method: "POST",
    url: "/api/collections/users/request-otp",
    body: '{"email":"test@example.com"}',
    beforeTest: (app) => {
      app.settings().rateLimits.enabled = true;
      app.settings().rateLimits.rules = [
        { maxRequests: 100, label: "abc", duration: 1 },
        { maxRequests: 0, label: "*:requestOTP", duration: 1 },
      ];
    },
    expectedStatus: 429,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
];

describe("record request OTP", () => {
  for (const scenario of scenarios) {
    const name = scenario.name ?? `${scenario.method}:${scenario.url}`;
    it(name, async () => {
      await runApiScenario(scenario);
    });
  }
});
