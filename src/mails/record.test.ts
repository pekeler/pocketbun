// Ported from pocketbase/mails/record_test.go

import { describe, it } from "bun:test";
import { newTestApp } from "../tests/app.ts";
import {
  SendRecordAuthAlert,
  SendRecordChangeEmail,
  SendRecordOTP,
  SendRecordPasswordReset,
  SendRecordVerification,
} from "./record.ts";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

describe("mails/record", () => {
  it("SendRecordAuthAlert", async () => {
    const { app: testApp, cleanup } = await newTestApp();
    try {
      const info = "<p>test_info</p>";
      const user = testApp.FindFirstRecordByData("users", "email", "test@example.com");

      // to test that it is escaped
      user.Set("name", `<p>${user.GetString("name")}</p>`);

      const err = await SendRecordAuthAlert(testApp, user, info);
      if (err) {
        throw err;
      }

      if (testApp.testMailer.TotalSend() !== 1) {
        throw new Error(`Expected one email to be sent, got ${testApp.testMailer.TotalSend()}`);
      }

      const expectedParts = [
        `${escapeHtml(user.GetString("name"))}{RECORD:tokenKey}`, // public and private record placeholder checks
        `login to your ${testApp.settings().meta.appName} account from a new location`,
        "If this was you",
        "If this wasn't you",
        escapeHtml(info),
      ];
      for (const part of expectedParts) {
        if (!testApp.testMailer.LastMessage().HTML.includes(part)) {
          throw new Error(`Couldn't find ${part}\nin\n${testApp.testMailer.LastMessage().HTML}`);
        }
      }
    } finally {
      await cleanup();
    }
  });

  it("SendRecordPasswordReset", async () => {
    const { app: testApp, cleanup } = await newTestApp();
    try {
      const user = testApp.FindFirstRecordByData("users", "email", "test@example.com");

      // to test that it is escaped
      user.Set("name", `<p>${user.GetString("name")}</p>`);

      const err = await SendRecordPasswordReset(testApp, user);
      if (err) {
        throw err;
      }

      if (testApp.testMailer.TotalSend() !== 1) {
        throw new Error(`Expected one email to be sent, got ${testApp.testMailer.TotalSend()}`);
      }

      const expectedParts = [
        `${escapeHtml(user.GetString("name"))}{RECORD:tokenKey}`, // the record name as {RECORD:name}
        "http://localhost:8090/_/#/auth/confirm-password-reset/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.",
      ];
      for (const part of expectedParts) {
        if (!testApp.testMailer.LastMessage().HTML.includes(part)) {
          throw new Error(`Couldn't find ${part}\nin\n${testApp.testMailer.LastMessage().HTML}`);
        }
      }
    } finally {
      await cleanup();
    }
  });

  it("SendRecordVerification", async () => {
    const { app: testApp, cleanup } = await newTestApp();
    try {
      const user = testApp.FindFirstRecordByData("users", "email", "test@example.com");

      // to test that it is escaped
      user.Set("name", `<p>${user.GetString("name")}</p>`);

      const err = await SendRecordVerification(testApp, user);
      if (err) {
        throw err;
      }

      if (testApp.testMailer.TotalSend() !== 1) {
        throw new Error(`Expected one email to be sent, got ${testApp.testMailer.TotalSend()}`);
      }

      const expectedParts = [
        `${escapeHtml(user.GetString("name"))}{RECORD:tokenKey}`, // the record name as {RECORD:name}
        "http://localhost:8090/_/#/auth/confirm-verification/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.",
      ];
      for (const part of expectedParts) {
        if (!testApp.testMailer.LastMessage().HTML.includes(part)) {
          throw new Error(`Couldn't find ${part}\nin\n${testApp.testMailer.LastMessage().HTML}`);
        }
      }
    } finally {
      await cleanup();
    }
  });

  it("SendRecordChangeEmail", async () => {
    const { app: testApp, cleanup } = await newTestApp();
    try {
      const user = testApp.FindFirstRecordByData("users", "email", "test@example.com");

      // to test that it is escaped
      user.Set("name", `<p>${user.GetString("name")}</p>`);

      const err = await SendRecordChangeEmail(testApp, user, "new_test@example.com");
      if (err) {
        throw err;
      }

      if (testApp.testMailer.TotalSend() !== 1) {
        throw new Error(`Expected one email to be sent, got ${testApp.testMailer.TotalSend()}`);
      }

      const expectedParts = [
        `${escapeHtml(user.GetString("name"))}{RECORD:tokenKey}`, // the record name as {RECORD:name}
        "http://localhost:8090/_/#/auth/confirm-email-change/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.",
      ];
      for (const part of expectedParts) {
        if (!testApp.testMailer.LastMessage().HTML.includes(part)) {
          throw new Error(`Couldn't find ${part}\nin\n${testApp.testMailer.LastMessage().HTML}`);
        }
      }
    } finally {
      await cleanup();
    }
  });

  it("SendRecordOTP", async () => {
    const { app: testApp, cleanup } = await newTestApp();
    try {
      const user = testApp.FindFirstRecordByData("users", "email", "test@example.com");

      // to test that it is escaped
      user.Set("name", `<p>${user.GetString("name")}</p>`);

      const err = await SendRecordOTP(testApp, user, "test_otp_id", "test_otp_code");
      if (err) {
        throw err;
      }

      if (testApp.testMailer.TotalSend() !== 1) {
        throw new Error(`Expected one email to be sent, got ${testApp.testMailer.TotalSend()}`);
      }

      const expectedParts = [
        `${escapeHtml(user.GetString("name"))}{RECORD:tokenKey}`, // the record name as {RECORD:name}
        "one-time password",
        "test_otp_code",
      ];
      for (const part of expectedParts) {
        if (!testApp.testMailer.LastMessage().HTML.includes(part)) {
          throw new Error(`Couldn't find ${part}\nin\n${testApp.testMailer.LastMessage().HTML}`);
        }
      }
    } finally {
      await cleanup();
    }
  });
});
