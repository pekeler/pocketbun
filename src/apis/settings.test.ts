// Ported from pocketbase/apis/settings_test.go

import { describe, it } from "bun:test";
import { generateKeyPairSync } from "node:crypto";
import type { ApiScenario } from "../tests/api.ts";
import { runApiScenario } from "../tests/api.ts";

const regularUserToken =
  "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjRxMXhsY2xtZmxva3UzMyIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoiX3BiX3VzZXJzX2F1dGhfIiwiZXhwIjoyNTI0NjA0NDYxLCJyZWZyZXNoYWJsZSI6dHJ1ZX0.ZT3F0Z3iM-xbGgSG3LEKiEzHrPHr8t8IuHLZGGNuxLo";

const superuserToken =
  "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InN5d2JoZWNuaDQ2cmhtMCIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoicGJjXzMxNDI2MzU4MjMiLCJleHAiOjI1MjQ2MDQ0NjEsInJlZnJlc2hhYmxlIjp0cnVlfQ.UXgO3j-0BumcugrFjbd7j0M4MQvbrLggLlcu_YNGjoY";

const validData = `{
  "meta":{"appName":"update_test"},
  "smtp":{"password":"new_smtp_password"},
  "s3":{"secret":"new_s3_secret"},
  "backups":{"s3":{"secret":"new_backups_s3_secret"}}
}`;

