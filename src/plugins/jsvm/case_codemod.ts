// PocketBun-only: codemod helpers for migrating older PocketBun JSVM hooks
// from Go-style exported names to PocketBase JSVM-style lower-camel names.

import { lstat, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import * as ts from "typescript";
import { convertGoToJSName } from "./mapper.ts";

export const defaultJSVMCaseCodemodExtensions = [".js", ".ts", ".mjs", ".mts", ".cjs", ".cts"];
const defaultJSVMCaseCodemodPaths = ["pb_hooks", "pb_migrations"];
const skippedDirNames = new Set([".git", "node_modules", "pb_data", "vendor"]);

export type JSVMCaseRewriteResult = {
  code: string;
  changed: boolean;
  replacements: number;
};

export type JSVMCaseCodemodFileResult = {
  path: string;
  changed: boolean;
  replacements: number;
  written: boolean;
};

export type JSVMCaseCodemodSummary = {
  scanned: number;
  changed: number;
  replacements: number;
  files: JSVMCaseCodemodFileResult[];
};

export type JSVMCaseCodemodOptions = {
  check?: boolean;
  dryRun?: boolean;
  cwd?: string;
  extensions?: string[];
};

type SourceEdit = {
  start: number;
  end: number;
  text: string;
};

export function rewriteJSVMCase(source: string, fileName = "hooks.pb.js"): JSVMCaseRewriteResult {
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, scriptKindForFile(fileName));
  const edits: SourceEdit[] = [];

  const visit = (node: ts.Node) => {
    if (ts.isPropertyAccessExpression(node)) {
      if (ts.isIdentifier(node.name)) {
        addIdentifierReplacement(sourceFile, edits, node.name);
      }
    } else if (ts.isElementAccessExpression(node)) {
      const argument = node.argumentExpression;
      const name = stringLiteralText(argument);
      const converted = name ? convertLegacyName(name) : null;
      if (converted && argument) {
        addStringLiteralReplacement(sourceFile, edits, argument, converted);
      }
    } else if (ts.isPropertyAssignment(node)) {
      addPropertyNameReplacement(sourceFile, edits, node.name);
    } else if (ts.isShorthandPropertyAssignment(node)) {
      addShorthandPropertyReplacement(sourceFile, edits, node.name);
    } else if (ts.isMethodDeclaration(node) && ts.isObjectLiteralExpression(node.parent)) {
      addPropertyNameReplacement(sourceFile, edits, node.name);
    } else if (ts.isBindingElement(node) && ts.isObjectBindingPattern(node.parent)) {
      if (node.propertyName) {
        addPropertyNameReplacement(sourceFile, edits, node.propertyName);
      } else if (ts.isIdentifier(node.name)) {
        addShorthandPropertyReplacement(sourceFile, edits, node.name);
      }
    }

    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  if (edits.length === 0) {
    return { code: source, changed: false, replacements: 0 };
  }

  const code = applySourceEdits(source, edits);
  return { code, changed: code !== source, replacements: edits.length };
}

export async function runJSVMCaseCodemod(
  paths: string[] = [],
  options: JSVMCaseCodemodOptions = {},
): Promise<JSVMCaseCodemodSummary> {
  const cwd = options.cwd ?? process.cwd();
  const extensions = normalizeExtensions(options.extensions ?? defaultJSVMCaseCodemodExtensions);
  const targetPaths = paths.length > 0 ? paths : defaultJSVMCaseCodemodPaths;
  const files = await collectTargetFiles(targetPaths, { cwd, extensions });
  const results: JSVMCaseCodemodFileResult[] = [];
  let replacements = 0;

  for (const file of files) {
    const source = await readFile(file, "utf8");
    const rewrite = rewriteJSVMCase(source, file);
    replacements += rewrite.replacements;
    const written = rewrite.changed && !options.check && !options.dryRun;
    if (written) {
      await writeFile(file, rewrite.code);
    }
    results.push({
      path: file,
      changed: rewrite.changed,
      replacements: rewrite.replacements,
      written,
    });
  }

  return {
    scanned: files.length,
    changed: results.filter((result) => result.changed).length,
    replacements,
    files: results,
  };
}

function convertLegacyName(name: string): string | null {
  if (!/^[A-Z]/.test(name)) {
    return null;
  }
  const converted = convertGoToJSName(name);
  return converted === name ? null : converted;
}

function addIdentifierReplacement(sourceFile: ts.SourceFile, edits: SourceEdit[], name: ts.Identifier): void {
  const converted = convertLegacyName(name.text);
  if (!converted) {
    return;
  }
  edits.push({ start: name.getStart(sourceFile), end: name.getEnd(), text: converted });
}

function addPropertyNameReplacement(sourceFile: ts.SourceFile, edits: SourceEdit[], name: ts.PropertyName): void {
  if (ts.isIdentifier(name)) {
    addIdentifierReplacement(sourceFile, edits, name);
    return;
  }

  if (ts.isStringLiteral(name) || ts.isNoSubstitutionTemplateLiteral(name)) {
    const converted = convertLegacyName(name.text);
    if (converted) {
      addStringLiteralReplacement(sourceFile, edits, name, converted);
    }
  }
}

function addShorthandPropertyReplacement(sourceFile: ts.SourceFile, edits: SourceEdit[], name: ts.Identifier): void {
  const converted = convertLegacyName(name.text);
  if (!converted) {
    return;
  }
  edits.push({ start: name.getStart(sourceFile), end: name.getStart(sourceFile), text: `${converted}: ` });
}

function addStringLiteralReplacement(sourceFile: ts.SourceFile, edits: SourceEdit[], node: ts.Expression, text: string): void {
  const start = node.getStart(sourceFile);
  const end = node.getEnd();
  if (end - start < 2) {
    return;
  }
  edits.push({ start: start + 1, end: end - 1, text });
}

function applySourceEdits(source: string, edits: SourceEdit[]): string {
  const sorted = [...edits].sort((a, b) => a.start - b.start || a.end - b.end);
  let previousEnd = 0;
  for (const edit of sorted) {
    if (edit.start < previousEnd) {
      throw new Error("overlapping JSVM case codemod edits");
    }
    previousEnd = edit.end;
  }

  let code = source;
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    const edit = sorted[i]!;
    code = `${code.slice(0, edit.start)}${edit.text}${code.slice(edit.end)}`;
  }
  return code;
}

