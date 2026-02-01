// Ported from pocketbase/apis/record_auth_with_otp_test.go.
// Note: rate limit scenarios are TODO until rate limiting middleware is ported.

import { describe, it } from "bun:test";
import type { TestApp } from "../../tests/test_app.ts";
import { runApiScenario, type ApiScenario } from "../../tests/api.ts";
import { RequestInfoContextOTP } from "../core/event_request.ts";
import { NewOTP } from "../core/otp_model.ts";
import { NowDateTime } from "../tools/types/index.ts";

const otpId = "a".repeat(15);

type Scenario = ApiScenario & { todo?: boolean };

const scenarios: Scenario[] = [
  {
    name: "not an auth collection",
    method: "POST",
    url: "/api/collections/demo1/auth-with-otp",
    body: '{"otpId":"test","password":"123456"}',
    expectedStatus: 404,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "auth collection with disabled otp",
    method: "POST",
    url: "/api/collections/users/auth-with-otp",
    body: '{"otpId":"test","password":"123456"}',
    beforeTest: async (app: TestApp) => {
      const usersCol = app.findCollectionByNameOrId("users");
      if (!usersCol) {
        throw new Error("Missing users collection");
      }
      usersCol.OTP.Enabled = false;
      const err = app.Save(usersCol);
      if (err) {
        throw new Error(err.message);
      }
    },
    expectedStatus: 403,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "invalid body",
    method: "POST",
    url: "/api/collections/users/auth-with-otp",
    body: '{"email',
    expectedStatus: 400,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "empty body",
    method: "POST",
    url: "/api/collections/users/auth-with-otp",
    body: "",
    expectedStatus: 400,
    expectedContent: ['"data":{', '"otpId":{"code":"validation_required"', '"password":{"code":"validation_required"'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "invalid request data",
    method: "POST",
    url: "/api/collections/users/auth-with-otp",
    body: JSON.stringify({ otpId: "a".repeat(256), password: "a".repeat(72) }),
    expectedStatus: 400,
    expectedContent: [
      '"data":{',
      '"otpId":{"code":"validation_length_out_of_range"',
      '"password":{"code":"validation_length_out_of_range"',
    ],
    expectedEvents: { "*": 0 },
  },
  {
    name: "missing otp",
    method: "POST",
    url: "/api/collections/users/auth-with-otp",
    body: JSON.stringify({ otpId: "missing", password: "123456" }),
    beforeTest: async (app: TestApp) => {
      const user = app.FindAuthRecordByEmail("users", "test@example.com");
      const otp = NewOTP(app);
      otp.Id = otpId;
      otp.SetCollectionRef(user.collection().Id);
      otp.SetRecordRef(user.Id);
      otp.ProxyRecord().SetPassword("123456");
      const err = app.Save(otp);
      if (err) {
        throw new Error(err.message);
      }
    },
    expectedStatus: 400,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "otp for different collection",
    method: "POST",
    url: "/api/collections/users/auth-with-otp",
    body: JSON.stringify({ otpId, password: "123456" }),
    beforeTest: async (app: TestApp) => {
      const client = app.FindAuthRecordByEmail("clients", "test@example.com");
      const otp = NewOTP(app);
      otp.Id = otpId;
      otp.SetCollectionRef(client.collection().Id);
      otp.SetRecordRef(client.Id);
      otp.ProxyRecord().SetPassword("123456");
      const err = app.Save(otp);
      if (err) {
        throw new Error(err.message);
      }
    },
    expectedStatus: 400,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "otp with wrong password",
    method: "POST",
    url: "/api/collections/users/auth-with-otp",
    body: JSON.stringify({ otpId, password: "123456" }),
    beforeTest: async (app: TestApp) => {
      const user = app.FindAuthRecordByEmail("users", "test@example.com");
      const otp = NewOTP(app);
      otp.Id = otpId;
      otp.SetCollectionRef(user.collection().Id);
      otp.SetRecordRef(user.Id);
      otp.ProxyRecord().SetPassword("1234567890");
      const err = app.Save(otp);
      if (err) {
        throw new Error(err.message);
      }
    },
    expectedStatus: 400,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "expired otp with valid password",
    method: "POST",
    url: "/api/collections/users/auth-with-otp",
    body: JSON.stringify({ otpId, password: "123456" }),
    beforeTest: async (app: TestApp) => {
      const user = app.FindAuthRecordByEmail("users", "test@example.com");
      const otp = NewOTP(app);
      otp.Id = otpId;
      otp.SetCollectionRef(user.collection().Id);
      otp.SetRecordRef(user.Id);
      otp.ProxyRecord().SetPassword("123456");
      const expired = NowDateTime().addDate(-3, 0, 0);
      otp.ProxyRecord().SetRaw("created", expired);
      otp.ProxyRecord().SetRaw("updated", expired);
      const err = app.Save(otp);
      if (err) {
        throw new Error(err.message);
      }
    },
    expectedStatus: 400,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "valid otp with valid password (enabled MFA)",
    method: "POST",
    url: "/api/collections/users/auth-with-otp",
    body: JSON.stringify({ otpId, password: "123456" }),
    beforeTest: async (app: TestApp) => {
      const user = app.FindAuthRecordByEmail("users", "test@example.com");
      const otp = NewOTP(app);
      otp.Id = otpId;
      otp.SetCollectionRef(user.collection().Id);
      otp.SetRecordRef(user.Id);
      otp.ProxyRecord().SetPassword("123456");
      const err = app.Save(otp);
      if (err) {
        throw new Error(err.message);
      }
    },
    expectedStatus: 401,
    expectedContent: ['"mfaId":"'],
    expectedEvents: {
      "*": 0,
      OnRecordAuthWithOTPRequest: 1,
      OnRecordAuthRequest: 1,
      OnModelValidate: 1,
      OnModelCreate: 1,
      OnModelCreateExecute: 1,
      OnModelAfterCreateSuccess: 1,
      OnModelDelete: 1,
      OnModelDeleteExecute: 1,
      OnModelAfterDeleteSuccess: 1,
      OnRecordValidate: 1,
      OnRecordCreate: 1,
      OnRecordCreateExecute: 1,
      OnRecordAfterCreateSuccess: 1,
      OnRecordDelete: 1,
      OnRecordDeleteExecute: 1,
      OnRecordAfterDeleteSuccess: 1,
    },
  },
  {
    name: "valid otp with valid password and empty sentTo (disabled MFA)",
    method: "POST",
    url: "/api/collections/users/auth-with-otp",
    body: JSON.stringify({ otpId, password: "123456" }),
    beforeTest: async (app: TestApp) => {
      const user = app.FindAuthRecordByEmail("users", "test@example.com");
      user.SetVerified(false);
      let err = app.Save(user);
      if (err) {
        throw new Error(err.message);
      }

      user.collection().MFA.Enabled = false;
      err = app.Save(user.collection());
      if (err) {
        throw new Error(err.message);
      }

      const otp = NewOTP(app);
      otp.Id = otpId;
      otp.SetCollectionRef(user.collection().Id);
      otp.SetRecordRef(user.Id);
      otp.ProxyRecord().SetPassword("123456");
      err = app.Save(otp);
      if (err) {
        throw new Error(err.message);
      }

      app.OnRecordAuthRequest().BindFunc(async (event: any) => {
        const info = await event.RequestEvent.requestInfo();
        if (info.context !== RequestInfoContextOTP) {
          throw new Error(`Expected request context ${RequestInfoContextOTP}, got ${info.context}`);
        }
        return event.Next();
      });
    },
    expectedStatus: 200,
    expectedContent: ['"token":"', '"record":{', '"email":"test@example.com"'],
    notExpectedContent: ['"meta":', '"tokenKey"', '"password"'],
    expectedEvents: {
      "*": 0,
      OnRecordAuthWithOTPRequest: 1,
      OnRecordAuthRequest: 1,
      OnRecordEnrich: 1,
      OnModelValidate: 1,
      OnModelCreate: 1,
      OnModelCreateExecute: 1,
      OnModelAfterCreateSuccess: 1,
      OnModelDelete: 1,
      OnModelDeleteExecute: 1,
      OnModelAfterDeleteSuccess: 1,
      OnRecordValidate: 1,
      OnRecordCreate: 1,
      OnRecordCreateExecute: 1,
      OnRecordAfterCreateSuccess: 1,
      OnRecordDelete: 1,
      OnRecordDeleteExecute: 1,
      OnRecordAfterDeleteSuccess: 1,
    },
    afterTest: async (app: TestApp) => {
      const user = app.FindAuthRecordByEmail("users", "test@example.com");
      if (user.Verified()) {
        throw new Error("Expected the user to remain unverified because sentTo != email");
      }
    },
  },
  {
    name: "valid otp with valid password and nonempty sentTo=email (disabled MFA)",
    method: "POST",
    url: "/api/collections/users/auth-with-otp",
    body: JSON.stringify({ otpId, password: "123456" }),
    beforeTest: async (app: TestApp) => {
      const user = app.FindAuthRecordByEmail("users", "test@example.com");
      user.SetVerified(false);
      let err = app.Save(user);
      if (err) {
        throw new Error(err.message);
      }

      user.collection().MFA.Enabled = false;
      err = app.Save(user.collection());
      if (err) {
        throw new Error(err.message);
      }

      const otp = NewOTP(app);
      otp.Id = otpId;
      otp.SetCollectionRef(user.collection().Id);
      otp.SetRecordRef(user.Id);
      otp.ProxyRecord().SetPassword("123456");
      otp.SetSentTo(user.Email());
      err = app.Save(otp);
      if (err) {
        throw new Error(err.message);
      }
    },
    expectedStatus: 200,
    expectedContent: ['"token":"', '"record":{', '"email":"test@example.com"'],
    notExpectedContent: ['"meta":', '"tokenKey"', '"password"'],
    expectedEvents: {
      "*": 0,
      OnRecordAuthWithOTPRequest: 1,
      OnRecordAuthRequest: 1,
      OnRecordEnrich: 1,
      OnModelValidate: 2,
      OnModelCreate: 1,
      OnModelCreateExecute: 1,
      OnModelAfterCreateSuccess: 1,
      OnModelDelete: 1,
      OnModelDeleteExecute: 1,
      OnModelAfterDeleteSuccess: 1,
      OnModelUpdate: 1,
      OnModelUpdateExecute: 1,
      OnModelAfterUpdateSuccess: 1,
      OnRecordValidate: 2,
      OnRecordCreate: 1,
      OnRecordCreateExecute: 1,
      OnRecordAfterCreateSuccess: 1,
      OnRecordDelete: 1,
      OnRecordDeleteExecute: 1,
      OnRecordAfterDeleteSuccess: 1,
      OnRecordUpdate: 1,
      OnRecordUpdateExecute: 1,
      OnRecordAfterUpdateSuccess: 1,
    },
    afterTest: async (app: TestApp) => {
      const user = app.FindAuthRecordByEmail("users", "test@example.com");
      if (!user.Verified()) {
        throw new Error("Expected the user to be marked as verified");
      }
    },
  },
  {
    name: "OnRecordAuthWithOTPRequest tx body write check",
    method: "POST",
    url: "/api/collections/users/auth-with-otp",
    body: JSON.stringify({ otpId, password: "123456" }),
    beforeTest: async (app: TestApp) => {
      const user = app.FindAuthRecordByEmail("users", "test@example.com");
      user.collection().MFA.Enabled = false;
      let err = app.Save(user.collection());
      if (err) {
        throw new Error(err.message);
      }

      const otp = NewOTP(app);
      otp.Id = otpId;
      otp.SetCollectionRef(user.collection().Id);
      otp.SetRecordRef(user.Id);
      otp.ProxyRecord().SetPassword("123456");
      err = app.Save(otp);
      if (err) {
        throw new Error(err.message);
      }

      app.OnRecordAuthWithOTPRequest().BindFunc((event: any) => {
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
    expectedEvents: { OnRecordAuthWithOTPRequest: 1 },
  },
  {
    name: "RateLimit rule - users:authWithOTP",
    method: "POST",
    url: "/api/collections/users/auth-with-otp",
    todo: true,
    expectedStatus: 429,
  },
  {
    name: "RateLimit rule - *:authWithOTP",
    method: "POST",
    url: "/api/collections/users/auth-with-otp",
    todo: true,
    expectedStatus: 429,
  },
  {
    name: "RateLimit rule - users:auth",
    method: "POST",
    url: "/api/collections/users/auth-with-otp",
    todo: true,
    expectedStatus: 429,
  },
  {
    name: "RateLimit rule - *:auth",
    method: "POST",
    url: "/api/collections/users/auth-with-otp",
    todo: true,
    expectedStatus: 429,
  },
];

describe("record auth with OTP", () => {
  for (const scenario of scenarios) {
    const name = scenario.name ?? `${scenario.method}:${scenario.url}`;
    if (scenario.todo) {
      it.todo(name, () => {});
      continue;
    }

    it(name, async () => {
      await runApiScenario(scenario);
    });
  }
});

// Manual rate limiter checks are TODO until rate limit middleware is ported.
describe("record auth with OTP manual rate limit", () => {
  it.todo("manual rate limiter checks", () => {});
});
