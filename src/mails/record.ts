// Ported from pocketbase/mails/record.go

import type { App } from "../core/app.ts";
import type { EmailTemplate } from "../core/collection_model_auth_options.ts";
import type { Record as RecordModel } from "../core/record.ts";
import type { Message } from "../tools/mailer/mailer.ts";
import {
  EmailPlaceholderAlertInfo,
  EmailPlaceholderAppName,
  EmailPlaceholderAppURL,
  EmailPlaceholderOTP,
  EmailPlaceholderOTPId,
  EmailPlaceholderToken,
} from "../core/collection_model_auth_templates.ts";
import { MailerRecordEvent } from "../core/events.ts";
import { FieldTypeAutodate } from "../core/field_autodate.ts";
import { FieldTypeBool } from "../core/field_bool.ts";
import { FieldTypeDate } from "../core/field_date.ts";
import { FieldTypeNumber } from "../core/field_number.ts";
import { resolveTemplateContent } from "./base.ts";
import { HTMLBody } from "./templates/html_content.ts";
import { Layout } from "./templates/layout.ts";

const nonescapeTypes = [FieldTypeAutodate, FieldTypeDate, FieldTypeBool, FieldTypeNumber];

// SendRecordAuthAlert sends a new device login alert to the specified auth record.
export async function SendRecordAuthAlert(app: App, authRecord: RecordModel, info: string): Promise<Error | null> {
  const mailClient = app.NewMailClient();

  const sanitizedInfo = escapeHtml(info);

  const { subject, body, error } = resolveEmailTemplate(app, authRecord, authRecord.collection().AuthAlert.EmailTemplate, {
    [EmailPlaceholderAlertInfo]: sanitizedInfo,
  });
  if (error) {
    return error;
  }

  const message: Message = {
    From: {
      Name: app.settings().meta.senderName,
      Address: app.settings().meta.senderAddress,
    },
    To: [{ Address: authRecord.Email() }],
    Bcc: [],
    Cc: [],
    Subject: subject,
    HTML: body,
    Text: "",
  };

  const event = new MailerRecordEvent(app, mailClient, message, authRecord, { info: sanitizedInfo });

  const result = await app.OnMailerRecordAuthAlertSend().Trigger(event, (e) => {
    return e.Mailer.Send(e.Message);
  });

  return result instanceof Error ? result : null;
}

// SendRecordOTP sends OTP email to the specified auth record.
//
// This method will also update the "sentTo" field of the related OTP record to the mail sent To address (if the OTP exists and not already assigned).
export async function SendRecordOTP(app: App, authRecord: RecordModel, otpId: string, pass: string): Promise<Error | null> {
  const mailClient = app.NewMailClient();

  const { subject, body, error } = resolveEmailTemplate(app, authRecord, authRecord.collection().OTP.EmailTemplate, {
    [EmailPlaceholderOTPId]: otpId,
    [EmailPlaceholderOTP]: pass,
  });
  if (error) {
    return error;
  }

  const message: Message = {
    From: {
      Name: app.settings().meta.senderName,
      Address: app.settings().meta.senderAddress,
    },
    To: [{ Address: authRecord.Email() }],
    Bcc: [],
    Cc: [],
    Subject: subject,
    HTML: body,
    Text: "",
  };

  const event = new MailerRecordEvent(app, mailClient, message, authRecord, {
    otpId,
    password: pass,
  });

  const result = await app.OnMailerRecordOTPSend().Trigger(event, async (e) => {
    const sendErr = e.Mailer.Send(e.Message);
    if (sendErr instanceof Error) {
      return sendErr;
    }

    const toAddress = e.Message.To?.[0]?.Address ?? "";
    if (!toAddress) {
      return null;
    }

    let otp = null;
    try {
      otp = e.App.FindOTPById(otpId);
    } catch (err) {
      e.App.Logger().Warn(
        "Unable to find OTP to update its sentTo field (either it was already deleted or the id is nonexisting)",
        "error",
        err,
        "otpId",
        otpId,
      );
      return null;
    }

    if (otp.SentTo() !== "") {
      return null;
    }

    otp.SetSentTo(toAddress);
    const saveErr = await e.App.Save(otp);
    if (saveErr) {
      e.App.Logger().Error("Failed to update OTP sentTo field", "error", saveErr, "otpId", otpId, "to", toAddress);
    }

    return null;
  });

  return result instanceof Error ? result : null;
}

