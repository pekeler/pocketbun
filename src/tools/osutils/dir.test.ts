// Ported from pocketbase/tools/osutils/dir_test.go

import { describe, expect, it } from "bun:test";
import { mkdtemp, rm, mkdir, writeFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { existInSlice } from "../list/list.ts";
import { pseudorandomString } from "../security/random.ts";
import { MoveDirContent, MoveDirContentAsync } from "./dir.ts";

async function collectFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(fullPath)));
      continue;
    }

    files.push(fullPath);
  }

  return files;
}

// note: make sure to call rm(dir) after you are done working with the created test dir.
async function createTestDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "test_dir"));

  await mkdir(join(dir, "a"), { recursive: true });
  await mkdir(join(dir, "b"), { recursive: true });

  await writeFile(join(dir, "test1"), "");
  await writeFile(join(dir, "test2"), "");
  await writeFile(join(dir, "a", "a1"), "");
  await writeFile(join(dir, "a", "a2"), "");
  await writeFile(join(dir, "b", "b2"), "");
  await writeFile(join(dir, "b", "b2"), "");

  return dir;
}

describe("MoveDirContent", () => {
  it("moves directory contents while honoring excludes", async () => {
    const testDir = await createTestDir();
    let dir1 = "";
    let dir2 = "";
    try {
      const exclude = ["missing", "test2", "b"];

      dir1 = resolve(testDir, "..", "a", "b", "c", "d", `_pb_move_dir_content_test_${pseudorandomString(4)}`);

      expect(() => MoveDirContent(testDir, dir1, ...exclude)).toThrow();

      dir2 = resolve(testDir, "..", `_pb_move_dir_content_test_${pseudorandomString(4)}`);

      expect(() => MoveDirContent(testDir, dir2, ...exclude)).not.toThrow();

      const files = await collectFiles(dir2);

      const expectedFiles = [join(dir2, "test1"), join(dir2, "a", "a1"), join(dir2, "a", "a2")];

      expect(files.length).toBe(expectedFiles.length);

      for (const expected of expectedFiles) {
        expect(existInSlice(expected, files)).toBe(true);
      }
    } finally {
      await rm(testDir, { recursive: true, force: true });
      if (dir1) {
        await rm(dir1, { recursive: true, force: true });
      }
      if (dir2) {
        await rm(dir2, { recursive: true, force: true });
      }
    }
  });

  it("MoveDirContentAsync moves directory contents while honoring excludes", async () => {
    const testDir = await createTestDir();
    let dir1 = "";
    let dir2 = "";
    try {
      const exclude = ["missing", "test2", "b"];

      dir1 = resolve(testDir, "..", "a", "b", "c", "d", `_pb_move_dir_content_test_${pseudorandomString(4)}`);

      let failed = false;
      try {
        await MoveDirContentAsync(testDir, dir1, ...exclude);
      } catch {
        failed = true;
      }
      expect(failed).toBe(true);

      dir2 = resolve(testDir, "..", `_pb_move_dir_content_test_${pseudorandomString(4)}`);

      let unexpectedError: Error | null = null;
      try {
        await MoveDirContentAsync(testDir, dir2, ...exclude);
      } catch (error) {
        unexpectedError = error as Error;
      }
      expect(unexpectedError).toBeNull();

      const files = await collectFiles(dir2);

      const expectedFiles = [join(dir2, "test1"), join(dir2, "a", "a1"), join(dir2, "a", "a2")];

      expect(files.length).toBe(expectedFiles.length);

      for (const expected of expectedFiles) {
        expect(existInSlice(expected, files)).toBe(true);
      }
    } finally {
      await rm(testDir, { recursive: true, force: true });
      if (dir1) {
        await rm(dir1, { recursive: true, force: true });
      }
      if (dir2) {
        await rm(dir2, { recursive: true, force: true });
      }
    }
  });
});
