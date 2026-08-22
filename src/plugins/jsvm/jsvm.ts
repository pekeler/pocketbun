// Ported from pocketbase/plugins/jsvm/jsvm.go (Bun-native hooks/migrations loader).
// Note: upstream uses a goja VM; PocketBun runs native Bun modules but keeps the jsvm layer
// to preserve the same JS-facing bindings and pb_hooks compatibility.

import type { Dirent } from "node:fs";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { App } from "../../core/app.ts";
import { AppMigrations } from "../../core/migrations_runner.ts";
import { runsClusterSingletons } from "../../internal/cluster/context.ts";
import { NewRegistry } from "../../tools/template/registry.ts";
import {
  appBinds,
  apisBinds,
  baseBinds,
  cronBinds,
  dbxBinds,
  filesystemBinds,
  formsBinds,
  hooksBinds,
  httpClientBinds,
  mailsBinds,
  osBinds,
  filepathBinds,
  routerBinds,
  securityBinds,
} from "./binds.ts";
import { bundleServerHooksAsync, bundledHooksDirName, defaultHooksFilesPattern } from "./bundler.ts";

const typesFileName = "types.d.ts";
const generatedTypesSourcePath = resolveGeneratedTypesSourcePath(dirname(fileURLToPath(import.meta.url)));

export type Config = {
  OnInit?: (globals: Record<string, unknown>) => void;
  onInit?: (globals: Record<string, unknown>) => void;
  HooksWatch?: boolean;
  hooksWatch?: boolean;
  HooksDir?: string;
  hooksDir?: string;
  HooksFilesPattern?: string;
  hooksFilesPattern?: string;
  HooksPoolSize?: number;
  hooksPoolSize?: number;
  BundleHooks?: boolean;
  bundleHooks?: boolean;
  BundledHooksDir?: string;
  bundledHooksDir?: string;
  MigrationsDir?: string;
  migrationsDir?: string;
  MigrationsFilesPattern?: string;
  migrationsFilesPattern?: string;
  TypesDir?: string;
  typesDir?: string;
};

export function MustRegister(app: App, config: Config): void {
  const err = Register(app, config);
  if (err) {
    throw err;
  }
}

// MustRegisterAsync is a PocketBun-only async alternative to MustRegister().
export async function MustRegisterAsync(app: App, config: Config): Promise<void> {
  const err = await RegisterAsync(app, config);
  if (err) {
    throw err;
  }
}

export function Register(app: App, config: Config): Error | null {
  const normalized = normalizeConfig(app, config);
  if (normalized.BundleHooks) {
    return new Error("bundleHooks requires registerServerJSAsync because Bun.build is asynchronous");
  }

  app.OnBootstrap().BindFunc((e) => {
    const err = e.Next();
    if (err) {
      return err;
    }
    if (runsClusterSingletons()) {
      try {
        refreshTypesFile(normalized.TypesDir ?? app.DataDir());
      } catch {
        // ignore types refresh failures
      }
    }
    return null;
  });

  const migrateErr = registerMigrations(app, normalized);
  if (migrateErr) {
    return migrateErr;
  }

  const hooksErr = registerHooks(app, normalized);
  if (hooksErr) {
    return hooksErr;
  }

  return null;
}

// RegisterAsync is a PocketBun-only async alternative to Register().
//
// Deviation note: upstream registration is synchronous; this variant keeps the
// same externally observable behavior while avoiding blocking fs calls on startup.
export async function RegisterAsync(app: App, config: Config): Promise<Error | null> {
  const normalized = normalizeConfig(app, config);
  let hooksConfig: Config;
  try {
    hooksConfig = await bundledHooksConfig(app, normalized);
  } catch (err) {
    return err instanceof Error ? err : new Error(String(err));
  }

  app.OnBootstrap().BindFunc(async (e) => {
    const err = await e.Next();
    if (err) {
      return err as Error;
    }
    if (runsClusterSingletons()) {
      try {
        await refreshTypesFileAsync(normalized.TypesDir ?? app.DataDir());
      } catch {
        // ignore types refresh failures
      }
    }
    return null;
  });

  const migrateErr = await registerMigrationsAsync(app, normalized);
  if (migrateErr) {
    return migrateErr;
  }

  const hooksErr = await registerHooksAsync(app, hooksConfig);
  if (hooksErr) {
    return hooksErr;
  }

  return null;
}

