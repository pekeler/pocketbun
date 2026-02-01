// Ported from pocketbase/core/db.go (partial: id constants + validation helpers used so far).

import type { App } from "./app.ts";
import { newError } from "../internal/compat/validation.ts";
import { pseudorandomStringWithAlphabet } from "../tools/security/random.ts";

export const DefaultIdLength = 15;
export const DefaultIdAlphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
export const DefaultIdRegex = /^\w+$/;

export function GenerateDefaultRandomId(): string {
  return pseudorandomStringWithAlphabet(DefaultIdLength, DefaultIdAlphabet);
}

export type PreValidator = {
  PreValidate: (ctx: unknown, app: App) => Error | null;
};

export type PostValidator = {
  PostValidate: (ctx: unknown, app: App) => Error | null;
};

export function validateCollectionId(app: App, ...optTypes: string[]): (value: unknown) => Error | null {
  return (value: unknown): Error | null => {
    const id = typeof value === "string" ? value : "";
    if (!id) {
      return null;
    }

    const collection = app.findCollectionById(id);
    if (!collection) {
      return newError("validation_invalid_collection_id", "Missing or invalid collection.");
    }

    if (optTypes.length > 0 && !optTypes.includes(collection.type)) {
      return newError("validation_invalid_collection_type", `Invalid collection type - must be ${optTypes.join(", ")}.`);
    }

    return null;
  };
}

export function validateRecordId(app: App, collectionNameOrId: string): (value: unknown) => Error | null {
  return (value: unknown): Error | null => {
    const id = typeof value === "string" ? value : "";
    if (!id) {
      return null;
    }

    const collection = app.findCollectionByNameOrId(collectionNameOrId);
    if (!collection) {
      return newError("validation_invalid_collection", "Missing or invalid collection.");
    }

    const row = app.db().query(`select (1) as ok from {{${collection.name}}} where [[id]] = ? limit 1`).get(id) as
      | { ok?: number }
      | undefined;

    if (!row || row.ok !== 1) {
      return newError("validation_invalid_record", "Missing or invalid record.");
    }

    return null;
  };
}
