// PocketBun-only: codemod helpers for migrating older PocketBun JSVM hooks
// from Go-style exported names to PocketBase JSVM-style lower-camel names.

import { lstat, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import * as ts from "typescript";
import { convertGoToJSName } from "./mapper.ts";

export const defaultJSVMCaseCodemodExtensions = [".js", ".ts", ".mjs", ".mts", ".cjs", ".cts"];
const defaultJSVMCaseCodemodPaths = ["pb_hooks", "pb_migrations"];
const skippedDirNames = new Set([".git", "node_modules", "pb_data", "vendor"]);
const exactLegacyNames = new Map([
  ["New", "newPocketBase"],
  ["NewWithConfig", "newPocketBaseWithConfig"],
  ["Version", "version"],
  ["Static", "serveStatic"],
  ["RequireGuestOnly", "requireGuestOnly"],
  ["RequireAuth", "requireAuth"],
  ["RequireSuperuserAuth", "requireSuperuserAuth"],
  ["RequireSuperuserOrOwnerAuth", "requireSuperuserOrOwnerAuth"],
  ["RequireSameCollectionContextAuth", "requireSameCollectionContextAuth"],
  ["SkipSuccessActivityLog", "skipSuccessActivityLog"],
  ["RegisterServerJS", "registerServerJS"],
  ["MustRegisterServerJS", "mustRegisterServerJS"],
  ["RegisterServerJSAsync", "registerServerJSAsync"],
  ["MustRegisterServerJSAsync", "mustRegisterServerJSAsync"],
  ["RegisterJSVM", "registerServerJS"],
  ["MustRegisterJSVM", "mustRegisterServerJS"],
  ["RegisterJSVMAsync", "registerServerJSAsync"],
  ["MustRegisterJSVMAsync", "mustRegisterServerJSAsync"],
  ["JSVMConfig", "ServerJSConfig"],
  ["RegisterHooksPlugin", "registerServerJS"],
  ["MustRegisterHooksPlugin", "mustRegisterServerJS"],
  ["RegisterHooksPluginAsync", "registerServerJSAsync"],
  ["MustRegisterHooksPluginAsync", "mustRegisterServerJSAsync"],
  ["RegisterMigrateCmd", "registerMigrateCmd"],
  ["MustRegisterMigrateCmd", "mustRegisterMigrateCmd"],
  ["TemplateLangJS", "templateLangJS"],
  ["TemplateLangGo", "templateLangJS"],
  ["BindCore", "bindCore"],
  ["BindDbx", "bindDbx"],
  ["BindMails", "bindMails"],
  ["BindSecurity", "bindSecurity"],
  ["BindFilesystem", "bindFilesystem"],
  ["BindFilepath", "bindFilepath"],
  ["BindOS", "bindOS"],
  ["BindForms", "bindForms"],
  ["BindApis", "bindApis"],
  ["BindHTTP", "bindHTTP"],
  ["Create", "create"],
  ["CreateAsync", "createAsync"],
  ["Extract", "extract"],
  ["ExtractAsync", "extractAsync"],
  ["NewRegistry", "newRegistry"],
]);
const packageConfigNameReplacements = new Map([
  ["Automigrate", "automigrate"],
  ["Dir", "dir"],
  ["HooksDir", "hooksDir"],
  ["HooksFilesPattern", "hooksFilesPattern"],
  ["HooksPoolSize", "hooksPoolSize"],
  ["HooksWatch", "hooksWatch"],
  ["MigrationsDir", "migrationsDir"],
  ["MigrationsFilesPattern", "migrationsFilesPattern"],
  ["OnInit", "onInit"],
  ["TemplateLang", "templateLang"],
  ["TypesDir", "typesDir"],
]);
const migrationAppName = "migrationApp";
const migrationCollectionMethods = new Set(["delete", "findCollectionByNameOrId", "importCollections", "save"]);

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
    } else if (ts.isIdentifier(node)) {
      addExactIdentifierReplacement(sourceFile, edits, node);
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
    } else if (ts.isCallExpression(node)) {
      addMigrationAppReplacements(sourceFile, edits, node);
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
  const exact = exactLegacyNames.get(name);
  if (exact) {
    return exact;
  }
  const packageConfigName = packageConfigNameReplacements.get(name);
  if (packageConfigName) {
    return packageConfigName;
  }
  if (!/^[A-Z]/.test(name)) {
    return null;
  }
  const converted = convertGoToJSName(name);
  return converted === name ? null : converted;
}

function convertExactLegacyName(name: string): string | null {
  return exactLegacyNames.get(name) ?? null;
}

function addExactIdentifierReplacement(sourceFile: ts.SourceFile, edits: SourceEdit[], name: ts.Identifier): void {
  const converted = convertExactLegacyName(name.text);
  if (!converted) {
    return;
  }
  addSourceEdit(edits, { start: name.getStart(sourceFile), end: name.getEnd(), text: converted });
}

