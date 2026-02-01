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

export async function readJsonBody(
  event: RequestEvent,
): Promise<{ data: Record<string, unknown> | null; error: Error | null }> {
  if (!event.request.body) {
    return { data: null, error: null };
  }

  let raw = "";
  try {
    raw = await event.request.clone().text();
  } catch (error) {
    return { data: null, error: error as Error };
  }

  if (raw.trim() === "") {
    return { data: null, error: null };
  }

  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return { data: parsed as Record<string, unknown>, error: null };
    }
  } catch (error) {
    return { data: null, error: error as Error };
  }

  return { data: null, error: null };
}
