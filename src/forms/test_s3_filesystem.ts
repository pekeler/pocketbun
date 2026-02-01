// Ported from pocketbase/forms/test_s3_filesystem.go

import type { App } from "../core/app.ts";
import type { S3Config } from "../core/settings.ts";
import { ValidationErrors, newError, required } from "../internal/compat/validation.ts";
import { NewS3 } from "../tools/filesystem/filesystem.ts";
import { pseudorandomString } from "../tools/security/random.ts";

const s3FilesystemStorage = "storage";
const s3FilesystemBackups = "backups";

// TestS3Filesystem defines a S3 filesystem connection test.
export class TestS3Filesystem {
  app: App;
  Filesystem = "";

  constructor(app: App) {
    this.app = app;
  }

  // Validate makes the form validatable by implementing [validation.Validatable] interface.
  Validate(): Error | null {
    const errors: Record<string, Error> = {};

    const requiredErr = required(this.Filesystem);
    if (requiredErr) {
      errors.filesystem = requiredErr;
    } else if (![s3FilesystemStorage, s3FilesystemBackups].includes(this.Filesystem)) {
      errors.filesystem = newError("validation_in_invalid", "Invalid value.");
    }

    return Object.keys(errors).length > 0 ? new ValidationErrors(errors) : null;
  }

  // Submit validates and performs a S3 filesystem connection test.
  Submit(): Error | null {
    const err = this.Validate();
    if (err) {
      return err;
    }

    let s3Config: S3Config;
    if (this.Filesystem === s3FilesystemBackups) {
      s3Config = this.app.settings().backups.s3;
    } else {
      s3Config = this.app.settings().s3;
    }

    if (!s3Config.enabled) {
      return new Error("S3 storage filesystem is not enabled");
    }

    let fsys: ReturnType<typeof NewS3>;
    try {
      fsys = NewS3(
        s3Config.bucket,
        s3Config.region,
        s3Config.endpoint,
        s3Config.accessKey,
        s3Config.secret,
        s3Config.forcePathStyle,
      );
    } catch (error) {
      return new Error(`failed to initialize the S3 filesystem: ${(error as Error).message}`);
    }

    try {
      const testPrefix = `pb_settings_test_${pseudorandomString(5)}`;
      const testFileKey = `${testPrefix}/test.txt`;

      try {
        fsys.Upload(new TextEncoder().encode("test"), testFileKey);
      } catch (error) {
        return new Error(`failed to upload a test file: ${(error as Error).message}`);
      }

      const deleteErrors = fsys.DeletePrefix(testPrefix);
      if (deleteErrors.length > 0) {
        const first = deleteErrors[0];
        return new Error(`failed to delete a test file: ${first?.message ?? String(first)}`);
      }
    } finally {
      fsys.Close();
    }

    return null;
  }
}

// NewTestS3Filesystem creates and initializes new TestS3Filesystem form.
export function NewTestS3Filesystem(app: App): TestS3Filesystem {
  return new TestS3Filesystem(app);
}
