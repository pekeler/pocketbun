#!/usr/bin/env bun
// PocketBun-only: template scaffolder used by `bun create pocketbun`.

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { cp } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const app = await main(process.argv.slice(2));
if (app instanceof Error) {
  console.error(app.message);
  process.exit(1);
}

async function main(args) {
  const options = parseArgs(args);
  if (options instanceof Error) {
    return options;
  }

  if (options.help) {
    printHelp();
    return null;
  }

  const targetDir = resolve(process.cwd(), options.targetDir);

  const err = ensureTargetDir(targetDir);
  if (err) {
    return err;
  }

  const templateDir = resolve(dirname(fileURLToPath(import.meta.url)), "../template/simple");
  await cp(templateDir, targetDir, { recursive: true });

  const projectName = normalizePackageName(basename(targetDir));
  replaceTemplateVariables(targetDir, projectName);

  if (options.install) {
    const installResult = Bun.spawn(["bun", "install"], {
      cwd: targetDir,
      stdout: "inherit",
      stderr: "inherit",
    });
    const exitCode = await installResult.exited;
    if (exitCode !== 0) {
      return new Error(`Failed to install dependencies in ${targetDir}`);
    }
  }

  printNextSteps(options.targetDir, options.install);
  return null;
}

function parseArgs(args) {
  const options = {
    help: false,
    install: true,
    targetDir: "pocketbun-app",
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i] ?? "";

    if (arg === "-h" || arg === "--help") {
      options.help = true;
      continue;
    }

    if (arg === "--no-install") {
      options.install = false;
      continue;
    }

    if (arg === "--install") {
      options.install = true;
      continue;
    }

    if (arg.startsWith("-")) {
      return new Error(`Unknown flag: ${arg}`);
    }

    options.targetDir = arg;
  }

  return options;
}

function ensureTargetDir(targetDir) {
  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
    return null;
  }

  const info = statSync(targetDir);
  if (!info.isDirectory()) {
    return new Error(`Target exists and is not a directory: ${targetDir}`);
  }

  const files = readdirSync(targetDir);
  if (files.length > 0) {
    return new Error(`Target directory is not empty: ${targetDir}`);
  }

  return null;
}

function replaceTemplateVariables(targetDir, projectName) {
  const packageJsonPath = join(targetDir, "package.json");
  const readmePath = join(targetDir, "README.md");

  const packageJson = readFileSync(packageJsonPath, "utf8").replaceAll("__PROJECT_NAME__", projectName);
  writeFileSync(packageJsonPath, packageJson);

  const readme = readFileSync(readmePath, "utf8").replaceAll("__PROJECT_NAME__", projectName);
  writeFileSync(readmePath, readme);
}

function normalizePackageName(name) {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");

  return normalized || "pocketbun-app";
}

function printHelp() {
  console.log(`create-pocketbun

Usage:
  bun create pocketbun [target-dir] [--no-install]

Flags:
  -h, --help       Show help
  --install        Install dependencies (default)
  --no-install     Skip dependency installation
`);
}

function printNextSteps(targetDir, installed) {
  console.log("");
  console.log("Created PocketBun app.");
  console.log("");
  console.log("Next steps:");
  console.log(`  cd ${targetDir}`);
  if (!installed) {
    console.log("  bun install");
  }
  console.log("  bun run superuser");
  console.log("  bun run start");
}
