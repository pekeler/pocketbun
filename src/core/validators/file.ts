// Ported from pocketbase/core/validators/file.go

import { newError } from "../../internal/compat/validation.ts";
import { ErrUnsupportedValueType } from "./validators.ts";
import { File } from "../../tools/filesystem/file.ts";
import { detectMimeTypeFromBytes } from "../../tools/filesystem/file.ts";

export function UploadedFileSize(maxBytes: number) {
  return (value: unknown): Error | null => {
    if (value == null) {
      return null;
    }

    if (!(value instanceof File)) {
      return ErrUnsupportedValueType;
    }

    const file = value as File;
    if (file.Size > maxBytes) {
      return newError(
        "validation_file_size_limit",
        "Failed to upload {{.file}} - the maximum allowed file size is {{.maxSize}} bytes.",
      ).setParams({ file: file.OriginalName, maxSize: maxBytes });
    }

    return null;
  };
}

export function UploadedFileMimeType(validTypes: string[]) {
  return (value: unknown): Error | null => {
    if (value == null) {
      return null;
    }

    if (!(value instanceof File)) {
      return ErrUnsupportedValueType;
    }

    const file = value as File;
    const baseErr = newError(
      "validation_invalid_mime_type",
      `Failed to upload ${JSON.stringify(file.OriginalName)} due to unsupported file type.`,
    );

    if (validTypes.length === 0) {
      return baseErr;
    }

    if (!file.Reader) {
      return baseErr;
    }

    try {
      const reader = file.Reader.Open();
      const bytes = reader.readAll();
      reader.close();

      const mime = detectMimeTypeFromBytes(bytes);
      for (const allowed of validTypes) {
        if (mimeMatches(mime, allowed)) {
          return null;
        }
      }
    } catch {
      return baseErr;
    }

    return newError(
      "validation_invalid_mime_type",
      `${JSON.stringify(file.Name)} mime type must be one of: ${validTypes.join(", ")}.`,
    );
  };
}

function mimeMatches(actual: string, expected: string): boolean {
  if (actual === expected) {
    return true;
  }
  const actualBase = actual.split(";")[0]?.trim() ?? actual;
  const expectedBase = expected.split(";")[0]?.trim() ?? expected;
  return actualBase === expectedBase;
}
