// Ported from pocketbase/forms/test_email_send_test.go

import { describe, it } from "bun:test";
import { newTestApp } from "../../tests/test_app.ts";
import { ValidationErrors } from "../internal/compat/validation.ts";
import {
  NewTestEmailSend,
  TestTemplateAuthAlert,
  TestTemplateEmailChange,
  TestTemplateOTP,
  TestTemplatePasswordReset,
  TestTemplateVerification,
} from "./test_email_send.ts";

function assertValidationErrors(result: Error | null, expected: string[]): void {
  let errs: ValidationErrors | null = null;
  if (result) {
    if (!(result instanceof ValidationErrors)) {
      throw new Error(`Failed to parse errors ${result}`);
    }
    errs = result;
  }

  const keys = errs ? Object.keys(errs.errors) : [];
  if (keys.length > expected.length) {
    throw new Error(`Expected error keys ${JSON.stringify(expected)}, got ${JSON.stringify(keys)}`);
  }

  for (const key of expected) {
    if (!errs || !(key in errs.errors)) {
      throw new Error(`Missing expected error key "${key}" in ${errs?.message ?? ""}`);
    }
  }
}

describe("TestEmailSend", () => {
  it("Validate and Submit", async () => {
    const scenarios = [
      { template: "", email: "", collection: "", expectedErrors: ["template", "email"] },
      { template: "invalid", email: "test@example.com", collection: "", expectedErrors: ["template"] },
      { template: TestTemplateVerification, email: "invalid", collection: "", expectedErrors: ["email"] },
      { template: TestTemplateVerification, email: "test@example.com", collection: "invalid", expectedErrors: ["collection"] },
      { template: TestTemplateVerification, email: "test@example.com", collection: "demo1", expectedErrors: ["collection"] },
      { template: TestTemplateVerification, email: "test@example.com", collection: "users", expectedErrors: [] },
      { template: TestTemplatePasswordReset, email: "test@example.com", collection: "", expectedErrors: [] },
      { template: TestTemplateEmailChange, email: "test@example.com", collection: "", expectedErrors: [] },
      { template: TestTemplateOTP, email: "test@example.com", collection: "", expectedErrors: [] },
      { template: TestTemplateAuthAlert, email: "test@example.com", collection: "", expectedErrors: [] },
    ];

    for (const scenario of scenarios) {
      const { app, cleanup } = await newTestApp();
      try {
        const form = NewTestEmailSend(app);
        form.Email = scenario.email;
        form.Template = scenario.template;
        form.Collection = scenario.collection;

        const result = form.Submit();
        assertValidationErrors(result, scenario.expectedErrors);

        const expectedEmails = scenario.expectedErrors.length > 0 ? 0 : 1;
        if (app.testMailer.TotalSend() !== expectedEmails) {
          throw new Error(`Expected ${expectedEmails} email(s) to be sent, got ${app.testMailer.TotalSend()}`);
        }

        if (scenario.expectedErrors.length > 0) {
          continue;
        }

        let expectedContent = "__UNKNOWN_TEMPLATE__";
        switch (scenario.template) {
          case TestTemplatePasswordReset:
            expectedContent = "Reset password";
            break;
          case TestTemplateEmailChange:
            expectedContent = "Confirm new email";
            break;
          case TestTemplateVerification:
            expectedContent = "Verify";
            break;
          case TestTemplateOTP:
            expectedContent = "one-time password";
            break;
          case TestTemplateAuthAlert:
            expectedContent = "from a new location";
            break;
          default:
            break;
        }

        if (!app.testMailer.LastMessage().HTML.includes(expectedContent)) {
          throw new Error(
            `Expected the email to contain ${JSON.stringify(expectedContent)}, got\n${app.testMailer.LastMessage().HTML}`,
          );
        }
      } finally {
        await cleanup();
      }
    }
  });
});
