// Ported from pocketbase/core/validators/db.go

import type { Database } from "bun:sqlite";
import { ValidationErrors, newError } from "../../internal/compat/validation.ts";

// UniqueId checks whether a field string id already exists in the specified table.
//
// Example:
//
//	validation.Field(&form.RelId, validation.By(validators.UniqueId(form.app.DB(), "tbl_example"))
export function UniqueId(db: Database, tableName: string): (value: unknown) => Error | null {
  return (value: unknown) => {
    const v = typeof value === "string" ? value : "";
    if (!v) {
      return null;
    }

    try {
      const row = db.query(`select id from {{${tableName}}} where id = ? limit 1`).get(v) as { id?: string } | undefined;
      if (row?.id) {
        return newError("validation_invalid_or_existing_id", "The model id is invalid or already exists.");
      }
    } catch {
      return newError("validation_invalid_or_existing_id", "The model id is invalid or already exists.");
    }

    return null;
  };
}

// NormalizeUniqueIndexError attempts to convert a
// "unique constraint failed" error into a validation.Errors.
//
// The provided err is returned as it is without changes if:
// - err is nil
// - err is already validation.Errors
// - err is not "unique constraint failed" error
export function NormalizeUniqueIndexError(err: Error | null, tableOrAlias: string, fieldNames: string[]): Error | null {
  if (!err) {
    return err;
  }

  if (err instanceof ValidationErrors) {
    return err;
  }

  const msg = err.message.toLowerCase();
  if (!msg.includes("unique constraint failed")) {
    return err;
  }

  const normalized = `${msg.trim().replaceAll(",", " ")} `;
  const normalizedErrs: Record<string, Error> = {};

  for (const name of fieldNames) {
    const needle = ` ${tableOrAlias.toLowerCase()}.${name.toLowerCase()} `;
    if (normalized.includes(needle)) {
      normalizedErrs[name] = newError("validation_not_unique", "Value must be unique");
    }
  }

  if (Object.keys(normalizedErrs).length > 0) {
    return new ValidationErrors(normalizedErrs);
  }

  return err;
}
