// Ported from pocketbase/apis/backup_create.go

import type { App } from "../core/app.ts";
import type { RequestEvent } from "../core/event_request.ts";
import { StoreKeyActiveBackup } from "../core/store.ts";
import { ValidationErrors, newError } from "../internal/compat/validation.ts";
import { badRequest, noContent } from "./api_errors.ts";

// -------------------------------------------------------------------

const backupNameRegex = /^[a-z0-9_-]+\.zip$/;

export async function backupCreate(app: App, event: RequestEvent): Promise<Response> {
  if (app.store().has(StoreKeyActiveBackup)) {
    return badRequest(event, "Try again later - another backup/restore process has already been started", null);
  }

  const form = new BackupCreateForm(app);
  try {
    await event.bindBody(form);
  } catch (error) {
    return badRequest(event, "An error occurred while loading the submitted data.", error as Error);
  }

  const err = await form.validate();
  if (err) {
    return badRequest(event, "An error occurred while validating the submitted data.", err);
  }

  const createErr = await app.CreateBackup(null, form.Name);
  if (createErr) {
    return badRequest(event, "Failed to create backup.", createErr);
  }

  // we don't retrieve the generated backup file because it may not be
  // available yet due to the eventually consistent nature of some S3 providers
  return noContent(event, 204);
}

class BackupCreateForm {
  app: App;
  Name = "";

  constructor(app: App) {
    this.app = app;
  }

  get name(): string {
    return this.Name;
  }

  set name(value: string) {
    this.Name = value;
  }

  async validate(): Promise<Error | null> {
    if (typeof this.Name !== "string") {
      this.Name = "";
    }

    if (!this.Name) {
      return null;
    }

    const errors: Record<string, Error> = {};

    if (this.Name.length < 1 || this.Name.length > 150) {
      errors.name = newError("validation_length_out_of_range", "The length must be between 1 and 150.");
    } else if (!backupNameRegex.test(this.Name)) {
      errors.name = newError("validation_match_invalid", "Must be in a valid format.");
    } else {
      const uniqueErr = await this.checkUniqueName(this.Name);
      if (uniqueErr) {
        errors.name = uniqueErr;
      }
    }

    return Object.keys(errors).length > 0 ? new ValidationErrors(errors) : null;
  }

  private async checkUniqueName(value: string): Promise<Error | null> {
    if (!value) {
      return null;
    }

    let fsys;
    try {
      fsys =
        typeof this.app.NewBackupsFilesystemAsync === "function"
          ? await this.app.NewBackupsFilesystemAsync()
          : this.app.NewBackupsFilesystem();
    } catch (error) {
      return error as Error;
    }

    await using managedFsys = fsys;
    if (await managedFsys.Exists(value)) {
      return newError("validation_backup_name_exists", "The backup file name is invalid or already exists.");
    }

    return null;
  }
}