const { privateKey: applePrivateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const applePrivatePem = applePrivateKey.export({ type: "pkcs8", format: "pem" }).toString();
const validAppleSecretBody = JSON.stringify({
  clientId: "123",
  teamId: "1234567890",
  keyId: "1234567891",
  privateKey: applePrivatePem,
  duration: 1,
});

const scenarios: ApiScenario[] = [
  {
    name: "settings list unauthorized",
    method: "GET",
    url: "/api/settings",
    expectedStatus: 401,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "settings list authorized as regular user",
    method: "GET",
    url: "/api/settings",
    headers: { Authorization: regularUserToken },
    expectedStatus: 403,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "settings list authorized as superuser",
    method: "GET",
    url: "/api/settings",
    headers: { Authorization: superuserToken },
    expectedStatus: 200,
    expectedContent: ['"meta":{', '"logs":{', '"smtp":{', '"s3":{', '"backups":{', '"batch":{'],
    expectedEvents: { "*": 0, OnSettingsListRequest: 1 },
  },
  {
    name: "settings list OnSettingsListRequest tx body write check",
    method: "GET",
    url: "/api/settings",
    headers: { Authorization: superuserToken },
    beforeTest: (app) => {
      app.OnSettingsListRequest().BindFunc(async (event: any) => {
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
    expectedEvents: { OnSettingsListRequest: 1 },
  },

  {
    name: "settings set unauthorized",
    method: "PATCH",
    url: "/api/settings",
    body: validData,
    expectedStatus: 401,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "settings set authorized as regular user",
    method: "PATCH",
    url: "/api/settings",
    body: validData,
    headers: { Authorization: regularUserToken },
    expectedStatus: 403,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "settings set authorized as superuser submitting empty data",
    method: "PATCH",
    url: "/api/settings",
    body: "",
    headers: { Authorization: superuserToken },
    expectedStatus: 200,
    expectedContent: ['"meta":{', '"logs":{', '"smtp":{', '"s3":{', '"backups":{', '"batch":{'],
    expectedEvents: {
      "*": 0,
      OnSettingsUpdateRequest: 1,
      OnModelUpdate: 1,
      OnModelUpdateExecute: 1,
      OnModelAfterUpdateSuccess: 1,
      OnModelValidate: 1,
      OnSettingsReload: 1,
    },
  },
  {
    name: "settings set authorized as superuser submitting invalid data",
    method: "PATCH",
    url: "/api/settings",
    body: '{"meta":{"appName":""}}',
    headers: { Authorization: superuserToken },
    expectedStatus: 400,
    expectedContent: ['"data":{', '"meta":{"appName":{"code":"validation_required"'],
    expectedEvents: {
      "*": 0,
      OnModelUpdate: 1,
      OnModelAfterUpdateError: 1,
      OnModelValidate: 1,
      OnSettingsUpdateRequest: 1,
    },
  },
  {
    name: "settings set authorized as superuser submitting valid data",
    method: "PATCH",
    url: "/api/settings",
    body: validData,
    headers: { Authorization: superuserToken },
    afterTest: (app) => {
      if (app.settings().smtp.password !== "new_smtp_password") {
        throw new Error(`Expected smtp.password to persist, got ${JSON.stringify(app.settings().smtp.password)}`);
      }
      if (app.settings().s3.secret !== "new_s3_secret") {
        throw new Error(`Expected s3.secret to persist, got ${JSON.stringify(app.settings().s3.secret)}`);
      }
      if (app.settings().backups.s3.secret !== "new_backups_s3_secret") {
        throw new Error(`Expected backups.s3.secret to persist, got ${JSON.stringify(app.settings().backups.s3.secret)}`);
      }
    },
    expectedStatus: 200,
    expectedContent: ['"meta":{', '"logs":{', '"smtp":{', '"s3":{', '"backups":{', '"batch":{', '"appName":"update_test"'],
    notExpectedContent: ["secret", "password"],
    expectedEvents: {
      "*": 0,
      OnSettingsUpdateRequest: 1,
      OnModelUpdate: 1,
      OnModelUpdateExecute: 1,
      OnModelAfterUpdateSuccess: 1,
      OnModelValidate: 1,
      OnSettingsReload: 1,
    },
  },
  {
    name: "settings set OnSettingsUpdateRequest tx body write check",
    method: "PATCH",
    url: "/api/settings",
    body: validData,
    headers: { Authorization: superuserToken },
    beforeTest: (app) => {
      app.OnSettingsUpdateRequest().BindFunc(async (event: any) => {
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
    expectedEvents: { OnSettingsUpdateRequest: 1 },
  },

  {
    name: "settings test s3 unauthorized",
    method: "POST",
    url: "/api/settings/test/s3",
    expectedStatus: 401,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "settings test s3 authorized as regular user",
    method: "POST",
    url: "/api/settings/test/s3",
    headers: { Authorization: regularUserToken },
    expectedStatus: 403,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "settings test s3 authorized as superuser (missing body + no s3)",
    method: "POST",
    url: "/api/settings/test/s3",
    headers: { Authorization: superuserToken },
    expectedStatus: 400,
    expectedContent: ['"data":{', '"filesystem":{'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "settings test s3 authorized as superuser (invalid filesystem)",
    method: "POST",
    url: "/api/settings/test/s3",
    body: '{"filesystem":"invalid"}',
    headers: { Authorization: superuserToken },
    expectedStatus: 400,
    expectedContent: ['"data":{', '"filesystem":{'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "settings test s3 authorized as superuser (valid filesystem and no s3)",
    method: "POST",
    url: "/api/settings/test/s3",
    body: '{"filesystem":"storage"}',
    headers: { Authorization: superuserToken },
    expectedStatus: 400,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },

  {
    name: "settings test email unauthorized",
    method: "POST",
    url: "/api/settings/test/email",
    body: '{"template":"verification","email":"test@example.com"}',
    expectedStatus: 401,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "settings test email authorized as regular user",
    method: "POST",
    url: "/api/settings/test/email",
    body: '{"template":"verification","email":"test@example.com"}',
    headers: { Authorization: regularUserToken },
    expectedStatus: 403,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "settings test email authorized as superuser (invalid body)",
    method: "POST",
    url: "/api/settings/test/email",
    body: "{",
    headers: { Authorization: superuserToken },
    expectedStatus: 400,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "settings test email authorized as superuser (empty json)",
    method: "POST",
    url: "/api/settings/test/email",
    body: "{}",
    headers: { Authorization: superuserToken },
    expectedStatus: 400,
    expectedContent: ['"email":{"code":"validation_required"', '"template":{"code":"validation_required"'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "settings test email authorized as superuser (verification template)",
    method: "POST",
    url: "/api/settings/test/email",
    body: '{"template":"verification","email":"test@example.com"}',
    headers: { Authorization: superuserToken },
    expectedStatus: 204,
    expectedContent: [],
    expectedEvents: { "*": 0, OnMailerSend: 1, OnMailerRecordVerificationSend: 1 },
    afterTest: (app) => {
      if (app.testMailer.TotalSend() !== 1) {
        throw new Error(`[verification] Expected 1 sent email, got ${app.testMailer.TotalSend()}`);
      }
      if (app.testMailer.LastMessage().To.length !== 1) {
        throw new Error(`[verification] Expected 1 recipient, got ${JSON.stringify(app.testMailer.LastMessage().To)}`);
      }
      if (app.testMailer.LastMessage().To[0]?.Address !== "test@example.com") {
        throw new Error(
          `[verification] Expected the email to be sent to test@example.com, got ${app.testMailer.LastMessage().To[0]?.Address}`,
        );
      }
      if (!app.testMailer.LastMessage().HTML.includes("Verify")) {
        throw new Error(
          `[verification] Expected to send verification email, got\n${app.testMailer.LastMessage().Subject}\n${app.testMailer.LastMessage().HTML}`,
        );
      }
    },
  },
  {
    name: "settings test email authorized as superuser (password reset template)",
    method: "POST",
    url: "/api/settings/test/email",
    body: '{"template":"password-reset","email":"test@example.com"}',
    headers: { Authorization: superuserToken },
    expectedStatus: 204,
    expectedContent: [],
    expectedEvents: { "*": 0, OnMailerSend: 1, OnMailerRecordPasswordResetSend: 1 },
    afterTest: (app) => {
      if (app.testMailer.TotalSend() !== 1) {
        throw new Error(`[password-reset] Expected 1 sent email, got ${app.testMailer.TotalSend()}`);
      }
      if (app.testMailer.LastMessage().To.length !== 1) {
        throw new Error(`[password-reset] Expected 1 recipient, got ${JSON.stringify(app.testMailer.LastMessage().To)}`);
      }
      if (app.testMailer.LastMessage().To[0]?.Address !== "test@example.com") {
        throw new Error(
          `[password-reset] Expected the email to be sent to test@example.com, got ${app.testMailer.LastMessage().To[0]?.Address}`,
        );
      }
      if (!app.testMailer.LastMessage().HTML.includes("Reset password")) {
        throw new Error(
          `[password-reset] Expected to send password-reset email, got\n${app.testMailer.LastMessage().Subject}\n${app.testMailer.LastMessage().HTML}`,
        );
      }
    },
  },
  {
    name: "settings test email authorized as superuser (email change)",
    method: "POST",
    url: "/api/settings/test/email",
    body: '{"template":"email-change","email":"test@example.com"}',
    headers: { Authorization: superuserToken },
    expectedStatus: 204,
    expectedContent: [],
    expectedEvents: { "*": 0, OnMailerSend: 1, OnMailerRecordEmailChangeSend: 1 },
    afterTest: (app) => {
      if (app.testMailer.TotalSend() !== 1) {
        throw new Error(`[email-change] Expected 1 sent email, got ${app.testMailer.TotalSend()}`);
      }
      if (app.testMailer.LastMessage().To.length !== 1) {
        throw new Error(`[email-change] Expected 1 recipient, got ${JSON.stringify(app.testMailer.LastMessage().To)}`);
      }
      if (app.testMailer.LastMessage().To[0]?.Address !== "test@example.com") {
        throw new Error(
          `[email-change] Expected the email to be sent to test@example.com, got ${app.testMailer.LastMessage().To[0]?.Address}`,
        );
      }
      if (!app.testMailer.LastMessage().HTML.includes("Confirm new email")) {
        throw new Error(
          `[email-change] Expected to send confirm new email, got\n${app.testMailer.LastMessage().Subject}\n${app.testMailer.LastMessage().HTML}`,
        );
      }
    },
  },
  {
    name: "settings test email authorized as superuser (otp)",
    method: "POST",
    url: "/api/settings/test/email",
    body: '{"template":"otp","email":"test@example.com"}',
    headers: { Authorization: superuserToken },
    expectedStatus: 204,
    expectedContent: [],
    expectedEvents: { "*": 0, OnMailerSend: 1, OnMailerRecordOTPSend: 1 },
    afterTest: (app) => {
      if (app.testMailer.TotalSend() !== 1) {
        throw new Error(`[otp] Expected 1 sent email, got ${app.testMailer.TotalSend()}`);
      }
      if (app.testMailer.LastMessage().To.length !== 1) {
        throw new Error(`[otp] Expected 1 recipient, got ${JSON.stringify(app.testMailer.LastMessage().To)}`);
      }
      if (app.testMailer.LastMessage().To[0]?.Address !== "test@example.com") {
        throw new Error(
          `[otp] Expected the email to be sent to test@example.com, got ${app.testMailer.LastMessage().To[0]?.Address}`,
        );
      }
      if (!app.testMailer.LastMessage().HTML.includes("one-time password")) {
        throw new Error(
          `[otp] Expected to send OTP email, got\n${app.testMailer.LastMessage().Subject}\n${app.testMailer.LastMessage().HTML}`,
        );
      }
    },
  },

  {
    name: "generate apple client secret unauthorized",
    method: "POST",
    url: "/api/settings/apple/generate-client-secret",
    expectedStatus: 401,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "generate apple client secret authorized as regular user",
    method: "POST",
    url: "/api/settings/apple/generate-client-secret",
    headers: { Authorization: regularUserToken },
    expectedStatus: 403,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "generate apple client secret authorized as superuser (invalid body)",
    method: "POST",
    url: "/api/settings/apple/generate-client-secret",
    body: "{",
    headers: { Authorization: superuserToken },
    expectedStatus: 400,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "generate apple client secret authorized as superuser (empty json)",
    method: "POST",
    url: "/api/settings/apple/generate-client-secret",
    body: "{}",
    headers: { Authorization: superuserToken },
    expectedStatus: 400,
    expectedContent: [
      '"clientId":{"code":"validation_required"',
      '"teamId":{"code":"validation_required"',
      '"keyId":{"code":"validation_required"',
      '"privateKey":{"code":"validation_required"',
      '"duration":{"code":"validation_required"',
    ],
    expectedEvents: { "*": 0 },
  },
  {
    name: "generate apple client secret authorized as superuser (invalid data)",
    method: "POST",
    url: "/api/settings/apple/generate-client-secret",
    body: '{"clientId":"","teamId":"123456789","keyId":"123456789","privateKey":"invalid","duration":-1}',
    headers: { Authorization: superuserToken },
    expectedStatus: 400,
    expectedContent: [
      '"clientId":{"code":"validation_required"',
      '"teamId":{"code":"validation_length_invalid"',
      '"keyId":{"code":"validation_length_invalid"',
      '"privateKey":{"code":"validation_match_invalid"',
      '"duration":{"code":"validation_min_greater_equal_than_required"',
    ],
    expectedEvents: { "*": 0 },
  },
  {
    name: "generate apple client secret authorized as superuser (valid data)",
    method: "POST",
    url: "/api/settings/apple/generate-client-secret",
    body: validAppleSecretBody,
    headers: { Authorization: superuserToken },
    expectedStatus: 200,
    expectedContent: ['"secret":"'],
    expectedEvents: { "*": 0 },
  },
];

describe("Settings API", () => {
  it("runs scenarios", async () => {
    for (const scenario of scenarios) {
      await runApiScenario(scenario);
    }
  });
});
