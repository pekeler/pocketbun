// Ported from pocketbase/tools/archive/create_test.go

import { describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { Create, CreateAsync } from "./create.ts";

describe("archive create", () => {
  it("create failure", () => {
    const testDir = createTestDir();
    try {
      const zipPath = join(tmpdir(), "pb_test.zip");
      const missingDir = join(tmpdir(), "missing");

      expect(() => Create(missingDir, zipPath)).toThrow();
      expect(existsSync(zipPath)).toBe(false);
    } finally {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it("create success", () => {
    const testDir = createTestDir();
    try {
      const zipName = "pb_test.zip";
      const zipPath = join(tmpdir(), zipName);

      Create(testDir, zipPath, "a/b/c", "test");

      const stat = statSync(zipPath);
      expect(basename(zipPath)).toBe(zipName);
      expect(stat.size).toBe(544);
    } finally {
      rmSync(testDir, { recursive: true, force: true });
      rmSync(join(tmpdir(), "pb_test.zip"), { recursive: true, force: true });
    }
  });

  it("create async success", async () => {
    const testDir = createTestDir();
    try {
      const zipName = "pb_test_async.zip";
      const zipPath = join(tmpdir(), zipName);

      await CreateAsync(testDir, zipPath, "a/b/c", "test");

      const stat = statSync(zipPath);
      expect(basename(zipPath)).toBe(zipName);
      expect(stat.size).toBe(544);
    } finally {
      rmSync(testDir, { recursive: true, force: true });
      rmSync(join(tmpdir(), "pb_test_async.zip"), { recursive: true, force: true });
    }
  });
});

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
