// Ported from pocketbase/apis/record_auth_password_reset_confirm_test.go.

import { describe, it } from "bun:test";
import type { TestApp } from "../tests/app.ts";
import { TokenTypePasswordReset } from "../core/record_tokens.ts";
import { runApiScenario, type ApiScenario } from "../tests/api.ts";

type Scenario = ApiScenario & { todo?: boolean };

const scenarios: Scenario[] = [
  {
    name: "empty data",
    method: "POST",
    url: "/api/collections/users/confirm-password-reset",
    body: "",
    expectedStatus: 400,
    expectedContent: [
      '"data":{',
      '"password":{"code":"validation_required"',
      '"passwordConfirm":{"code":"validation_required"',
      '"token":{"code":"validation_required"',
    ],
    expectedEvents: { "*": 0 },
  },
  {
    name: "invalid data format",
    method: "POST",
    url: "/api/collections/users/confirm-password-reset",
    body: '{"password',
    expectedStatus: 400,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "expired token and invalid password",
    method: "POST",
    url: "/api/collections/users/confirm-password-reset",
    body: `{
      "token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjRxMXhsY2xtZmxva3UzMyIsImV4cCI6MTY0MDk5MTY2MSwidHlwZSI6InBhc3N3b3JkUmVzZXQiLCJjb2xsZWN0aW9uSWQiOiJfcGJfdXNlcnNfYXV0aF8iLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20ifQ.5Tm6_6amQqOlX3urAnXlEdmxwG5qQJfiTg6U0hHR1hk",
      "password":"1234567",
      "passwordConfirm":"7654321"
    }`,
    expectedStatus: 400,
    expectedContent: [
      '"data":{',
      '"token":{"code":"validation_invalid_token"',
      '"password":{"code":"validation_length_out_of_range"',
      '"passwordConfirm":{"code":"validation_values_mismatch"',
    ],
    expectedEvents: { "*": 0 },
  },
  {
    name: "non-password reset token",
    method: "POST",
    url: "/api/collections/users/confirm-password-reset",
    body: `{
      "token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjRxMXhsY2xtZmxva3UzMyIsImV4cCI6MjUyNDYwNDQ2MSwidHlwZSI6InZlcmlmaWNhdGlvbiIsImNvbGxlY3Rpb25JZCI6Il9wYl91c2Vyc19hdXRoXyIsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSJ9.SetHpu2H-x-q4TIUz-xiQjwi7MNwLCLvSs4O0hUSp0E",
      "password":"1234567!",
      "passwordConfirm":"1234567!"
    }`,
    expectedStatus: 400,
    expectedContent: ['"data":{', '"token":{"code":"validation_invalid_token"'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "non auth collection",
    method: "POST",
    url: "/api/collections/demo1/confirm-password-reset?expand=rel,missing",
    body: `{
      "token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjRxMXhsY2xtZmxva3UzMyIsImV4cCI6MjUyNDYwNDQ2MSwidHlwZSI6InBhc3N3b3JkUmVzZXQiLCJjb2xsZWN0aW9uSWQiOiJfcGJfdXNlcnNfYXV0aF8iLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20ifQ.xR-xq1oHDy0D8Q4NDOAEyYKGHWd_swzoiSoL8FLFBHY",
      "password":"1234567!",
      "passwordConfirm":"1234567!"
    }`,
    expectedStatus: 404,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "different auth collection",
    method: "POST",
    url: "/api/collections/clients/confirm-password-reset?expand=rel,missing",
    body: `{
      "token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjRxMXhsY2xtZmxva3UzMyIsImV4cCI6MjUyNDYwNDQ2MSwidHlwZSI6InBhc3N3b3JkUmVzZXQiLCJjb2xsZWN0aW9uSWQiOiJfcGJfdXNlcnNfYXV0aF8iLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20ifQ.xR-xq1oHDy0D8Q4NDOAEyYKGHWd_swzoiSoL8FLFBHY",
      "password":"1234567!",
      "passwordConfirm":"1234567!"
    }`,
    expectedStatus: 400,
    expectedContent: ['"data":{"token":{"code":"validation_token_collection_mismatch"'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "valid token and data (unverified user)",
    method: "POST",
    url: "/api/collections/users/confirm-password-reset",
    body: `{
      "token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjRxMXhsY2xtZmxva3UzMyIsImV4cCI6MjUyNDYwNDQ2MSwidHlwZSI6InBhc3N3b3JkUmVzZXQiLCJjb2xsZWN0aW9uSWQiOiJfcGJfdXNlcnNfYXV0aF8iLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20ifQ.xR-xq1oHDy0D8Q4NDOAEyYKGHWd_swzoiSoL8FLFBHY",
      "password":"1234567!",
      "passwordConfirm":"1234567!"
    }`,
    expectedStatus: 204,
    expectedEvents: {
      "*": 0,
      OnRecordConfirmPasswordResetRequest: 1,
      OnModelUpdate: 1,
      OnModelUpdateExecute: 1,
      OnModelAfterUpdateSuccess: 1,
      OnModelValidate: 1,
      OnRecordUpdate: 1,
      OnRecordUpdateExecute: 1,
      OnRecordAfterUpdateSuccess: 1,
      OnRecordValidate: 1,
    },
    beforeTest: (app: TestApp) => {
      const user = app.FindAuthRecordByEmail("users", "test@example.com");
      if (user.Verified()) {
        throw new Error("Expected the user to be unverified");
      }
    },
    afterTest: (app: TestApp) => {
      let tokenValid = true;
      try {
        app.FindAuthRecordByToken(
          "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjRxMXhsY2xtZmxva3UzMyIsImV4cCI6MjUyNDYwNDQ2MSwidHlwZSI6InBhc3N3b3JkUmVzZXQiLCJjb2xsZWN0aW9uSWQiOiJfcGJfdXNlcnNfYXV0aF8iLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20ifQ.xR-xq1oHDy0D8Q4NDOAEyYKGHWd_swzoiSoL8FLFBHY",
          TokenTypePasswordReset,
        );
      } catch {
        tokenValid = false;
      }
      if (tokenValid) {
        throw new Error("Expected the password reset token to be invalidated");
      }

      const user = app.FindAuthRecordByEmail("users", "test@example.com");
      if (!user.Verified()) {
        throw new Error("Expected the user to be marked as verified");
      }

      if (!user.ValidatePassword("1234567!")) {
        throw new Error("Password wasn't changed");
      }
    },
  },
  {
    name: "valid token and data (unverified user with different email from the one in the token)",
    method: "POST",
    url: "/api/collections/users/confirm-password-reset",
    body: `{
      "token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjRxMXhsY2xtZmxva3UzMyIsImV4cCI6MjUyNDYwNDQ2MSwidHlwZSI6InBhc3N3b3JkUmVzZXQiLCJjb2xsZWN0aW9uSWQiOiJfcGJfdXNlcnNfYXV0aF8iLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20ifQ.xR-xq1oHDy0D8Q4NDOAEyYKGHWd_swzoiSoL8FLFBHY",
      "password":"1234567!",
      "passwordConfirm":"1234567!"
    }`,
    expectedStatus: 204,
    expectedEvents: {
      "*": 0,
      OnRecordConfirmPasswordResetRequest: 1,
      OnModelUpdate: 1,
      OnModelUpdateExecute: 1,
      OnModelAfterUpdateSuccess: 1,
      OnModelValidate: 1,
      OnRecordUpdate: 1,
      OnRecordUpdateExecute: 1,
      OnRecordAfterUpdateSuccess: 1,
      OnRecordValidate: 1,
    },
    beforeTest: (app: TestApp) => {
      const user = app.FindAuthRecordByEmail("users", "test@example.com");
      if (user.Verified()) {
        throw new Error("Expected the user to be unverified");
      }

      const oldTokenKey = user.TokenKey();
      user.SetEmail("test_update@example.com");
      const err = app.Save(user);
      if (err) {
        throw new Error(`Failed to update user test email: ${err.message}`);
      }

      user.SetTokenKey(oldTokenKey);
      const restoreErr = app.Save(user);
      if (restoreErr) {
        throw new Error(`Failed to restore original user tokenKey: ${restoreErr.message}`);
      }
    },
    afterTest: (app: TestApp) => {
      let tokenValid = true;
      try {
        app.FindAuthRecordByToken(
          "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjRxMXhsY2xtZmxva3UzMyIsImV4cCI6MjUyNDYwNDQ2MSwidHlwZSI6InBhc3N3b3JkUmVzZXQiLCJjb2xsZWN0aW9uSWQiOiJfcGJfdXNlcnNfYXV0aF8iLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20ifQ.xR-xq1oHDy0D8Q4NDOAEyYKGHWd_swzoiSoL8FLFBHY",
          TokenTypePasswordReset,
        );
      } catch {
        tokenValid = false;
      }
      if (tokenValid) {
        throw new Error("Expected the password reset token to be invalidated");
      }

      const user = app.FindAuthRecordByEmail("users", "test_update@example.com");
      if (user.Verified()) {
        throw new Error("Expected the user to remain unverified");
      }

      if (!user.ValidatePassword("1234567!")) {
        throw new Error("Password wasn't changed");
      }
    },
  },
  {
    name: "valid token and data (verified user)",
    method: "POST",
    url: "/api/collections/users/confirm-password-reset",
    body: `{
      "token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjRxMXhsY2xtZmxva3UzMyIsImV4cCI6MjUyNDYwNDQ2MSwidHlwZSI6InBhc3N3b3JkUmVzZXQiLCJjb2xsZWN0aW9uSWQiOiJfcGJfdXNlcnNfYXV0aF8iLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20ifQ.xR-xq1oHDy0D8Q4NDOAEyYKGHWd_swzoiSoL8FLFBHY",
      "password":"1234567!",
      "passwordConfirm":"1234567!"
    }`,
    expectedStatus: 204,
    expectedEvents: {
      "*": 0,
      OnRecordConfirmPasswordResetRequest: 1,
      OnModelUpdate: 1,
      OnModelUpdateExecute: 1,
      OnModelAfterUpdateSuccess: 1,
      OnModelValidate: 1,
      OnRecordUpdate: 1,
      OnRecordUpdateExecute: 1,
      OnRecordAfterUpdateSuccess: 1,
      OnRecordValidate: 1,
    },
    beforeTest: (app: TestApp) => {
      const user = app.FindAuthRecordByEmail("users", "test@example.com");
      user.SetVerified(true);
      const err = app.Save(user);
      if (err) {
        throw new Error("Failed to update user verified state");
      }
    },
    afterTest: (app: TestApp) => {
      let tokenValid = true;
      try {
        app.FindAuthRecordByToken(
          "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjRxMXhsY2xtZmxva3UzMyIsImV4cCI6MjUyNDYwNDQ2MSwidHlwZSI6InBhc3N3b3JkUmVzZXQiLCJjb2xsZWN0aW9uSWQiOiJfcGJfdXNlcnNfYXV0aF8iLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20ifQ.xR-xq1oHDy0D8Q4NDOAEyYKGHWd_swzoiSoL8FLFBHY",
          TokenTypePasswordReset,
        );
      } catch {
        tokenValid = false;
      }
      if (tokenValid) {
        throw new Error("Expected the password reset token to be invalidated");
      }

      const user = app.FindAuthRecordByEmail("users", "test@example.com");
      if (!user.Verified()) {
        throw new Error("Expected the user to remain verified");
      }

      if (!user.ValidatePassword("1234567!")) {
        throw new Error("Password wasn't changed");
      }
    },
  },
  {
    name: "OnRecordConfirmPasswordResetRequest tx body write check",
    method: "POST",
    url: "/api/collections/users/confirm-password-reset",
    body: `{
      "token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjRxMXhsY2xtZmxva3UzMyIsImV4cCI6MjUyNDYwNDQ2MSwidHlwZSI6InBhc3N3b3JkUmVzZXQiLCJjb2xsZWN0aW9uSWQiOiJfcGJfdXNlcnNfYXV0aF8iLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20ifQ.xR-xq1oHDy0D8Q4NDOAEyYKGHWd_swzoiSoL8FLFBHY",
      "password":"1234567!",
      "passwordConfirm":"1234567!"
    }`,
    beforeTest: (app: TestApp) => {
      app.OnRecordConfirmPasswordResetRequest().BindFunc((event: any) => {
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
    expectedEvents: { OnRecordConfirmPasswordResetRequest: 1 },
    expectedContent: ["TX_ERROR"],
  },

  // rate limit checks
  // -----------------------------------------------------------
  {
    name: "RateLimit rule - users:confirmPasswordReset",
    method: "POST",
    url: "/api/collections/users/confirm-password-reset",
    body: `{
      "token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjRxMXhsY2xtZmxva3UzMyIsImV4cCI6MjUyNDYwNDQ2MSwidHlwZSI6InBhc3N3b3JkUmVzZXQiLCJjb2xsZWN0aW9uSWQiOiJfcGJfdXNlcnNfYXV0aF8iLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20ifQ.xR-xq1oHDy0D8Q4NDOAEyYKGHWd_swzoiSoL8FLFBHY",
      "password":"1234567!",
      "passwordConfirm":"1234567!"
    }`,
    beforeTest: (app) => {
      app.settings().rateLimits.enabled = true;
      app.settings().rateLimits.rules = [
        { maxRequests: 100, label: "abc", duration: 1 },
        { maxRequests: 100, label: "*:confirmPasswordReset", duration: 1 },
        { maxRequests: 0, label: "users:confirmPasswordReset", duration: 1 },
      ];
    },
    expectedStatus: 429,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "RateLimit rule - *:confirmPasswordReset",
    method: "POST",
    url: "/api/collections/users/confirm-password-reset",
    body: `{
      "token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjRxMXhsY2xtZmxva3UzMyIsImV4cCI6MjUyNDYwNDQ2MSwidHlwZSI6InBhc3N3b3JkUmVzZXQiLCJjb2xsZWN0aW9uSWQiOiJfcGJfdXNlcnNfYXV0aF8iLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20ifQ.xR-xq1oHDy0D8Q4NDOAEyYKGHWd_swzoiSoL8FLFBHY",
      "password":"1234567!",
      "passwordConfirm":"1234567!"
    }`,
    beforeTest: (app) => {
      app.settings().rateLimits.enabled = true;
      app.settings().rateLimits.rules = [
        { maxRequests: 100, label: "abc", duration: 1 },
        { maxRequests: 0, label: "*:confirmPasswordReset", duration: 1 },
      ];
    },
    expectedStatus: 429,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
];

describe("record auth password reset confirm", () => {
  for (const scenario of scenarios) {
    const name = scenario.name ?? "scenario";
    it(name, async () => {
      await runApiScenario(scenario);
    });
  }
});
