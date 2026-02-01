// Ported from pocketbase/apis/record_auth_impersonate.go

import type { App } from "../core/app.ts";
import type { RequestEvent } from "../core/event_request.ts";
import { ValidationErrors, newError } from "../internal/compat/validation.ts";
import { badRequest, forbidden, internalServerError, unauthorized } from "./api_errors.ts";
import { authCollectionNotFound, findAuthCollection, readJsonBody } from "./record_auth_utils.ts";
import { RecordAuthResponseWithToken } from "./record_helpers.ts";

type ImpersonateForm = {
  duration: number;
};

export async function recordAuthImpersonate(app: App, event: RequestEvent): Promise<Response> {
  if (!event.auth) {
    return unauthorized(event, "The request requires valid record authorization token.");
  }

  if (!event.auth.isSuperuser()) {
    return forbidden(event, "The authorized record is not allowed to perform this action.");
  }

  const collection = findAuthCollection(app, event);
  if (!collection) {
    return authCollectionNotFound(event);
  }

  const recordId = event.params.id ?? "";
  if (!recordId) {
    return notFound(event);
  }

  let record = null;
  try {
    record = app.FindRecordById(collection, recordId);
  } catch (error) {
    return notFound(event, error);
  }

  const formResult = await parseImpersonateForm(event);
  if (formResult.error) {
    return badRequest(event, "An error occurred while loading the submitted data.", formResult.error);
  }

  const validationErr = validateImpersonateForm(formResult.data);
  if (validationErr) {
    return badRequest(event, "An error occurred while validating the submitted data.", validationErr);
  }

  let token = "";
  try {
    token = record.NewStaticAuthToken(formResult.data.duration);
  } catch (error) {
    return internalServerError(event, "Failed to generate static auth token", error);
  }

  return RecordAuthResponseWithToken(event, record, token, "", null);
}

async function parseImpersonateForm(event: RequestEvent): Promise<{ data: ImpersonateForm; error: Error | null }> {
  const data: ImpersonateForm = {
    duration: 0,
  };

  const result = await readJsonBody(event);
  if (result.error) {
    return { data, error: result.error };
  }

  if (result.data && typeof result.data.duration === "number" && Number.isFinite(result.data.duration)) {
    data.duration = Math.trunc(result.data.duration);
  }

  return { data, error: null };
}

function validateImpersonateForm(form: ImpersonateForm): Error | null {
  if (form.duration >= 0) {
    return null;
  }

  return new ValidationErrors({
    duration: newError("validation_min", "Must be greater than or equal to 0."),
  });
}

function notFound(event: RequestEvent, err: unknown = null): Response {
  return event.json(404, {
    status: 404,
    message: "The requested resource wasn't found.",
    data: err instanceof Error ? { message: err.message } : {},
  });
}
