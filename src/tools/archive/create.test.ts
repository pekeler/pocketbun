// Ported from pocketbase/tools/archive/create_test.go

import { describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { Create, CreateAsync, CreateAsyncWithFileOverrides } from "./create.ts";
import { ExtractAsync } from "./extract.ts";

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

  it("create async with frozen file overrides", async () => {
    const testDir = createTestDir();
    const outputDir = mkdtempSync(join(tmpdir(), "pb_zip_override"));
    const zipPath = join(tmpdir(), "pb_test_override.zip");
    try {
      writeFileSync(join(testDir, "data.db"), "live");
      writeFileSync(join(testDir, "data.db-wal"), "live wal");
      await CreateAsyncWithFileOverrides(
        testDir,
        zipPath,
        new Map([["data.db", new TextEncoder().encode("snapshot")]]),
        "data.db-wal",
      );
      await ExtractAsync(zipPath, outputDir);

      expect(readFileSync(join(outputDir, "data.db"), "utf8")).toBe("snapshot");
      expect(existsSync(join(outputDir, "data.db-wal"))).toBeFalse();
      expect(existsSync(join(outputDir, "test2"))).toBeTrue();
    } finally {
      rmSync(testDir, { recursive: true, force: true });
      rmSync(outputDir, { recursive: true, force: true });
      rmSync(zipPath, { force: true });
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
