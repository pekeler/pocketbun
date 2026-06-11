// Ported from pocketbase/forms/test_email_send.go

import type { App } from "../core/app.ts";
import { CollectionNameSuperusers } from "../core/collection_model.ts";
import { NewRecord } from "../core/record_model.ts";
import { ValidationErrors, newError, required } from "../internal/compat/validation.ts";
import {
  SendRecordAuthAlert,
  SendRecordChangeEmail,
  SendRecordOTP,
  SendRecordPasswordReset,
  SendRecordVerification,
} from "../mails/record.ts";
import { NowDateTime } from "../tools/types/index.ts";

export const TestTemplateVerification = "verification";
export const TestTemplatePasswordReset = "password-reset";
export const TestTemplateEmailChange = "email-change";
export const TestTemplateOTP = "otp";
export const TestTemplateAuthAlert = "login-alert";

// TestEmailSend is a email template test request form.
export class TestEmailSend {
  app: App;

  Email = "";
  Template = "";
  Collection = "";

  constructor(app: App) {
    this.app = app;
  }

  // Validate makes the form validatable by implementing [validation.Validatable] interface.
  Validate(): Error | null {
    const errors: Record<string, Error> = {};

    if (this.Collection !== "") {
      if (this.Collection.length < 1 || this.Collection.length > 255) {
        errors.collection = newError("validation_length_out_of_range", "The length must be between 1 and 255.");
      } else {
        const collectionErr = this.checkAuthCollection(this.Collection);
        if (collectionErr) {
          errors.collection = collectionErr;
        }
      }
    }

    const emailRequiredErr = required(this.Email);
    if (emailRequiredErr) {
      errors.email = emailRequiredErr;
    } else if (this.Email.length < 1 || this.Email.length > 255) {
      errors.email = newError("validation_length_out_of_range", "The length must be between 1 and 255.");
    } else if (!isEmail(this.Email)) {
      errors.email = newError("validation_is_email", "Must be a valid email address.");
    }

    const templateRequiredErr = required(this.Template);
    if (templateRequiredErr) {
      errors.template = templateRequiredErr;
    } else if (
      ![
        TestTemplateVerification,
        TestTemplatePasswordReset,
        TestTemplateEmailChange,
        TestTemplateOTP,
        TestTemplateAuthAlert,
      ].includes(this.Template)
    ) {
      errors.template = newError("validation_in_invalid", "Invalid value.");
    }

    return Object.keys(errors).length > 0 ? new ValidationErrors(errors) : null;
  }

  // Submit validates and sends a test email to the form.Email address.
  async Submit(): Promise<Error | null> {
    const err = this.Validate();
    if (err) {
      return err;
    }

    let collectionIdOrName = this.Collection;
    if (collectionIdOrName === "") {
      collectionIdOrName = CollectionNameSuperusers;
    }

    const collection = this.app.findCollectionByNameOrIdOrNull(collectionIdOrName);
    if (!collection) {
      return new Error("Missing or invalid auth collection.");
    }

    const record = NewRecord(collection);
    for (const field of collection.Fields) {
      if (field.GetHidden()) {
        continue;
      }
      record.Set(field.GetName(), `__pb_test_${field.GetName()}__`);
    }
    record.RefreshTokenKey();
    record.SetEmail(this.Email);

    switch (this.Template) {
      case TestTemplateVerification:
        return await SendRecordVerification(this.app, record);
      case TestTemplatePasswordReset:
        return await SendRecordPasswordReset(this.app, record);
      case TestTemplateEmailChange:
        return await SendRecordChangeEmail(this.app, record, this.Email);
      case TestTemplateOTP:
        return await SendRecordOTP(this.app, record, "_PB_TEST_OTP_ID_", "123456");
      case TestTemplateAuthAlert: {
        const testEvent = `${NowDateTime().String()} - TEST_IP TEST_USER_AGENT`;
        return await SendRecordAuthAlert(this.app, record, testEvent);
      }
      default:
        return new Error(`unknown template ${this.Template}`);
    }
  }

  private checkAuthCollection(value: string): Error | null {
    if (value === "") {
      return null;
    }

    const collection = this.app.findCollectionByNameOrIdOrNull(value);
    if (!collection || !collection.IsAuth()) {
      return newError("validation_invalid_auth_collection", "Must be a valid auth collection id or name.");
    }

    return null;
  }
}

// NewTestEmailSend creates and initializes new TestEmailSend form.
export function NewTestEmailSend(app: App): TestEmailSend {
  return new TestEmailSend(app);
}

function isEmail(value: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
}
