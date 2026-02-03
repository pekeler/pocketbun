// Ported from pocketbase/apis/record_auth_verification_confirm_test.go.

import { describe, it } from "bun:test";
import { runApiScenario, type ApiScenario } from "../tests/api.ts";

type Scenario = ApiScenario & { todo?: boolean };

const scenarios: Scenario[] = [
  {
    name: "empty data",
    method: "POST",
    url: "/api/collections/users/confirm-verification",
    body: "",
    expectedStatus: 400,
    expectedContent: ['"data":{', '"token":{"code":"validation_required"'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "invalid data format",
    method: "POST",
    url: "/api/collections/users/confirm-verification",
    body: '{"password',
    expectedStatus: 400,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "expired token",
    method: "POST",
    url: "/api/collections/users/confirm-verification",
    body: `{
      "token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjRxMXhsY2xtZmxva3UzMyIsImV4cCI6MTY0MDk5MTY2MSwidHlwZSI6InZlcmlmaWNhdGlvbiIsImNvbGxlY3Rpb25JZCI6Il9wYl91c2Vyc19hdXRoXyIsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSJ9.qqelNNL2Udl6K_TJ282sNHYCpASgA6SIuSVKGfBHMZU"
    }`,
    expectedStatus: 400,
    expectedContent: ['"data":{', '"token":{"code":"validation_invalid_token"'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "non-verification token",
    method: "POST",
    url: "/api/collections/users/confirm-verification",
    body: `{
      "token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjRxMXhsY2xtZmxva3UzMyIsImV4cCI6MjUyNDYwNDQ2MSwidHlwZSI6InBhc3N3b3JkUmVzZXQiLCJjb2xsZWN0aW9uSWQiOiJfcGJfdXNlcnNfYXV0aF8iLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20ifQ.xR-xq1oHDy0D8Q4NDOAEyYKGHWd_swzoiSoL8FLFBHY"
    }`,
    expectedStatus: 400,
    expectedContent: ['"data":{', '"token":{"code":"validation_invalid_token"'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "non auth collection",
    method: "POST",
    url: "/api/collections/demo1/confirm-verification?expand=rel,missing",
    body: `{
      "token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjRxMXhsY2xtZmxva3UzMyIsImV4cCI6MjUyNDYwNDQ2MSwidHlwZSI6InZlcmlmaWNhdGlvbiIsImNvbGxlY3Rpb25JZCI6Il9wYl91c2Vyc19hdXRoXyIsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSJ9.SetHpu2H-x-q4TIUz-xiQjwi7MNwLCLvSs4O0hUSp0E"
    }`,
    expectedStatus: 404,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "different auth collection",
    method: "POST",
    url: "/api/collections/clients/confirm-verification?expand=rel,missing",
    body: `{
      "token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjRxMXhsY2xtZmxva3UzMyIsImV4cCI6MjUyNDYwNDQ2MSwidHlwZSI6InZlcmlmaWNhdGlvbiIsImNvbGxlY3Rpb25JZCI6Il9wYl91c2Vyc19hdXRoXyIsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSJ9.SetHpu2H-x-q4TIUz-xiQjwi7MNwLCLvSs4O0hUSp0E"
    }`,
    expectedStatus: 400,
    expectedContent: ['"data":{"token":{"code":"validation_token_collection_mismatch"'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "valid token",
    method: "POST",
    url: "/api/collections/users/confirm-verification",
    body: `{
      "token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjRxMXhsY2xtZmxva3UzMyIsImV4cCI6MjUyNDYwNDQ2MSwidHlwZSI6InZlcmlmaWNhdGlvbiIsImNvbGxlY3Rpb25JZCI6Il9wYl91c2Vyc19hdXRoXyIsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSJ9.SetHpu2H-x-q4TIUz-xiQjwi7MNwLCLvSs4O0hUSp0E"
    }`,
    expectedStatus: 204,
    expectedEvents: {
      "*": 0,
      OnRecordConfirmVerificationRequest: 1,
      OnModelUpdate: 1,
      OnModelValidate: 1,
      OnModelUpdateExecute: 1,
      OnModelAfterUpdateSuccess: 1,
      OnRecordUpdate: 1,
      OnRecordValidate: 1,
      OnRecordUpdateExecute: 1,
      OnRecordAfterUpdateSuccess: 1,
    },
  },
  {
    name: "valid token (already verified)",
    method: "POST",
    url: "/api/collections/users/confirm-verification",
    body: `{
      "token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Im9hcDY0MGNvdDR5cnUycyIsImV4cCI6MjUyNDYwNDQ2MSwidHlwZSI6InZlcmlmaWNhdGlvbiIsImNvbGxlY3Rpb25JZCI6Il9wYl91c2Vyc19hdXRoXyIsImVtYWlsIjoidGVzdDJAZXhhbXBsZS5jb20ifQ.QQmM3odNFVk6u4J4-5H8IBM3dfk9YCD7mPW-8PhBAI8"
    }`,
    expectedStatus: 204,
    expectedEvents: {
      "*": 0,
      OnRecordConfirmVerificationRequest: 1,
    },
  },
  {
    name: "valid verification token from a collection without allowed login",
    method: "POST",
    url: "/api/collections/nologin/confirm-verification",
    body: `{
      "token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImRjNDlrNmpnZWpuNDBoMyIsImV4cCI6MjUyNDYwNDQ2MSwidHlwZSI6InZlcmlmaWNhdGlvbiIsImNvbGxlY3Rpb25JZCI6ImtwdjcwOXNrMmxxYnFrOCIsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSJ9.5GmuZr4vmwk3Cb_3ZZWNxwbE75KZC-j71xxIPR9AsVw"
    }`,
    expectedStatus: 204,
    expectedContent: [],
    expectedEvents: {
      "*": 0,
      OnRecordConfirmVerificationRequest: 1,
      OnModelUpdate: 1,
      OnModelValidate: 1,
      OnModelUpdateExecute: 1,
      OnModelAfterUpdateSuccess: 1,
      OnRecordUpdate: 1,
      OnRecordValidate: 1,
      OnRecordUpdateExecute: 1,
      OnRecordAfterUpdateSuccess: 1,
    },
  },
  {
    name: "OnRecordConfirmVerificationRequest tx body write check",
    method: "POST",
    url: "/api/collections/users/confirm-verification",
    body: `{
      "token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjRxMXhsY2xtZmxva3UzMyIsImV4cCI6MjUyNDYwNDQ2MSwidHlwZSI6InZlcmlmaWNhdGlvbiIsImNvbGxlY3Rpb25JZCI6Il9wYl91c2Vyc19hdXRoXyIsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSJ9.SetHpu2H-x-q4TIUz-xiQjwi7MNwLCLvSs4O0hUSp0E"
    }`,
    beforeTest: (app) => {
      app.OnRecordConfirmVerificationRequest().BindFunc(async (event: any) => {
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
    expectedEvents: { OnRecordConfirmVerificationRequest: 1 },
    expectedContent: ["TX_ERROR"],
  },

  // rate limit checks
  // -----------------------------------------------------------
  {
    name: "RateLimit rule - nologin:confirmVerification",
    method: "POST",
    url: "/api/collections/nologin/confirm-verification",
    body: `{
      "token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImRjNDlrNmpnZWpuNDBoMyIsImV4cCI6MjUyNDYwNDQ2MSwidHlwZSI6InZlcmlmaWNhdGlvbiIsImNvbGxlY3Rpb25JZCI6ImtwdjcwOXNrMmxxYnFrOCIsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSJ9.5GmuZr4vmwk3Cb_3ZZWNxwbE75KZC-j71xxIPR9AsVw"
    }`,
    beforeTest: (app) => {
      app.settings().rateLimits.enabled = true;
      app.settings().rateLimits.rules = [
        { maxRequests: 100, label: "abc", duration: 1 },
        { maxRequests: 100, label: "*:confirmVerification", duration: 1 },
        { maxRequests: 0, label: "nologin:confirmVerification", duration: 1 },
      ];
    },
    expectedStatus: 429,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
  {
    name: "RateLimit rule - *:confirmVerification",
    method: "POST",
    url: "/api/collections/nologin/confirm-verification",
    body: `{
      "token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImRjNDlrNmpnZWpuNDBoMyIsImV4cCI6MjUyNDYwNDQ2MSwidHlwZSI6InZlcmlmaWNhdGlvbiIsImNvbGxlY3Rpb25JZCI6ImtwdjcwOXNrMmxxYnFrOCIsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSJ9.5GmuZr4vmwk3Cb_3ZZWNxwbE75KZC-j71xxIPR9AsVw"
    }`,
    beforeTest: (app) => {
      app.settings().rateLimits.enabled = true;
      app.settings().rateLimits.rules = [
        { maxRequests: 100, label: "abc", duration: 1 },
        { maxRequests: 0, label: "*:confirmVerification", duration: 1 },
      ];
    },
    expectedStatus: 429,
    expectedContent: ['"data":{}'],
    expectedEvents: { "*": 0 },
  },
];

describe("record auth verification confirm", () => {
  for (const scenario of scenarios) {
    const name = scenario.name ?? "scenario";
    it(name, async () => {
      await runApiScenario(scenario);
    });
  }
});
