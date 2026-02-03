// Ported from pocketbase/apis/record_auth_with_password.go

import type { App } from "../core/app.ts";
import type { Collection } from "../core/collection_model.ts";
import type { RequestEvent } from "../core/event_request.ts";
import type { Record as RecordModel } from "../core/record_model.ts";
import { RequestEventKeyInfoContext, RequestInfoContextPasswordAuth } from "../core/event_request.ts";
import { RecordAuthWithPasswordRequestEvent } from "../core/events.ts";
import { MFAMethodPassword } from "../core/mfa_model.ts";
import { ValidationError, ValidationErrors, ErrRequired, newError, required } from "../internal/compat/validation.ts";
import { findSingleColumnUniqueIndex } from "../tools/dbutils/index.ts";
import { HashExp, NewExp } from "../tools/dbx/expr.ts";
import { authCollectionNotFound, findAuthCollection } from "./record_auth_utils.ts";
import { RecordAuthResponse } from "./record_helpers.ts";

export async function recordAuthWithPassword(app: App, event: RequestEvent): Promise<Response> {
  const collection = findAuthCollection(app, event);
  if (!collection) {
    return authCollectionNotFound(event);
  }

  if (!collection.PasswordAuth.Enabled) {
    return forbidden(event, "The collection is not configured to allow password authentication.");
  }

  const form = {
    identity: "",
    password: "",
    identityField: "",
  };

  if (event.request.body) {
    try {
      const parsed = await event.request.clone().json();
      if (parsed && typeof parsed === "object") {
        const raw = parsed as Record<string, unknown>;
        if (typeof raw.identity === "string") {
          form.identity = raw.identity;
        }
        if (typeof raw.password === "string") {
          form.password = raw.password;
        }
        if (typeof raw.identityField === "string") {
          form.identityField = raw.identityField;
        }
      }
    } catch (_error) {
      return badRequest(event, "An error occurred while loading the submitted data.");
    }
  }

  const validationErr = validateAuthWithPasswordForm(form, collection);
  if (validationErr) {
    return badRequest(event, "An error occurred while validating the submitted data.", validationErr);
  }

  event.Set(RequestEventKeyInfoContext, RequestInfoContextPasswordAuth);
  await event.requestInfo();

  let foundRecord: RecordModel | null = null;
  let foundErr: Error | null = null;

  if (form.identityField) {
    const result = findRecordByIdentityField(app, collection, form.identityField, form.identity);
    foundRecord = result.record;
    foundErr = result.error;
  } else {
    let identityFields = [...(collection.PasswordAuth.IdentityFields ?? [])];

    if (identityFields.length > 1 && identityFields[0] !== "email" && identityFields.includes("email")) {
      identityFields = ["email", ...identityFields.filter((field) => field !== "email")];
    }

    for (const field of identityFields) {
      if (field === "email" && !isEmail(form.identity)) {
        continue;
      }

      const result = findRecordByIdentityField(app, collection, field, form.identity);
      foundRecord = result.record;
      foundErr = result.error;
      if (!foundErr) {
        break;
      }
    }
  }

  if (foundErr && foundErr.message !== "record not found") {
    return internalServerError(event, "", foundErr);
  }

  const hookEvent = new RecordAuthWithPasswordRequestEvent(event, collection, foundRecord);
  hookEvent.Identity = form.identity;
  hookEvent.Password = form.password;
  hookEvent.IdentityField = form.identityField;

  const out = await app.OnRecordAuthWithPasswordRequest().Trigger(hookEvent, async () => {
    if (!hookEvent.Record || !hookEvent.Record.ValidatePassword(hookEvent.Password)) {
      return badRequest(event, "Failed to authenticate.");
    }

    return RecordAuthResponse(event, hookEvent.Record, MFAMethodPassword, null);
  });

  if (out instanceof Response) {
    return out;
  }

  return badRequest(event, "Failed to authenticate.");
}

type AuthWithPasswordForm = {
  identity: string;
  password: string;
  identityField: string;
};

function validateAuthWithPasswordForm(form: AuthWithPasswordForm, collection: Collection): Error | null {
  const errors: Record<string, Error> = {};

  if (required(form.identity)) {
    errors.identity = ErrRequired;
  } else if (form.identity.length < 1 || form.identity.length > 255) {
    errors.identity = newError("validation_length", "The length must be between 1 and 255.");
  }

  if (required(form.password)) {
    errors.password = ErrRequired;
  } else if (form.password.length < 1 || form.password.length > 255) {
    errors.password = newError("validation_length", "The length must be between 1 and 255.");
  }

  if (form.identityField) {
    if (form.identityField.length < 1 || form.identityField.length > 255) {
      errors.identityField = newError("validation_length", "The length must be between 1 and 255.");
    } else {
      const identityFields = collection.PasswordAuth.IdentityFields ?? [];
      if (!identityFields.includes(form.identityField)) {
        errors.identityField = newError("validation_in_invalid", "Invalid value.");
      }
    }
  }

  return Object.keys(errors).length > 0 ? new ValidationErrors(errors) : null;
}

type FindResult = { record: RecordModel | null; error: Error | null };

function findRecordByIdentityField(app: App, collection: Collection, field: string, value: unknown): FindResult {
  if (!(collection.PasswordAuth.IdentityFields ?? []).includes(field)) {
    return { record: null, error: new Error(`invalid identity field ${field}`) };
  }

  const [index, ok] = findSingleColumnUniqueIndex(collection.indexes ?? [], field);
  if (!ok) {
    return { record: null, error: new Error(`missing ${field} unique index constraint`) };
  }

  let expr;
  if ((index.columns[0]?.collate ?? "").toLowerCase() === "nocase") {
    expr = NewExp(`[[${field}]] = {:identity} COLLATE NOCASE`, { identity: value });
  } else {
    expr = HashExp({ [field]: value });
  }

  try {
    const record = app.RecordQuery(collection).AndWhere(expr).Limit(1).One() as RecordModel;
    return { record, error: null };
  } catch (error) {
    return { record: null, error: error as Error };
  }
}

function isEmail(value: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
}

function badRequest(event: RequestEvent, message: string, errData: unknown = null): Response {
  return event.json(400, {
    status: 400,
    message: message || "Something went wrong while processing your request.",
    data: safeErrorsData(errData),
  });
}

function forbidden(event: RequestEvent, message: string): Response {
  return event.json(403, {
    status: 403,
    message,
    data: {},
  });
}

function internalServerError(event: RequestEvent, message: string, err: unknown = null): Response {
  const data = err && err instanceof Error ? { message: err.message } : {};
  return event.json(500, {
    status: 500,
    message: message || "Something went wrong while processing your request.",
    data,
  });
}

function safeErrorsData(err: unknown): Record<string, unknown> {
  if (!err) {
    return {};
  }

  if (err instanceof ValidationErrors) {
    const data: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(err.errors)) {
      data[key] = resolveSafeErrorItem(value as Error);
    }
    return data;
  }

  if (err instanceof ValidationError) {
    return resolveSafeErrorItem(err);
  }

  if (err instanceof Error) {
    return { message: err.message };
  }

  return typeof err === "object" ? (err as Record<string, unknown>) : {};
}

function resolveSafeErrorItem(err: Error): Record<string, unknown> {
  const data: Record<string, unknown> = {
    code: "validation_invalid_value",
    message: "Invalid value.",
  };

  if (err instanceof ValidationError) {
    data.code = err.code;
    data.message = err.message;
    if (err.params && Object.keys(err.params).length > 0) {
      data.params = err.params;
    }
    return data;
  }

  data.message = err.message;
  return data;
}