function normalizeConfig(app: App, config: Config): Config {
  const normalized: Config = {
    ...config,
    OnInit: config.OnInit ?? config.onInit,
    HooksWatch: config.HooksWatch ?? config.hooksWatch,
    HooksDir: config.HooksDir ?? config.hooksDir,
    HooksFilesPattern: config.HooksFilesPattern ?? config.hooksFilesPattern,
    HooksPoolSize: config.HooksPoolSize ?? config.hooksPoolSize,
    BundleHooks: config.BundleHooks ?? config.bundleHooks,
    BundledHooksDir: config.BundledHooksDir ?? config.bundledHooksDir,
    MigrationsDir: config.MigrationsDir ?? config.migrationsDir,
    MigrationsFilesPattern: config.MigrationsFilesPattern ?? config.migrationsFilesPattern,
    TypesDir: config.TypesDir ?? config.typesDir,
  };

  if (!normalized.HooksDir) {
    normalized.HooksDir = join(app.DataDir(), "../pb_hooks");
  }
  if (!normalized.MigrationsDir) {
    normalized.MigrationsDir = join(app.DataDir(), "../pb_migrations");
  }
  if (!normalized.HooksFilesPattern) {
    normalized.HooksFilesPattern = defaultHooksFilesPattern;
  }
  if (!normalized.MigrationsFilesPattern) {
    normalized.MigrationsFilesPattern = String.raw`^.*(\.js|\.ts)$`;
  }
  if (!normalized.TypesDir) {
    normalized.TypesDir = app.DataDir();
  }

  return normalized;
}

async function bundledHooksConfig(app: App, config: Config): Promise<Config> {
  if (!config.BundleHooks) {
    return config;
  }

  const result = await bundleServerHooksAsync({
    hooksDir: config.HooksDir ?? "",
    outDir: config.BundledHooksDir ?? join(app.DataDir(), bundledHooksDirName),
    hooksFilesPattern: config.HooksFilesPattern,
  });

  return {
    ...config,
    HooksDir: result.outDir,
    HooksFilesPattern: String.raw`^.*\.pb\.js$`,
  };
}

function toMigrationScriptApp(app: App): App {
  const scope: Record<string, unknown> = {};
  appBinds(scope, app);
  return scope.$app as App;
}

function registerMigrations(app: App, config: Config): Error | null {
  const files = filesContent(config.MigrationsDir ?? "", config.MigrationsFilesPattern ?? "");
  if (!files) {
    return null;
  }

  const absHooksDir = resolve(config.HooksDir ?? "");
  const templateRegistry = NewRegistry();

  for (const [file, filePath] of files.entries()) {
    const globals = createGlobals(app, absHooksDir, config);
    appBinds(globals, app);
    baseBinds(globals);
    dbxBinds(globals);
    securityBinds(globals);
    osBinds(globals);
    filepathBinds(globals);
    httpClientBinds(globals);
    filesystemBinds(globals);
    formsBinds(globals);
    mailsBinds(globals);
    globals.$template = templateRegistry;

    globals.migrate = (up: (txApp: App) => void, down?: (txApp: App) => void) => {
      AppMigrations.register(
        (txApp) => up(toMigrationScriptApp(txApp)),
        down ? (txApp) => down(toMigrationScriptApp(txApp)) : undefined,
        file,
      );
    };

    if (config.OnInit) {
      config.OnInit(globals);
    }

    try {
      executeModule(filePath, globals);
    } catch (err) {
      return new Error(`failed to run migration ${file}: ${String(err)}`);
    }
  }

  return null;
}

async function registerMigrationsAsync(app: App, config: Config): Promise<Error | null> {
  const files = await filesContentAsync(config.MigrationsDir ?? "", config.MigrationsFilesPattern ?? "");
  if (!files) {
    return null;
  }

  const absHooksDir = resolve(config.HooksDir ?? "");
  const templateRegistry = NewRegistry();

  for (const [file, filePath] of files.entries()) {
    const globals = createGlobals(app, absHooksDir, config);
    appBinds(globals, app);
    baseBinds(globals);
    dbxBinds(globals);
    securityBinds(globals);
    osBinds(globals);
    filepathBinds(globals);
    httpClientBinds(globals);
    filesystemBinds(globals);
    formsBinds(globals);
    mailsBinds(globals);
    globals.$template = templateRegistry;

    globals.migrate = (up: (txApp: App) => void, down?: (txApp: App) => void) => {
      AppMigrations.register(
        (txApp) => up(toMigrationScriptApp(txApp)),
        down ? (txApp) => down(toMigrationScriptApp(txApp)) : undefined,
        file,
      );
    };

    if (config.OnInit) {
      config.OnInit(globals);
    }

    try {
      await executeModuleAsync(filePath, globals);
    } catch (err) {
      return new Error(`failed to run migration ${file}: ${String(err)}`);
    }
  }

  return null;
}

function registerHooks(app: App, config: Config): Error | null {
  const files = filesContent(config.HooksDir ?? "", config.HooksFilesPattern ?? "");
  if (!files || files.size === 0) {
    return null;
  }

  const absHooksDir = resolve(config.HooksDir ?? "");
  const templateRegistry = NewRegistry();
  const globals = createGlobals(app, absHooksDir, config);
  appBinds(globals, app);

  baseBinds(globals);
  dbxBinds(globals);
  filesystemBinds(globals);
  securityBinds(globals);
  osBinds(globals);
  filepathBinds(globals);
  httpClientBinds(globals);
  formsBinds(globals);
  apisBinds(globals);
  mailsBinds(globals);
  globals.$template = templateRegistry;
  hooksBinds(app, globals);
  cronBinds(app, globals);
  routerBinds(app, globals);

  if (config.OnInit) {
    config.OnInit(globals);
  }

  for (const [file, filePath] of files.entries()) {
    try {
      executeModule(filePath, globals);
    } catch (err) {
      return new Error(`failed to execute ${file}: ${String(err)}`);
    }
  }

  return null;
}

