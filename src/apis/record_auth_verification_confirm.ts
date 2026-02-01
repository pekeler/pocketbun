// Ported from pocketbase/apis/record_auth_verification_confirm.go

import type { App } from "../core/app.ts";
import type { RequestEvent } from "../core/event_request.ts";
import { CollectionNameSuperusers } from "../core/collection.ts";
import { RecordConfirmVerificationRequestEvent } from "../core/events.ts";
import { TokenClaimEmail, TokenTypeVerification } from "../core/record_tokens.ts";
import { toStringValue } from "../internal/compat/cast.ts";
import { ValidationErrors, newError, required } from "../internal/compat/validation.ts";
import { decodeUnverifiedJWT } from "../tools/security/jwt.ts";
import { badRequest, noContent } from "./api_errors.ts";
import { authCollectionNotFound, findAuthCollection, readJsonBody } from "./record_auth_utils.ts";
import { execAfterSuccessTx } from "./record_helpers.ts";

export async function recordConfirmVerification(app: App, event: RequestEvent): Promise<Response> {
  const collection = findAuthCollection(app, event);
  if (!collection) {
    return authCollectionNotFound(event);
  }

  if (collection.name === CollectionNameSuperusers) {
    return badRequest(event, "All superusers are verified by default.");
  }

  const form = { token: "" };
  const body = await readJsonBody(event);
  if (body.error) {
    return badRequest(event, "An error occurred while loading the submitted data.");
  }
  if (body.data && typeof body.data.token === "string") {
    form.token = body.data.token;
  }

  const validationErr = validateConfirmVerificationForm(app, collection.Id, form);
  if (validationErr) {
    return badRequest(event, "An error occurred while validating the submitted data.", validationErr);
  }

  let record = null;
  try {
    record = app.FindAuthRecordByToken(form.token, TokenTypeVerification);
  } catch (error) {
    return badRequest(event, "Invalid or expired verification token.", error);
  }

  const wasVerified = record.Verified();
  const hookEvent = new RecordConfirmVerificationRequestEvent(event, collection, record);

  const out = await app.OnRecordConfirmVerificationRequest().Trigger(hookEvent, async () => {
    if (!wasVerified) {
      record.SetVerified(true);
      const saveErr = app.Save(record);
      if (saveErr) {
        return badRequest(event, "An error occurred while saving the verified state.", saveErr);
      }
    }

    app.store().remove(getVerificationResendKey(record));

    return execAfterSuccessTx(true, app, () => noContent(event, 204));
  });

  if (out instanceof Response) {
    return out;
  }

  return noContent(event, 204);
}

function validateConfirmVerificationForm(app: App, collectionId: string, form: { token: string }): Error | null {
  const errors: Record<string, Error> = {};

  const requiredErr = required(form.token);
  if (requiredErr) {
    errors.token = requiredErr;
  } else {
    const tokenErr = checkToken(app, collectionId, form.token);
    if (tokenErr) {
      errors.token = tokenErr;
    }
  }

  return Object.keys(errors).length > 0 ? new ValidationErrors(errors) : null;
}

function checkToken(app: App, collectionId: string, token: string): Error | null {
  if (!token) {
    return null;
  }

  let email = "";
  try {
    const claims = decodeUnverifiedJWT(token) as Record<string, unknown>;
    email = toStringValue(claims[TokenClaimEmail]);
  } catch {
    email = "";
  }

  if (!email) {
    return newError("validation_invalid_token_claims", "Missing email token claim.");
  }

  let record = null;
  try {
    record = app.FindAuthRecordByToken(token, TokenTypeVerification);
  } catch {
    return newError("validation_invalid_token", "Invalid or expired token.");
  }

  if (record.collection().Id !== collectionId) {
    return newError("validation_token_collection_mismatch", "The provided token is for different auth collection.");
  }

  if (record.Email() !== email) {
    return newError("validation_token_email_mismatch", "The record email doesn't match with the requested token claims.");
  }

  return null;
}

function getVerificationResendKey(record: { collection: () => { Id: string }; Id: string }): string {
  return `@limitVerificationEmail_${record.collection().Id}${record.Id}`;
}
