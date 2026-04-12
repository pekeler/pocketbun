// Ported from pocketbase/core/validators/file_test.go

import { describe, expect, it } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { File, NewFileFromBytes, NewFileFromPath, PathReader, openFuncAsReader } from "../../tools/filesystem/file.ts";
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

  it("UploadedFileMimeTypeAsync only samples reader bytes", async () => {
    const sampledFile = new File();
    sampledFile.Name = "sample_test.txt";
    sampledFile.OriginalName = "sample.txt";
    sampledFile.Size = 1 << 20;
    sampledFile.Reader = openFuncAsReader(() => {
      let offset = 0;
      const source = new TextEncoder().encode("test");
      return {
        read(size?: number): Uint8Array | null {
          if (offset >= source.length) {
            return null;
          }
          const end = size && size > 0 ? Math.min(source.length, offset + size) : source.length;
          const chunk = source.slice(offset, end);
          offset = end;
          return chunk;
        },
        readAll(): Uint8Array {
          throw new Error("readAll should not be used for mime detection");
        },
        seek(position: number): number {
          offset = Math.max(0, Math.min(source.length, position));
          return offset;
        },
        close(): void {},
        [Symbol.dispose](): void {
          this.close();
        },
        size(): number {
          return source.length;
        },
      };
    });

    const asyncErr = await UploadedFileMimeTypeAsync(["text/plain; charset=utf-8"])(sampledFile);
    expect(asyncErr).toBeNull();
  });
});
