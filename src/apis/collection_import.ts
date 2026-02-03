// Ported from pocketbase/apis/collection_import.go

import type { App } from "../core/app.ts";
import type { RequestEvent } from "../core/event_request.ts";
import { CollectionsImportRequestEvent } from "../core/events.ts";
import { ValidationError, ValidationErrors } from "../internal/compat/validation.ts";
import { badRequest, noContent } from "./api_errors.ts";
import { extractValidationErrors, readRequestData, requireSuperuser } from "./collection.ts";

export async function collectionsImport(app: App, event: RequestEvent): Promise<Response> {
  const authResponse = requireSuperuser(event);
  if (authResponse) {
    return authResponse;
  }

  const data = await readRequestData(event);
  const collections = Array.isArray(data.collections) ? data.collections : null;
  if (!collections || collections.length === 0) {
    return badRequest(event, "An error occurred while validating the submitted data.", {
      collections: new ValidationError("validation_required", "Cannot be blank."),
    });
  }

  const deleteMissing = Boolean(data.deleteMissing);
  const hookEvent = new CollectionsImportRequestEvent(event, collections as Array<Record<string, unknown>>, deleteMissing);

  const out = await app.OnCollectionsImportRequest().Trigger(hookEvent, async () => {
    const err = await app.ImportCollections(hookEvent.CollectionsData, hookEvent.DeleteMissing);
    if (err) {
      const validationErr = extractValidationErrors(err);
      if (validationErr) {
        return badRequest(event, "Failed to import collections.", validationErr);
      }

      return badRequest(
        event,
        "Failed to import collections.",
        new ValidationErrors({
          collections: new ValidationError(
            "validation_collections_import_failure",
            `Failed to import the collections configuration. Raw error:\n${err.message}`,
          ),
        }),
      );
    }
    return noContent(event);
  });
  if (out instanceof Response) {
    return out;
  }
  return noContent(event);
}
