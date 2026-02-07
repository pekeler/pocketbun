// Ported from pocketbase/core/validators/file_test.go

import { describe, expect, it } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NewFileFromBytes, NewFileFromPath, PathReader } from "../../tools/filesystem/file.ts";
import { UploadedFileMimeType, UploadedFileMimeTypeAsync, UploadedFileSize } from "./file.ts";

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

  it("UploadedFileMimeTypeAsync", async () => {
    const file = NewFileFromBytes(new TextEncoder().encode("test"), "test.png");

    const scenarios = [
      { types: [], file, expectError: true },
      { types: ["image/jpeg"], file, expectError: true },
      { types: ["image/jpeg", "text/plain; charset=utf-8"], file, expectError: false },
    ];

    for (const scenario of scenarios) {
      const err = await UploadedFileMimeTypeAsync(scenario.types)(scenario.file);
      expect(Boolean(err)).toBe(scenario.expectError);
    }
  });

  it("UploadedFileMimeTypeAsync prefers async disk reads for path-backed readers", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "pb-validator-file-"));
    try {
      const path = join(tempDir, "sample.txt");
      await writeFile(path, "test");

      const file = NewFileFromPath(path);
      const reader = file.Reader;
      if (!(reader instanceof PathReader)) {
        throw new Error("expected path reader");
      }

      (reader as unknown as { Open: () => never }).Open = () => {
        throw new Error("sync open should not be used for path readers");
      };

      const err = await UploadedFileMimeTypeAsync(["text/plain; charset=utf-8"])(file);
      expect(err).toBeNull();
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
