// Ported from pocketbase/apis/record_auth_email_change_request.go

import type { App } from "../core/app.ts";
import type { RequestEvent } from "../core/event_request.ts";
import type { Record as RecordModel } from "../core/record_model.ts";
import { CollectionNameSuperusers } from "../core/collection_model.ts";
import { RecordRequestEmailChangeRequestEvent } from "../core/events.ts";
import { ValidationErrors, newError, required } from "../internal/compat/validation.ts";
import { SendRecordChangeEmail } from "../mails/record.ts";
import { badRequest, forbidden, noContent, unauthorized } from "./api_errors.ts";
import { execAfterSuccessTx } from "./record_helpers.ts";

export async function recordRequestEmailChange(app: App, event: RequestEvent): Promise<Response> {
  const authRecord = event.auth;
  if (!authRecord) {
    return unauthorized(event, "The request requires valid auth record.");
  }

  const collectionId = event.params.collection ?? "";
  let collection = null;
  if (collectionId) {
    try {
      collection = app.FindCachedCollectionByNameOrId(collectionId);
    } catch {
      collection = null;
    }
  }
  if (!collection || authRecord.collection().Id !== collection.Id) {
    return forbidden(event, `The request requires auth record from ${authRecord.collection().name} collection.`);
  }

  if (collection.name === CollectionNameSuperusers) {
    return badRequest(event, "All superusers can change their emails directly.");
  }

  const form = { newEmail: "" };
  if (event.request.body) {
    try {
      const parsed = await event.request.clone().json();
      if (parsed && typeof parsed === "object") {
        const raw = parsed as Record<string, unknown>;
        if (typeof raw.newEmail === "string") {
          form.newEmail = raw.newEmail;
        }
      }
    } catch (_error) {
      return badRequest(event, "An error occurred while loading the submitted data.");
    }
  }

  const validationErr = validateEmailChangeForm(app, authRecord, form);
  if (validationErr) {
    return badRequest(event, "An error occurred while validating the submitted data.", validationErr);
  }

  const hookEvent = new RecordRequestEmailChangeRequestEvent(event, collection, authRecord);
  hookEvent.NewEmail = form.newEmail;

  const out = await app.OnRecordRequestEmailChangeRequest().Trigger(hookEvent, async () => {
    const sendErr = await SendRecordChangeEmail(app, authRecord, form.newEmail);
    if (sendErr) {
      return badRequest(event, "Failed to request email change.", sendErr);
    }

    return execAfterSuccessTx(true, app, () => noContent(event, 204));
  });

  if (out instanceof Response) {
    return out;
  }

  return noContent(event, 204);
}

function validateEmailChangeForm(app: App, record: RecordModel, form: { newEmail: string }): Error | null {
  const errors: Record<string, Error> = {};

  const requiredErr = required(form.newEmail);
  if (requiredErr) {
    errors.newEmail = requiredErr;
  } else if (form.newEmail.length < 1 || form.newEmail.length > 255) {
    errors.newEmail = newError("validation_length_out_of_range", "The length must be between 1 and 255.");
  } else if (!isEmail(form.newEmail)) {
    errors.newEmail = newError("validation_is_email", "Must be a valid email address.");
  } else if (form.newEmail === record.Email()) {
    errors.newEmail = newError("validation_invalid_new_email", "Invalid new email address.");
  } else {
    const uniqueErr = checkUniqueEmail(app, record, form.newEmail);
    if (uniqueErr) {
      errors.newEmail = uniqueErr;
    }
  }

  return Object.keys(errors).length > 0 ? new ValidationErrors(errors) : null;
}

function checkUniqueEmail(app: App, record: RecordModel, value: string): Error | null {
  if (!value) {
    return null;
  }

  let found = null;
  try {
    found = app.FindAuthRecordByEmail(record.collection(), value);
  } catch (_error) {
    found = null;
  }

  if (found && found.Id !== record.Id) {
    return newError("validation_invalid_new_email", "Invalid new email address.");
  }

  return null;
}

function isEmail(value: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
}
