// Ported from pocketbase/core/validators/file_test.go

import { describe, expect, it } from "bun:test";
import { NewFileFromBytes } from "../../tools/filesystem/file.ts";
import { UploadedFileMimeType, UploadedFileSize } from "./file.ts";

describe("file validators", () => {
  it("UploadedFileSize", () => {
    const file = NewFileFromBytes(new TextEncoder().encode("test"), "test.txt");

    const scenarios = [
      { maxBytes: 3, file, expectError: true },
      { maxBytes: 4, file, expectError: false },
      { maxBytes: 5, file, expectError: false },
    ];

    for (const scenario of scenarios) {
      const err = UploadedFileSize(scenario.maxBytes)(scenario.file);
      expect(Boolean(err)).toBe(scenario.expectError);
    }
  });

  it("UploadedFileMimeType", () => {
    const file = NewFileFromBytes(new TextEncoder().encode("test"), "test.png");

    const scenarios = [
      { types: [], file, expectError: true },
      { types: ["image/jpeg"], file, expectError: true },
      { types: ["image/jpeg", "text/plain; charset=utf-8"], file, expectError: false },
    ];

    for (const scenario of scenarios) {
      const err = UploadedFileMimeType(scenario.types)(scenario.file);
      expect(Boolean(err)).toBe(scenario.expectError);
    }
  });
});
