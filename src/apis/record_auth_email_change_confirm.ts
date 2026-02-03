// Ported from pocketbase/apis/record_auth_email_change_confirm.go

import type { App } from "../core/app.ts";
import type { RequestEvent } from "../core/event_request.ts";
import { CollectionNameSuperusers } from "../core/collection.ts";
import { RecordConfirmEmailChangeRequestEvent } from "../core/events.ts";
import { TokenClaimNewEmail, TokenTypeEmailChange } from "../core/record_tokens.ts";
import { toStringValue } from "../internal/compat/cast.ts";
import { ValidationErrors, newError, required } from "../internal/compat/validation.ts";
import { decodeUnverifiedJWT } from "../tools/security/jwt.ts";
import { badRequest, noContent } from "./api_errors.ts";
import { authCollectionNotFound, findAuthCollection, readJsonBody } from "./record_auth_utils.ts";
import { execAfterSuccessTx } from "./record_helpers.ts";

export async function recordConfirmEmailChange(app: App, event: RequestEvent): Promise<Response> {
  const collection = findAuthCollection(app, event);
  if (!collection) {
    return authCollectionNotFound(event);
  }

  if (collection.name === CollectionNameSuperusers) {
    return badRequest(event, "All superusers can change their emails directly.");
  }

  const form = { token: "", password: "" };
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
  }

  const validationErr = validateEmailChangeConfirmForm(app, collection.Id, form);
  if (validationErr) {
    return badRequest(event, "An error occurred while validating the submitted data.", validationErr);
  }

  const parsedToken = parseEmailChangeToken(app, collection.Id, form.token);
  if (!parsedToken.record || !parsedToken.newEmail) {
    return badRequest(event, "Invalid or expired token.", parsedToken.error ?? undefined);
  }

  const hookEvent = new RecordConfirmEmailChangeRequestEvent(event, collection, parsedToken.record);
  hookEvent.NewEmail = parsedToken.newEmail;

  const out = await app.OnRecordConfirmEmailChangeRequest().Trigger(hookEvent, async () => {
    parsedToken.record.SetEmail(parsedToken.newEmail);
    parsedToken.record.SetVerified(true);

    const saveErr = await app.Save(parsedToken.record);
    if (saveErr) {
      return badRequest(event, "Failed to confirm email change.", saveErr);
    }

    return execAfterSuccessTx(true, app, () => noContent(event, 204));
  });

  if (out instanceof Response) {
    return out;
  }

  return noContent(event, 204);
}

function validateEmailChangeConfirmForm(
  app: App,
  collectionId: string,
  form: { token: string; password: string },
): Error | null {
  const errors: Record<string, Error> = {};

  const tokenRequired = required(form.token);
  if (tokenRequired) {
    errors.token = tokenRequired;
  } else {
    const tokenErr = checkToken(app, collectionId, form.token);
    if (tokenErr) {
      errors.token = tokenErr;
    }
  }

  const passwordRequired = required(form.password);
  if (passwordRequired) {
    errors.password = passwordRequired;
  } else if (form.password.length < 1 || form.password.length > 100) {
    errors.password = newError("validation_length_out_of_range", "The length must be between 1 and 100.");
  } else {
    const passwordErr = checkPassword(app, collectionId, form.token, form.password);
    if (passwordErr) {
      errors.password = passwordErr;
    }
  }

  return Object.keys(errors).length > 0 ? new ValidationErrors(errors) : null;
}

function checkToken(app: App, collectionId: string, token: string): Error | null {
  const parsed = parseEmailChangeToken(app, collectionId, token);
  return parsed.error ?? null;
}

function checkPassword(app: App, collectionId: string, token: string, password: string): Error | null {
  if (!password) {
    return null;
  }

  const parsed = parseEmailChangeToken(app, collectionId, token);
  if (!parsed.record || !parsed.record.ValidatePassword(password)) {
    return newError("validation_invalid_password", "Missing or invalid auth record password.");
  }

  return null;
}

function parseEmailChangeToken(
  app: App,
  collectionId: string,
  token: string,
): { record: any; newEmail: string; error: Error | null } {
  let newEmail = "";
  try {
    const claims = decodeUnverifiedJWT(token) as Record<string, unknown>;
    newEmail = toStringValue(claims[TokenClaimNewEmail]);
  } catch {
    newEmail = "";
  }

  if (!newEmail) {
    return {
      record: null,
      newEmail: "",
      error: newError("validation_invalid_token_payload", "Invalid token payload - newEmail must be set."),
    };
  }

  try {
    const existing = app.FindAuthRecordByEmail(collectionId, newEmail);
    if (existing) {
      return {
        record: null,
        newEmail: "",
        error: newError("validation_existing_token_email", `The new email address is already registered: ${newEmail}`),
      };
    }
  } catch {
    // ignore missing record
  }

  let record = null;
  try {
    record = app.FindAuthRecordByToken(token, TokenTypeEmailChange);
  } catch {
    return { record: null, newEmail: "", error: newError("validation_invalid_token", "Invalid or expired token.") };
  }

  if (record.collection().Id !== collectionId) {
    return {
      record: null,
      newEmail: "",
      error: newError("validation_token_collection_mismatch", "The provided token is for different auth collection."),
    };
  }

  return { record, newEmail, error: null };
}
