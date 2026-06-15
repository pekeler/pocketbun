// PocketBun-only: Bun-native bundling support for deployable pb_hooks artifacts.
//
// Hook loading itself is ported from PocketBase's JSVM plugin, but PocketBun
// can use Bun's bundler so copied deploy artifacts don't need the original
// workspace package tree beside loose hook files.

import type { Dirent } from "node:fs";
import { readdir, rm } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";

export const defaultHooksFilesPattern = String.raw`^.*(\.pb\.js|\.pb\.ts)$`;
export const bundledHooksDirName = ".pb_hooks_bundled";

export type BundleServerHooksOptions = {
  hooksDir: string;
  outDir: string;
  hooksFilesPattern?: string;
};

export type BundledServerHookFile = {
  entryPath: string;
  fileName: string;
};

export type BundleServerHooksResult = {
  hooksDir: string;
  outDir: string;
  files: BundledServerHookFile[];
  logs: string[];
};

export async function bundleServerHooksAsync(options: BundleServerHooksOptions): Promise<BundleServerHooksResult> {
  const hooksDir = resolve(options.hooksDir);
  const outDir = resolve(options.outDir);
  if (hooksDir === outDir) {
    throw new Error("hooks bundle output directory must be different from hooksDir");
  }

  const entries = await hookEntryFiles(hooksDir, options.hooksFilesPattern ?? defaultHooksFilesPattern);
  const files = entries.map((entryPath) => {
    const fileName = bundledHookFileName(entryPath);
    return {
      entryPath,
      fileName,
    };
  });
  assertUniqueOutputNames(files);

  await cleanPreviousBundledHookFiles(outDir);
  if (files.length === 0) {
    return { hooksDir, outDir, files, logs: [] };
  }

  let result: Bun.BuildOutput;
  try {
    result = await Bun.build({
      entrypoints: files.map((file) => file.entryPath),
      outdir: outDir,
      root: hooksDir,
      target: "bun",
      format: "esm",
      splitting: false,
      packages: "bundle",
      allowUnresolved: [],
      sourcemap: "none",
      env: "disable",
      naming: {
        entry: "[dir]/[name].js",
        chunk: "chunks/[name]-[hash].js",
        asset: "assets/[name]-[hash].[ext]",
      },
    });
  } catch (err) {
    throw new Error(formatBuildFailure(formatBuildErrorLogs(err)));
  }

  const logs = result.logs.map(formatBuildLog);
  if (!result.success) {
    throw new Error(formatBuildFailure(logs));
  }

  return { hooksDir, outDir, files, logs };
}

async function hookEntryFiles(hooksDir: string, pattern: string): Promise<string[]> {
  let entries: Dirent[];
  try {
    entries = await readdir(hooksDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const regex = pattern ? new RegExp(pattern) : null;
  return entries
    .sort((a, b) => a.name.localeCompare(b.name))
    .filter((entry) => !entry.isDirectory() && (!regex || regex.test(entry.name)))
    .map((entry) => join(hooksDir, entry.name));
}

function bundledHookFileName(entryPath: string): string {
  const name = basename(entryPath);
  const ext = extname(name);
  return ext ? `${name.slice(0, -ext.length)}.js` : `${name}.js`;
}

function assertUniqueOutputNames(files: BundledServerHookFile[]): void {
  const seen = new Map<string, string>();
  for (const file of files) {
    const previous = seen.get(file.fileName);
    if (previous) {
      throw new Error(
        `multiple hook entries bundle to ${file.fileName}: ${basename(previous)} and ${basename(file.entryPath)}`,
      );
    }
    seen.set(file.fileName, file.entryPath);
  }
}

async function cleanPreviousBundledHookFiles(outDir: string): Promise<void> {
  let entries: Dirent[];
  try {
    entries = await readdir(outDir, { withFileTypes: true });
  } catch {
    return;
  }

  await Promise.all(
    entries
      .filter((entry) => !entry.isDirectory() && entry.name.endsWith(".pb.js"))
      .map((entry) => rm(join(outDir, entry.name), { force: true })),
  );
}

function formatBuildLog(log: unknown): string {
  if (typeof log === "object" && log !== null && "message" in log) {
    const message = (log as { message?: unknown }).message;
    if (typeof message === "string") {
      return message;
    }
  }
  return String(log);
}

function formatBuildErrorLogs(err: unknown): string[] {
  if (typeof err === "object" && err !== null && "errors" in err) {
    const errors = (err as { errors?: unknown }).errors;
    if (Array.isArray(errors) && errors.length > 0) {
      return errors.map(formatBuildLog);
    }
  }
  return [String(err)];
}

function formatBuildFailure(logs: string[]): string {
  if (logs.length === 0) {
    return "failed to bundle server hooks";
  }
  return `failed to bundle server hooks:\n${logs.map((log) => `- ${log}`).join("\n")}`;
}