function stringLiteralText(node: ts.Expression | undefined): string | null {
  if (!node) {
    return null;
  }
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  return null;
}

async function collectTargetFiles(paths: string[], options: { cwd: string; extensions: Set<string> }): Promise<string[]> {
  const files: string[] = [];
  for (const path of paths) {
    await collectPath(resolve(options.cwd, path), options.extensions, files);
  }
  return files.sort();
}

async function collectPath(path: string, extensions: Set<string>, files: string[]): Promise<void> {
  let info;
  try {
    info = await lstat(path);
  } catch (error) {
    if ((error as { code?: string }).code === "ENOENT") {
      return;
    }
    throw error;
  }

  if (info.isSymbolicLink()) {
    return;
  }

  if (info.isDirectory()) {
    if (skippedDirNames.has(basename(path))) {
      return;
    }
    const entries = await readdir(path, { withFileTypes: true });
    for (const entry of entries) {
      await collectPath(join(path, entry.name), extensions, files);
    }
    return;
  }

  if (!info.isFile() || basename(path).endsWith(".d.ts")) {
    return;
  }

  if (extensions.has(extname(path))) {
    files.push(path);
  }
}

function normalizeExtensions(extensions: string[]): Set<string> {
  return new Set(extensions.map((extension) => (extension.startsWith(".") ? extension : `.${extension}`)));
}

function scriptKindForFile(fileName: string): ts.ScriptKind {
  switch (extname(fileName)) {
    case ".ts":
    case ".mts":
    case ".cts":
      return ts.ScriptKind.TS;
    case ".jsx":
      return ts.ScriptKind.JSX;
    case ".tsx":
      return ts.ScriptKind.TSX;
    default:
      return ts.ScriptKind.JS;
  }
}
