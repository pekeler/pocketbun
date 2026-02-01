// Ported from pocketbase/apis/record_auth_password_reset_request.go

import type { App } from "../core/app.ts";
import type { RequestEvent } from "../core/event_request.ts";
import { RecordRequestPasswordResetRequestEvent } from "../core/events.ts";
import { ValidationErrors, newError, required } from "../internal/compat/validation.ts";
import { SendRecordPasswordReset } from "../mails/record.ts";
import { FireAndForget } from "../tools/routine/routine.ts";
import { badRequest, noContent } from "./api_errors.ts";
import { authCollectionNotFound, findAuthCollection, readJsonBody } from "./record_auth_utils.ts";
import { execAfterSuccessTx } from "./record_helpers.ts";

export async function recordRequestPasswordReset(app: App, event: RequestEvent): Promise<Response> {
  const collection = findAuthCollection(app, event);
  if (!collection) {
    return authCollectionNotFound(event);
  }

  if (!collection.PasswordAuth.Enabled) {
    return badRequest(event, "The collection is not configured to allow password authentication.");
  }

  const form = { email: "" };
  const body = await readJsonBody(event);
  if (body.error) {
    return badRequest(event, "An error occurred while loading the submitted data.");
  }
  if (body.data && typeof body.data.email === "string") {
    form.email = body.data.email;
  }

  const validationErr = validatePasswordResetForm(form);
  if (validationErr) {
    return badRequest(event, "An error occurred while validating the submitted data.", validationErr);
  }

  let record = null;
  try {
    record = app.FindAuthRecordByEmail(collection, form.email);
  } catch (_error) {
    return noContent(event, 204);
  }

  const resendKey = getPasswordResetResendKey(record);
  if (app.store().has(resendKey)) {
    return noContent(event, 204);
  }

  const hookEvent = new RecordRequestPasswordResetRequestEvent(event, collection, record);

  const out = await app.OnRecordRequestPasswordResetRequest().Trigger(hookEvent, async () => {
    FireAndForget(() => {
      const sendErr = SendRecordPasswordReset(app, record);
      if (sendErr) {
        app.Logger().Error("Failed to send password reset email", "error", sendErr);
        return;
      }

      app.store().set(resendKey, {});
      setTimeout(
        () => {
          app.store().remove(resendKey);
        },
        2 * 60 * 1000,
      );
    });

    return execAfterSuccessTx(true, app, () => noContent(event, 204));
  });

  if (out instanceof Response) {
    return out;
  }

  return noContent(event, 204);
}

function validatePasswordResetForm(form: { email: string }): Error | null {
  const errors: Record<string, Error> = {};

  const requiredErr = required(form.email);
  if (requiredErr) {
    errors.email = requiredErr;
  } else if (form.email.length < 1 || form.email.length > 255) {
    errors.email = newError("validation_length_out_of_range", "The length must be between 1 and 255.");
  } else if (!isEmail(form.email)) {
    errors.email = newError("validation_is_email", "Must be a valid email address.");
  }

  return Object.keys(errors).length > 0 ? new ValidationErrors(errors) : null;
}

function isEmail(value: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
}

function getPasswordResetResendKey(record: { collection: () => { Id: string }; Id: string }): string {
  return `@limitPasswordResetEmail_${record.collection().Id}${record.Id}`;
}