function addIdentifierReplacement(sourceFile: ts.SourceFile, edits: SourceEdit[], name: ts.Identifier): void {
  const converted = convertLegacyName(name.text);
  if (!converted) {
    return;
  }
  addSourceEdit(edits, { start: name.getStart(sourceFile), end: name.getEnd(), text: converted });
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
  const exact = convertExactLegacyName(name.text);
  if (exact) {
    addSourceEdit(edits, { start: name.getStart(sourceFile), end: name.getEnd(), text: exact });
    return;
  }

  const converted = convertLegacyName(name.text);
  if (!converted) {
    return;
  }
  addSourceEdit(edits, { start: name.getStart(sourceFile), end: name.getStart(sourceFile), text: `${converted}: ` });
}

function addStringLiteralReplacement(sourceFile: ts.SourceFile, edits: SourceEdit[], node: ts.Expression, text: string): void {
  const start = node.getStart(sourceFile);
  const end = node.getEnd();
  if (end - start < 2) {
    return;
  }
  addSourceEdit(edits, { start: start + 1, end: end - 1, text });
}

function addMigrationAppReplacements(sourceFile: ts.SourceFile, edits: SourceEdit[], node: ts.CallExpression): void {
  if (!ts.isIdentifier(node.expression) || node.expression.text !== "migrate") {
    return;
  }

  for (const argument of node.arguments) {
    if (!ts.isArrowFunction(argument) && !ts.isFunctionExpression(argument)) {
      continue;
    }
    const param = argument.parameters[0];
    if (!param || !ts.isIdentifier(param.name) || !ts.isBlock(argument.body)) {
      continue;
    }

    addMigrationBlockReplacements(sourceFile, edits, argument.body, param.name.text);
  }
}

function addMigrationBlockReplacements(sourceFile: ts.SourceFile, edits: SourceEdit[], block: ts.Block, appName: string): void {
  const replacements: SourceEdit[] = [];
  let hasCollectionSchemaSignal = false;

  const visit = (node: ts.Node) => {
    if (node !== block && ts.isFunctionLike(node)) {
      return;
    }

    if (isCollectionConstructorUsage(node)) {
      hasCollectionSchemaSignal = true;
    }

    if (
      ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === appName &&
      isMigrationCollectionMethod(node.name.text)
    ) {
      if (isMigrationCollectionLookupMethod(node.name.text)) {
        hasCollectionSchemaSignal = true;
      }
      replacements.push({
        start: node.expression.getStart(sourceFile),
        end: node.expression.getEnd(),
        text: migrationAppName,
      });
    }

    ts.forEachChild(node, visit);
  };
  ts.forEachChild(block, visit);

  if (replacements.length === 0 || !hasCollectionSchemaSignal) {
    return;
  }

  for (const replacement of replacements) {
    addSourceEdit(edits, replacement);
  }

  if (!hasTopLevelMigrationAppDeclaration(block)) {
    addSourceEdit(edits, {
      start: block.getStart(sourceFile) + 1,
      end: block.getStart(sourceFile) + 1,
      text: `\n${detectBlockIndent(sourceFile, block)}const ${migrationAppName} = ${appName}.forMigrations();`,
    });
  }
}

function isMigrationCollectionMethod(name: string): boolean {
  const converted = convertLegacyName(name);
  return migrationCollectionMethods.has(converted ?? name);
}

function isMigrationCollectionLookupMethod(name: string): boolean {
  const converted = convertLegacyName(name) ?? name;
  return converted === "findCollectionByNameOrId" || converted === "importCollections";
}

function isCollectionConstructorUsage(node: ts.Node): boolean {
  if (ts.isNewExpression(node) && ts.isIdentifier(node.expression)) {
    return node.expression.text === "Collection";
  }
  if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
    return (
      node.expression.text === "newCollection" ||
      node.expression.text === "newBaseCollection" ||
      node.expression.text === "newAuthCollection" ||
      node.expression.text === "newViewCollection"
    );
  }
  return false;
}

function hasTopLevelMigrationAppDeclaration(block: ts.Block): boolean {
  for (const statement of block.statements) {
    if (!ts.isVariableStatement(statement)) {
      continue;
    }
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === migrationAppName) {
        return true;
      }
    }
  }
  return false;
}

function detectBlockIndent(sourceFile: ts.SourceFile, block: ts.Block): string {
  const source = sourceFile.text;
  const openBraceEnd = block.getStart(sourceFile) + 1;
  const lineEnd = source.indexOf("\n", openBraceEnd);
  if (lineEnd < 0) {
    return "  ";
  }

  const nextLineStart = lineEnd + 1;
  const match = /^[\t ]*/.exec(source.slice(nextLineStart));
  const indent = match?.[0] ?? "";
  return indent || "  ";
}

function addSourceEdit(edits: SourceEdit[], edit: SourceEdit): void {
  for (const existing of edits) {
    if (existing.start === edit.start && existing.end === edit.end) {
      if (existing.text !== edit.text) {
        throw new Error("conflicting JSVM case codemod edits");
      }
      return;
    }
  }
  edits.push(edit);
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
