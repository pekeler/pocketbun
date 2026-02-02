// Ported from pocketbase/apis/backup_upload.go

import type { App } from "../core/app.ts";
import type { RequestEvent } from "../core/event_request.ts";
import type { File } from "../tools/filesystem/file.ts";
import { UploadedFileMimeType } from "../core/validators/file.ts";
import { ValidationErrors, newError, required } from "../internal/compat/validation.ts";
import { NewFileFromBytes } from "../tools/filesystem/file.ts";
import { badRequest, noContent } from "./api_errors.ts";

export async function backupUpload(app: App, event: RequestEvent): Promise<Response> {
  let fsys;
  try {
    fsys = app.NewBackupsFilesystem();
  } catch (error) {
    return badRequest(event, "Failed to load backups filesystem.", error as Error);
  }

  try {
    const form = new BackupUploadForm(fsys);
    const contentType = event.request.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      // eslint-disable-next-line typescript-eslint/no-deprecated -- Bun's Request.formData keeps backup uploads aligned with upstream.
      const formData = await event.request.formData();
      const file = formData.get("file");
      if (file && typeof file !== "string") {
        const fileLike = file as { arrayBuffer?: () => Promise<ArrayBuffer>; name?: string };
        if (typeof fileLike.arrayBuffer === "function") {
          const buffer = new Uint8Array(await fileLike.arrayBuffer());
          const name = fileLike.name ?? "file";
          form.File = NewFileFromBytes(buffer, name);
        }
      }
    }

    const err = form.validate();
    if (err) {
      return badRequest(event, "An error occurred while validating the submitted data.", err);
    }

    try {
      fsys.UploadFile(form.File!, form.File!.OriginalName);
    } catch (error) {
      return badRequest(event, "Failed to upload backup.", error as Error);
    }

    // we don't retrieve the generated backup file because it may not be
    // available yet due to the eventually consistent nature of some S3 providers
    return noContent(event, 204);
  } finally {
    fsys.Close();
  }
}

// -------------------------------------------------------------------

class BackupUploadForm {
  fsys: { Exists: (key: string) => boolean; Close: () => void };
  File: File | null = null;

  constructor(fsys: { Exists: (key: string) => boolean; Close: () => void }) {
    this.fsys = fsys;
  }

  validate(): Error | null {
    const errors: Record<string, Error> = {};

    const requiredErr = required(this.File);
    if (requiredErr) {
      errors.file = requiredErr;
    } else {
      const mimeErr = UploadedFileMimeType(["application/zip"])(this.File);
      if (mimeErr) {
        errors.file = mimeErr;
      } else {
        const uniqueErr = this.checkUniqueName(this.File!);
        if (uniqueErr) {
          errors.file = uniqueErr;
        }
      }
    }

    return Object.keys(errors).length > 0 ? new ValidationErrors(errors) : null;
  }

  private checkUniqueName(file: File): Error | null {
    if (!file) {
      return null; // nothing to check
    }

    // note: we use the original name because that is what we upload
    if (this.fsys.Exists(file.OriginalName)) {
      return newError("validation_backup_name_exists", "Backup file with the specified name already exists.");
    }

    return null;
  }
}
