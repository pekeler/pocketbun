// Ported from pocketbase/apis/record_auth_password_reset_confirm.go

import type { App } from "../core/app.ts";
import type { RequestEvent } from "../core/event_request.ts";
import { RecordConfirmPasswordResetRequestEvent } from "../core/events.ts";
import { PasswordField } from "../core/field_password.ts";
import { FieldNamePassword } from "../core/record_model.ts";
import { TokenClaimEmail, TokenTypePasswordReset } from "../core/record_tokens.ts";
import { Equal } from "../core/validators/equal.ts";
import { toStringValue } from "../internal/compat/cast.ts";
import { ValidationErrors, newError, required } from "../internal/compat/validation.ts";
import { parseUnverifiedJWT } from "../tools/security/jwt.ts";
import { badRequest, noContent } from "./api_errors.ts";
import { authCollectionNotFound, findAuthCollection, readJsonBody } from "./record_auth_utils.ts";
import { execAfterSuccessTx } from "./record_helpers.ts";

export async function recordConfirmPasswordReset(app: App, event: RequestEvent): Promise<Response> {
  const collection = findAuthCollection(app, event);
  if (!collection) {
    return authCollectionNotFound(event);
  }

  const form = { token: "", password: "", passwordConfirm: "" };
  const body = await readJsonBody(event);
  if (body.error) {
    return badRequest(event, "An error occurred while loading the submitted data.");
  }
  if (body.data) {
    if (typeof body.data.token === "string") {
      form.token = body.data.token;
    }
    if (typeof body.data.password === "string") {
      form.password = body.data.password;
    }
    if (typeof body.data.passwordConfirm === "string") {
      form.passwordConfirm = body.data.passwordConfirm;
    }
  }

  const validationErr = validateConfirmPasswordResetForm(app, collection, form);
  if (validationErr) {
    return badRequest(event, "An error occurred while validating the submitted data.", validationErr);
  }

  let authRecord = null;
  try {
    authRecord = app.FindAuthRecordByToken(form.token, TokenTypePasswordReset);
  } catch (error) {
    return badRequest(event, "Invalid or expired password reset token.", error);
  }

  const hookEvent = new RecordConfirmPasswordResetRequestEvent(event, collection, authRecord);

  const out = await app.OnRecordConfirmPasswordResetRequest().Trigger(hookEvent, async () => {
    authRecord.SetPassword(form.password);

    if (!authRecord.Verified()) {
      try {
        const claims = parseUnverifiedJWT(form.token);
        const email = toStringValue((claims as Record<string, unknown>)[TokenClaimEmail]);
        if (email && authRecord.Email() === email) {
          authRecord.SetVerified(true);
        }
      } catch {
        // ignore invalid token payload
      }
    }

    const saveErr = await app.Save(authRecord);
    if (saveErr) {
      return badRequest(event, "Failed to set new password.", saveErr);
    }

    app.store().remove(getPasswordResetResendKey(authRecord));

    return execAfterSuccessTx(true, app, () => noContent(event, 204));
  });

  if (out instanceof Response) {
    return out;
  }

  return noContent(event, 204);
}

function validateConfirmPasswordResetForm(
  app: App,
  collection: { Fields: { GetByName: (name: string) => unknown }; Id: string },
  form: { token: string; password: string; passwordConfirm: string },
): Error | null {
  const errors: Record<string, Error> = {};

  const tokenRequired = required(form.token);
  if (tokenRequired) {
    errors.token = tokenRequired;
  } else {
    const tokenErr = checkToken(app, collection.Id, form.token);
    if (tokenErr) {
      errors.token = tokenErr;
    }
  }

  let min = 1;
  const passField = collection.Fields.GetByName(FieldNamePassword);
  if (passField instanceof PasswordField && passField.Min > 0) {
    min = passField.Min;
  }

  const passwordRequired = required(form.password);
  if (passwordRequired) {
    errors.password = passwordRequired;
  } else if (form.password.length < min || form.password.length > 255) {
    errors.password = newError("validation_length_out_of_range", `The length must be between ${min} and 255.`);
  }

  const confirmRequired = required(form.passwordConfirm);
  if (confirmRequired) {
    errors.passwordConfirm = confirmRequired;
  } else {
    const eqErr = Equal(form.password)(form.passwordConfirm);
    if (eqErr) {
      errors.passwordConfirm = eqErr;
    }
  }

  return Object.keys(errors).length > 0 ? new ValidationErrors(errors) : null;
}

function checkToken(app: App, collectionId: string, token: string): Error | null {
  if (!token) {
    return null;
  }

  let record = null;
  try {
    record = app.FindAuthRecordByToken(token, TokenTypePasswordReset);
  } catch {
    return newError("validation_invalid_token", "Invalid or expired token.");
  }

  if (record.collection().Id !== collectionId) {
    return newError("validation_token_collection_mismatch", "The provided token is for different auth collection.");
  }

  return null;
}

function getPasswordResetResendKey(record: { collection: () => { Id: string }; Id: string }): string {
  return `@limitPasswordResetEmail_${record.collection().Id}${record.Id}`;
}
