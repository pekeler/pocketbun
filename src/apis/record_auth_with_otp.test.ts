// Ported from pocketbase/apis/record_auth_with_otp_test.go.

import { describe, it } from "bun:test";
import type { TestApp } from "../tests/app.ts";
import { RequestInfoContextOTP } from "../core/event_request.ts";
import { NewOTP } from "../core/otp_model.ts";
import { runApiScenario, type ApiScenario } from "../tests/api.ts";
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
      const err = await app.Save(otp);
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
      const err = await app.Save(otp);
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
      const err = await app.Save(otp);
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
      const err = await app.Save(otp);
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
      const err = await app.Save(otp);
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
      let err = await app.Save(user);
      if (err) {
        throw new Error(err.message);
      }

      user.collection().MFA.Enabled = false;
      err = await app.Save(user.collection());
      if (err) {
        throw new Error(err.message);
      }

      const otp = NewOTP(app);
      otp.Id = otpId;
      otp.SetCollectionRef(user.collection().Id);
      otp.SetRecordRef(user.Id);
      otp.ProxyRecord().SetPassword("123456");
      err = await app.Save(otp);
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
      const externalAuths = app.FindAllExternalAuthsByRecord(user);
      if (externalAuths.length !== 2) {
        throw new Error(`Expected 2 external auths, found ${externalAuths.length}`);
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
      let err = await app.Save(user);
      if (err) {
        throw new Error(err.message);
      }

      user.collection().MFA.Enabled = false;
      err = await app.Save(user.collection());
      if (err) {
        throw new Error(err.message);
      }

      const otp = NewOTP(app);
      otp.Id = otpId;
      otp.SetCollectionRef(user.collection().Id);
      otp.SetRecordRef(user.Id);
      otp.ProxyRecord().SetPassword("123456");
      otp.SetSentTo(user.Email());
      err = await app.Save(otp);
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
      OnModelDelete: 3,
      OnModelDeleteExecute: 3,
      OnModelAfterDeleteSuccess: 3,
      OnModelUpdate: 1,
      OnModelUpdateExecute: 1,
      OnModelAfterUpdateSuccess: 1,
      OnRecordValidate: 2,
      OnRecordCreate: 1,
      OnRecordCreateExecute: 1,
      OnRecordAfterCreateSuccess: 1,
      OnRecordDelete: 3,
      OnRecordDeleteExecute: 3,
      OnRecordAfterDeleteSuccess: 3,
      OnRecordUpdate: 1,
      OnRecordUpdateExecute: 1,
      OnRecordAfterUpdateSuccess: 1,
    },
    afterTest: async (app: TestApp) => {
      const user = app.FindAuthRecordByEmail("users", "test@example.com");
      if (!user.Verified()) {
        throw new Error("Expected the user to be marked as verified");
      }
      const otps = app.FindAllOTPsByRecord(user);
      if (otps.length > 0) {
        throw new Error(`Expected all OTPs to be cleared, found ${otps.length}`);
      }
      const externalAuths = app.FindAllExternalAuthsByRecord(user);
      if (externalAuths.length > 0) {
        throw new Error(`Expected all external auths to be cleared, found ${externalAuths.length}`);
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
      let err = await app.Save(user.collection());
      if (err) {
        throw new Error(err.message);
      }

      const otp = NewOTP(app);
      otp.Id = otpId;
      otp.SetCollectionRef(user.collection().Id);
      otp.SetRecordRef(user.Id);
      otp.ProxyRecord().SetPassword("123456");
      err = await app.Save(otp);
      if (err) {
        throw new Error(err.message);
      }

      app.OnRecordAuthWithOTPRequest().BindFunc(async (event: any) => {
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
    expectedEvents: { OnRecordAuthWithOTPRequest: 1 },
  },
  {
    name: "RateLimit rule - users:authWithOTP",
    method: "POST",
    url: "/api/collections/users/auth-with-otp",
    beforeTest: async (app) => {
      app.settings().rateLimits.enabled = true;
      app.settings().rateLimits.rules = [
        { maxRequests: 100, label: "abc", duration: 1 },
        { maxRequests: 100, label: "*:authWithOTP", duration: 1 },
        { maxRequests: 100, label: "users:auth", duration: 1 },
        { maxRequests: 0, label: "users:authWithOTP", duration: 1 },
      ];
    },
    expectedStatus: 429,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "RateLimit rule - *:authWithOTP",
    method: "POST",
    url: "/api/collections/users/auth-with-otp",
    beforeTest: async (app) => {
      app.settings().rateLimits.enabled = true;
      app.settings().rateLimits.rules = [
        { maxRequests: 100, label: "abc", duration: 1 },
        { maxRequests: 100, label: "*:auth", duration: 1 },
        { maxRequests: 0, label: "*:authWithOTP", duration: 1 },
      ];
    },
    expectedStatus: 429,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "RateLimit rule - users:auth",
    method: "POST",
    url: "/api/collections/users/auth-with-otp",
    beforeTest: async (app) => {
      app.settings().rateLimits.enabled = true;
      app.settings().rateLimits.rules = [
        { maxRequests: 100, label: "abc", duration: 1 },
        { maxRequests: 100, label: "*:authWithOTP", duration: 1 },
        { maxRequests: 0, label: "users:auth", duration: 1 },
      ];
    },
    expectedStatus: 429,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "RateLimit rule - *:auth",
    method: "POST",
    url: "/api/collections/users/auth-with-otp",
    beforeTest: async (app) => {
      app.settings().rateLimits.enabled = true;
      app.settings().rateLimits.rules = [
        { maxRequests: 100, label: "abc", duration: 1 },
        { maxRequests: 0, label: "*:auth", duration: 1 },
      ];
    },
    expectedStatus: 429,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
];

describe("record auth with OTP", () => {
  for (const scenario of scenarios) {
    const name = scenario.name ?? `${scenario.method}:${scenario.url}`;
    it.serial(name, async () => {
      await runApiScenario(scenario);
    });
  }
});

describe("record auth with OTP manual rate limit", () => {
  let storeCache: Map<string, unknown> = new Map();
  const otpAId = "a".repeat(15);
  const otpBId = "b".repeat(15);

  const scenarios = [
    { otpId: otpAId, password: "12345", expectedStatus: 400 },
    { otpId: otpAId, password: "12345", expectedStatus: 400 },
    { otpId: otpBId, password: "12345", expectedStatus: 400 },
    { otpId: otpBId, password: "12345", expectedStatus: 400 },
    { otpId: otpBId, password: "12345", expectedStatus: 400 },
    { otpId: otpAId, password: "12345", expectedStatus: 429 },
    { otpId: otpAId, password: "123456", expectedStatus: 429 },
    { otpId: otpAId, password: "123456", expectedStatus: 429 },
    { otpId: otpBId, password: "123456", expectedStatus: 429 },
  ];

  for (const scenario of scenarios) {
    it.serial(`${scenario.otpId}:${scenario.password}`, async () => {
      await runApiScenario({
        method: "POST",
        url: "/api/collections/users/auth-with-otp",
        body: JSON.stringify({ otpId: scenario.otpId, password: scenario.password }),
        expectedStatus: scenario.expectedStatus,
        expectedContent: ['"'],
        beforeTest: async (app) => {
          for (const [key, value] of storeCache.entries()) {
            app.store().set(key, value);
          }

          const user = app.FindAuthRecordByEmail("users", "test@example.com");
          user.collection().MFA.Enabled = false;
          const err = await app.Save(user.collection());
          if (err) {
            throw err;
          }

          for (const id of [otpAId, otpBId]) {
            const otp = NewOTP(app);
            otp.Id = id;
            otp.SetCollectionRef(user.collection().Id);
            otp.SetRecordRef(user.Id);
            otp.ProxyRecord().SetPassword("123456");
            const saveErr = await app.Save(otp);
            if (saveErr) {
              throw saveErr;
            }
          }
        },
        afterTest: (app) => {
          storeCache = app.store().getAll();
        },
      });
    });
  }
});
