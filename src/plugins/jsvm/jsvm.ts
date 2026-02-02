// Ported from pocketbase/plugins/jsvm/jsvm.go (Bun-native hooks/migrations loader).
// Note: upstream uses a goja VM; PocketBun runs native Bun modules but keeps the jsvm layer
// to preserve the same JS-facing bindings and pb_hooks compatibility.

import { readdirSync, readFileSync, statSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { App } from "../../core/app.ts";
import { AppMigrations } from "../../core/migrations_runner.ts";
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

const typesFileName = "types.d.ts";

export type Config = {
  OnInit?: (globals: Record<string, unknown>) => void;
  HooksWatch?: boolean;
  HooksDir?: string;
  HooksFilesPattern?: string;
  HooksPoolSize?: number;
  MigrationsDir?: string;
  MigrationsFilesPattern?: string;
  TypesDir?: string;
};

export function MustRegister(app: App, config: Config): void {
  const err = Register(app, config);
  if (err) {
    throw err;
  }
}

export function Register(app: App, config: Config): Error | null {
  const normalized: Config = {
    ...config,
  };

  if (!normalized.HooksDir) {
    normalized.HooksDir = join(app.DataDir(), "../pb_hooks");
  }
  if (!normalized.MigrationsDir) {
    normalized.MigrationsDir = join(app.DataDir(), "../pb_migrations");
  }
  if (!normalized.HooksFilesPattern) {
    normalized.HooksFilesPattern = String.raw`^.*(\.pb\.js|\.pb\.ts)$`;
  }
  if (!normalized.MigrationsFilesPattern) {
    normalized.MigrationsFilesPattern = String.raw`^.*(\.js|\.ts)$`;
  }
  if (!normalized.TypesDir) {
    normalized.TypesDir = app.DataDir();
  }

  app.OnBootstrap().BindFunc((e) => {
    const err = e.Next();
    if (err) {
      return err;
    }
    try {
      refreshTypesFile(normalized.TypesDir ?? app.DataDir());
    } catch {
      // ignore types refresh failures
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

function registerMigrations(app: App, config: Config): Error | null {
  const files = filesContent(config.MigrationsDir ?? "", config.MigrationsFilesPattern ?? "");
  if (!files) {
    return null;
  }

  const absHooksDir = resolve(config.HooksDir ?? "");

  for (const [file, content] of files.entries()) {
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

    globals.migrate = (up: (txApp: App) => void, down?: (txApp: App) => void) => {
      AppMigrations.register(up, down, file);
    };

    if (config.OnInit) {
      config.OnInit(globals);
    }

    try {
      executeModule(file, content, globals);
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
  hooksBinds(app, globals);
  cronBinds(app, globals);
  routerBinds(app, globals);

  if (config.OnInit) {
    config.OnInit(globals);
  }

  for (const [file, content] of files.entries()) {
    try {
      executeModule(file, content, globals);
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

function executeModule(fileName: string, content: string, globals: Record<string, unknown>): void {
  const ext = extname(fileName).toLowerCase();
  const tmpPath = writeTempModule(fileName, content);

  const require = createRequire(pathToFileURL(tmpPath));
  globals.require = require;
  globals.__filename = tmpPath;
  globals.__dirname = dirname(tmpPath);

  if (ext === ".cjs" || ext === ".js" || ext === ".ts") {
    delete (require as unknown as { cache?: Record<string, unknown> }).cache?.[tmpPath];
    require(tmpPath);
    return;
  }

  delete (require as unknown as { cache?: Record<string, unknown> }).cache?.[tmpPath];
  require(tmpPath);
}

function writeTempModule(fileName: string, content: string): string {
  const baseTmp = process.env.TMPDIR ?? "/tmp";
  const tmpDir = join(baseTmp, "pb_hooks_tmp");
  if (!existsSync(tmpDir)) {
    mkdirSync(tmpDir, { recursive: true });
  }
  const tmpPath = join(tmpDir, fileName);
  writeFileSync(tmpPath, content);
  return tmpPath;
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
    const raw = readFileSync(full, "utf8");
    result.set(name, raw);
  }

  return result;
}

function refreshTypesFile(typesDir: string): void {
  const source = join(resolve(process.cwd()), "src/plugins/jsvm/internal/types/generated/types.d.ts");
  const destination = join(typesDir, typesFileName);
  const data = readFileSync(source, "utf8");
  if (!existsSync(typesDir)) {
    mkdirSync(typesDir, { recursive: true });
  }
  writeFileSync(destination, data);
}
