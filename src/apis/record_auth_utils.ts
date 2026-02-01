// PocketBun-only: shared helpers for record auth endpoints to avoid circular imports.

import type { App } from "../core/app.ts";
import type { Collection } from "../core/collection.ts";
import type { RequestEvent } from "../core/event_request.ts";

export function findAuthCollection(app: App, event: RequestEvent): Collection | null {
  const collectionId = event.params.collection ?? "";
  if (!collectionId) {
    return null;
  }

  const collection = app.findCollectionByNameOrId(collectionId);
  if (!collection || !collection.isAuth()) {
    return null;
  }

  return collection;
}

export function authCollectionNotFound(event: RequestEvent): Response {
  return event.json(404, {
    status: 404,
    message: "Missing or invalid auth collection context.",
    data: {},
  });
}
