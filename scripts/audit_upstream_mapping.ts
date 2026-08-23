// PocketBun-only: audit helper to compare upstream .go files to local TS ports.

import { existsSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

const upstreamRoot = join(process.cwd(), ".upstream", "pocketbase");
const srcRoot = join(process.cwd(), "src");

const ignoredDirs = new Set([".git", "ui", "examples"]);
const ignoredFiles = new Set([
  "plugins/ghupdate/ghupdate.go",
  "plugins/ghupdate/ghupdate_test.go",
  "plugins/ghupdate/release.go",
  "plugins/ghupdate/release_test.go",
]);
const mergedPorts = new Map([
  ["core/backup.go", "src/core/base_backup.ts"],
  ["core/backup_create.go", "src/core/base_backup.ts"],
  ["core/backup_restore.go", "src/core/base_backup.ts"],
  ["core/backup_test.go", "src/core/base_backup.test.ts"],
]);

type Missing = {
  upstream: string;
  expected: string;
};

const missingSources: Missing[] = [];
const missingTests: Missing[] = [];

function shouldIgnoreDir(name: string): boolean {
  return ignoredDirs.has(name);
}

function walk(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (shouldIgnoreDir(entry.name)) {
        continue;
      }
      files.push(...walk(join(dir, entry.name)));
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    if (entry.name.endsWith(".go")) {
      files.push(join(dir, entry.name));
    }
  }

  return files;
}

function mapToTsPath(relPath: string): { expected: string; isTest: boolean } {
  const isTest = relPath.endsWith("_test.go");
  const tsPath = relPath.replace(/_test\.go$/, ".test.ts").replace(/\.go$/, ".ts");
  return { expected: join(srcRoot, tsPath), isTest };
}

function main(): void {
  if (!existsSync(upstreamRoot)) {
    throw new Error(`Missing upstream checkout at ${upstreamRoot}. Run bun run upstream:sync first.`);
  }

  const goFiles = walk(upstreamRoot);
  for (const filePath of goFiles) {
    const relPath = relative(upstreamRoot, filePath);
    if (ignoredFiles.has(relPath)) {
      continue;
    }
    const mergedPort = mergedPorts.get(relPath);
    if (mergedPort && existsSync(join(process.cwd(), mergedPort))) {
      continue;
    }
    const { expected, isTest } = mapToTsPath(relPath);
    if (!existsSync(expected)) {
      const entry = { upstream: relPath, expected: relative(process.cwd(), expected) };
      if (isTest) {
        missingTests.push(entry);
      } else {
        missingSources.push(entry);
      }
    }
  }

  const formatList = (items: Missing[]) => items.map((item) => `- ${item.upstream} -> ${item.expected}`).join("\n");

  console.log(`Missing source files: ${missingSources.length}`);
  if (missingSources.length > 0) {
    console.log(formatList(missingSources));
  }

  console.log(`Missing test files: ${missingTests.length}`);
  if (missingTests.length > 0) {
    console.log(formatList(missingTests));
  }
}

main();