// SendRecordPasswordReset sends a password reset request email to the specified auth record.
export async function SendRecordPasswordReset(app: App, authRecord: RecordModel): Promise<Error | null> {
  let token = "";
  try {
    token = authRecord.NewPasswordResetToken();
  } catch (err) {
    return err as Error;
  }

  const mailClient = app.NewMailClient();

  const { subject, body, error } = resolveEmailTemplate(app, authRecord, authRecord.collection().ResetPasswordTemplate, {
    [EmailPlaceholderToken]: token,
  });
  if (error) {
    return error;
  }

  const message: Message = {
    From: {
      Name: app.settings().meta.senderName,
      Address: app.settings().meta.senderAddress,
    },
    To: [{ Address: authRecord.Email() }],
    Bcc: [],
    Cc: [],
    Subject: subject,
    HTML: body,
    Text: "",
  };

  const event = new MailerRecordEvent(app, mailClient, message, authRecord, { token });

  const result = await app.OnMailerRecordPasswordResetSend().Trigger(event, (e) => {
    return e.Mailer.Send(e.Message);
  });

  return result instanceof Error ? result : null;
}

// SendRecordVerification sends a verification request email to the specified auth record.
export async function SendRecordVerification(app: App, authRecord: RecordModel): Promise<Error | null> {
  let token = "";
  try {
    token = authRecord.NewVerificationToken();
  } catch (err) {
    return err as Error;
  }

  const mailClient = app.NewMailClient();

  const { subject, body, error } = resolveEmailTemplate(app, authRecord, authRecord.collection().VerificationTemplate, {
    [EmailPlaceholderToken]: token,
  });
  if (error) {
    return error;
  }

  const message: Message = {
    From: {
      Name: app.settings().meta.senderName,
      Address: app.settings().meta.senderAddress,
    },
    To: [{ Address: authRecord.Email() }],
    Bcc: [],
    Cc: [],
    Subject: subject,
    HTML: body,
    Text: "",
  };

  const event = new MailerRecordEvent(app, mailClient, message, authRecord, { token });

  const result = await app.OnMailerRecordVerificationSend().Trigger(event, (e) => {
    return e.Mailer.Send(e.Message);
  });

  return result instanceof Error ? result : null;
}

// SendRecordChangeEmail sends a change email confirmation email to the specified auth record.
export async function SendRecordChangeEmail(app: App, authRecord: RecordModel, newEmail: string): Promise<Error | null> {
  let token = "";
  try {
    token = authRecord.NewEmailChangeToken(newEmail);
  } catch (err) {
    return err as Error;
  }

  const mailClient = app.NewMailClient();

  const { subject, body, error } = resolveEmailTemplate(app, authRecord, authRecord.collection().ConfirmEmailChangeTemplate, {
    [EmailPlaceholderToken]: token,
  });
  if (error) {
    return error;
  }

  const message: Message = {
    From: {
      Name: app.settings().meta.senderName,
      Address: app.settings().meta.senderAddress,
    },
    To: [{ Address: newEmail }],
    Bcc: [],
    Cc: [],
    Subject: subject,
    HTML: body,
    Text: "",
  };

  const event = new MailerRecordEvent(app, mailClient, message, authRecord, { token, newEmail });

  const result = await app.OnMailerRecordEmailChangeSend().Trigger(event, (e) => {
    return e.Mailer.Send(e.Message);
  });

  return result instanceof Error ? result : null;
}

type ResolveResult = {
  subject: string;
  body: string;
  error: Error | null;
};

function resolveEmailTemplate(
  app: App,
  authRecord: RecordModel,
  emailTemplate: EmailTemplate,
  placeholders: Record<string, unknown> | null,
): ResolveResult {
  const data = placeholders ? { ...placeholders } : {};

  if (!(EmailPlaceholderAppName in data)) {
    data[EmailPlaceholderAppName] = app.settings().meta.appName;
  }
  if (!(EmailPlaceholderAppURL in data)) {
    data[EmailPlaceholderAppURL] = app.settings().meta.appURL;
  }

  for (const field of authRecord.collection().Fields) {
    if (field.GetHidden()) {
      continue;
    }
    const placeholder = `{RECORD:${field.GetName()}}`;
    if (placeholder in data) {
      continue;
    }

    let value = authRecord.GetString(field.GetName());
    if (!nonescapeTypes.includes(field.Type())) {
      value = escapeHtml(value);
    }
    data[placeholder] = value;
  }

  const resolved = emailTemplate.Resolve(data);
  const rawBody = resolved.body;

  const body = resolveTemplateContent({ HTMLContent: rawBody }, Layout, HTMLBody);

  return { subject: resolved.subject, body, error: null };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