async function registerHooksAsync(app: App, config: Config): Promise<Error | null> {
  const files = await filesContentAsync(config.HooksDir ?? "", config.HooksFilesPattern ?? "");
  if (!files || files.size === 0) {
    return null;
  }

  const absHooksDir = resolve(config.HooksDir ?? "");
  const templateRegistry = NewRegistry();
  const globals = createGlobals(app, absHooksDir, config);
  appBinds(globals, app);

  baseBinds(globals);
  dbxBinds(globals);
  filesystemBinds(globals);
  securityBinds(globals);
  osBinds(globals);
  filepathBinds(globals);
  httpClientBinds(globals);
  formsBinds(globals);
  apisBinds(globals);
  mailsBinds(globals);
  globals.$template = templateRegistry;
  hooksBinds(app, globals);
  cronBinds(app, globals);
  routerBinds(app, globals);

  if (config.OnInit) {
    config.OnInit(globals);
  }

  for (const [file, filePath] of files.entries()) {
    try {
      await executeModuleAsync(filePath, globals);
    } catch (err) {
      return new Error(`failed to execute ${file}: ${String(err)}`);
    }
  }

  return null;
}

function createGlobals(app: App, hooksDir: string, _config: Config): Record<string, unknown> {
  const globals: Record<string, unknown> = globalThis as unknown as Record<string, unknown>;
  globals.__hooks = hooksDir;
  return globals;
}

function executeModule(filePath: string, globals: Record<string, unknown>): void {
  const resolvedPath = resolve(filePath);
  const require = createRequire(pathToFileURL(resolvedPath));
  globals.require = require;
  globals.__filename = resolvedPath;
  globals.__dirname = dirname(resolvedPath);
  delete (require as unknown as { cache?: Record<string, unknown> }).cache?.[resolvedPath];
  require(resolvedPath);
}

async function executeModuleAsync(filePath: string, globals: Record<string, unknown>): Promise<void> {
  const resolvedPath = resolve(filePath);
  const require = createRequire(pathToFileURL(resolvedPath));
  globals.require = require;
  globals.__filename = resolvedPath;
  globals.__dirname = dirname(resolvedPath);
  delete (require as unknown as { cache?: Record<string, unknown> }).cache?.[resolvedPath];
  require(resolvedPath);
}

function filesContent(dirPath: string, pattern: string): Map<string, string> | null {
  let entries: string[];
  try {
    entries = readdirSync(dirPath).sort();
  } catch {
    return new Map();
  }

  const regex = pattern ? new RegExp(pattern) : null;
  const result = new Map<string, string>();

  for (const name of entries) {
    const full = join(dirPath, name);
    const info = statSync(full);
    if (info.isDirectory()) {
      continue;
    }
    if (regex && !regex.test(name)) {
      continue;
    }
    result.set(name, full);
  }

  return result;
}

async function filesContentAsync(dirPath: string, pattern: string): Promise<Map<string, string> | null> {
  let entries: Dirent[];
  try {
    entries = await readdir(dirPath, { withFileTypes: true });
  } catch {
    return new Map();
  }

  const regex = pattern ? new RegExp(pattern) : null;
  const sorted = entries.sort((a, b) => a.name.localeCompare(b.name));
  const fileNames = sorted
    .filter((entry) => !entry.isDirectory() && (!regex || regex.test(entry.name)))
    .map((entry) => entry.name);
  const result = new Map<string, string>();
  for (const fileName of fileNames) {
    if (fileName) {
      result.set(fileName, join(dirPath, fileName));
    }
  }

  return result;
}

function refreshTypesFile(typesDir: string): void {
  const destination = join(typesDir, typesFileName);
  const data = readFileSync(generatedTypesSourcePath, "utf8");
  mkdirSync(typesDir, { recursive: true });
  writeFileSync(destination, data);
}

async function refreshTypesFileAsync(typesDir: string): Promise<void> {
  const destination = join(typesDir, typesFileName);
  const data = await readFile(generatedTypesSourcePath, "utf8");
  await mkdir(typesDir, { recursive: true });
  await writeFile(destination, data);
}

function resolveGeneratedTypesSourcePath(baseDir: string): string {
  const candidates = [
    "./internal/types/generated/types.d.ts",
    "../src/plugins/jsvm/internal/types/generated/types.d.ts",
    "../../src/plugins/jsvm/internal/types/generated/types.d.ts",
  ];

  for (const relativePath of candidates) {
    const candidate = resolve(baseDir, relativePath);
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return resolve(baseDir, candidates[0] ?? ".");
}
