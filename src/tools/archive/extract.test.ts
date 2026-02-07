// Ported from pocketbase/tools/archive/extract_test.go

import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Create } from "./create.ts";
import { Extract, ExtractAsync } from "./extract.ts";

describe("archive extract", () => {
  it("extract failure", () => {
    const testDir = createTestDir();
    const missingZipPath = join(tmpdir(), "pb_missing_test.zip");
    const extractedPath = join(tmpdir(), "pb_zip_extract");

    try {
      expect(() => Extract(missingZipPath, extractedPath)).toThrow();
      expect(() => statSync(extractedPath)).toThrow();
    } finally {
      rmSync(testDir, { recursive: true, force: true });
      rmSync(extractedPath, { recursive: true, force: true });
    }
  });

  it("extract success", () => {
    const testDir = createTestDir();
    const zipPath = join(tmpdir(), "pb_test.zip");
    const extractedPath = join(tmpdir(), "pb_zip_extract");

    try {
      Create(testDir, zipPath, "a/b/c", "test2", "sub2");
      Extract(zipPath, extractedPath);

      const availableFiles = listFiles(extractedPath);
      const expectedFiles = [join(extractedPath, "test"), join(extractedPath, "a/test"), join(extractedPath, "a/b/sub1")];

      expect(availableFiles.length).toBe(expectedFiles.length);

      for (const expected of expectedFiles) {
        expect(availableFiles.includes(expected)).toBe(true);
      }
    } finally {
      rmSync(testDir, { recursive: true, force: true });
      rmSync(zipPath, { recursive: true, force: true });
      rmSync(extractedPath, { recursive: true, force: true });
    }
  });

  it("extract async success", async () => {
    const testDir = createTestDir();
    const zipPath = join(tmpdir(), "pb_test_async.zip");
    const extractedPath = join(tmpdir(), "pb_zip_extract_async");

    try {
      Create(testDir, zipPath, "a/b/c", "test2", "sub2");
      await ExtractAsync(zipPath, extractedPath);

      const availableFiles = listFiles(extractedPath);
      const expectedFiles = [join(extractedPath, "test"), join(extractedPath, "a/test"), join(extractedPath, "a/b/sub1")];

      expect(availableFiles.length).toBe(expectedFiles.length);

      for (const expected of expectedFiles) {
        expect(availableFiles.includes(expected)).toBe(true);
      }
    } finally {
      rmSync(testDir, { recursive: true, force: true });
      rmSync(zipPath, { recursive: true, force: true });
      rmSync(extractedPath, { recursive: true, force: true });
    }
  });
});

function listFiles(root: string): string[] {
  const entries = readdirSync(root, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(fullPath));
      continue;
    }
    files.push(fullPath);
  }

  return files;
}

function createTestDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "pb_zip_test"));

  mkdirSync(join(dir, "a/b/c"), { recursive: true });
  writeFileSync(join(dir, "test"), "");
  writeFileSync(join(dir, "test2"), "");
  writeFileSync(join(dir, "a/test"), "");
  writeFileSync(join(dir, "a/b/sub1"), "");
  writeFileSync(join(dir, "a/b/c/sub2"), "");
  writeFileSync(join(dir, "a/b/c/sub3"), "");

  symlinkSync(join(dir, "test"), join(dir, "test_symlink"));

  return dir;
}
