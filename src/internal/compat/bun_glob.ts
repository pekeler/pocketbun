// PocketBun-only: small Bun.Glob wrappers shared by runtime code that emulates
// Go filepath-style helpers while keeping platform path separators stable.

import { isAbsolute, sep } from "node:path";

type GlobScanOptions = {
  cwd?: string;
  absolute?: boolean;
  onlyFiles?: boolean;
};

function normalizeForBunGlob(path: string): string {
  return sep === "\\" ? path.split("\\").join("/") : path;
}

function denormalizeFromBunGlob(path: string): string {
  return sep === "\\" ? path.split("/").join("\\") : path;
}

function buildScanOptions(pattern: string, options: GlobScanOptions): GlobScanOptions {
  const scanOptions: GlobScanOptions = {
    absolute: options.absolute ?? isAbsolute(pattern),
  };

  if (options.cwd) {
    scanOptions.cwd = normalizeForBunGlob(options.cwd);
  }

  if (options.onlyFiles !== undefined) {
    scanOptions.onlyFiles = options.onlyFiles;
  }

  return scanOptions;
}

export function scanGlobSync(pattern: string, options: GlobScanOptions = {}): string[] {
  try {
    const glob = new Bun.Glob(normalizeForBunGlob(pattern));
    return Array.from(glob.scanSync(buildScanOptions(pattern, options))).map(denormalizeFromBunGlob);
  } catch {
    return [];
  }
}

export async function scanGlob(pattern: string, options: GlobScanOptions = {}): Promise<string[]> {
  try {
    const glob = new Bun.Glob(normalizeForBunGlob(pattern));
    const matches: string[] = [];
    for await (const match of glob.scan(buildScanOptions(pattern, options))) {
      matches.push(denormalizeFromBunGlob(match));
    }
    return matches;
  } catch {
    return [];
  }
}

export function globMatch(pattern: string, name: string): boolean {
  try {
    return new Bun.Glob(normalizeForBunGlob(pattern)).match(normalizeForBunGlob(name));
  } catch {
    return false;
  }
}
