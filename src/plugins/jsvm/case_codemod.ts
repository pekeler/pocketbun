// PocketBun-only: codemod helpers for migrating older PocketBun JSVM hooks
// from Go-style exported names to PocketBase JSVM-style lower-camel names.

import { existsSync, readFileSync } from "node:fs";
import { lstat, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as ts from "typescript";
import { convertJSToGoName } from "./mapper.ts";

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
const fallbackRuntimeNameReplacements = new Map([
  ["After", "after"],
  ["App", "app"],
  ["Auth", "auth"],
  ["Before", "before"],
  ["Bind", "bind"],
  ["BindBody", "bindBody"],
  ["BindFunc", "bindFunc"],
  ["Body", "body"],
  ["ClientId", "clientId"],
  ["Collection", "collection"],
  ["Compare", "compare"],
  ["CompletionOptions", "completionOptions"],
  ["Context", "context"],
  ["Data", "data"],
  ["DisableDefaultCmd", "disableDefaultCmd"],
  ["Email", "email"],
  ["Fields", "fields"],
  ["Filesystem", "filesystem"],
  ["FParseErrWhitelist", "fParseErrWhitelist"],
  ["Func", "func"],
  ["Get", "get"],
  ["GetDateTime", "getDateTime"],
  ["GetString", "getString"],
  ["GET", "get"],
  ["HEAD", "head"],
  ["HTML", "html"],
  ["HasRoute", "hasRoute"],
  ["HasSuperuserAuth", "hasSuperuserAuth"],
  ["Help", "help"],
  ["Hidden", "hidden"],
  ["Id", "id"],
  ["IsZero", "isZero"],
  ["JSON", "json"],
  ["KeyId", "keyId"],
  ["Long", "long"],
  ["MarshalJSON", "marshalJSON"],
  ["Message", "message"],
  ["Name", "name"],
  ["Next", "next"],
  ["Order", "order"],
  ["OPTIONS", "options"],
  ["PATCH", "patch"],
  ["POST", "post"],
  ["Priority", "priority"],
  ["PrivateKey", "privateKey"],
  ["PUT", "put"],
  ["Quoted", "quoted"],
  ["Raw", "raw"],
  ["RawData", "rawData"],
  ["RawExpires", "rawExpires"],
  ["Record", "record"],
  ["RootCmd", "rootCmd"],
  ["Router", "router"],
  ["RunE", "runE"],
  ["SEARCH", "search"],
  ["Set", "set"],
  ["SetErr", "setErr"],
  ["SetHelpCommand", "setHelpCommand"],
  ["SetMessage", "setMessage"],
  ["SetOut", "setOut"],
  ["Short", "short"],
  ["SilenceUsage", "silenceUsage"],
  ["Status", "status"],
  ["String", "string"],
  ["Submit", "submit"],
  ["TeamId", "teamId"],
  ["Template", "template"],
  ["UnmarshalJSON", "unmarshalJSON"],
  ["UnknownFlags", "unknownFlags"],
  ["Unparsed", "unparsed"],
  ["Valid", "valid"],
  ["ValidArgs", "validArgs"],
  ["Validate", "validate"],
  ["Value", "value"],
  ["Version", "version"],
  ["Write", "write"],
  ["WriteSSE", "writeSSE"],
  ["XML", "xml"],
]);
const runtimeNameReplacements = createRuntimeNameReplacements();
const optionObjectConstructors = new Set([
  "BaseCollection",
  "AuthCollection",
  "Collection",
  "Command",
  "Cookie",
  "RequestInfo",
  "SubscriptionMessage",
  "ViewCollection",
]);
const hookHandlerOptionNames = new Set(["Func", "Id", "Priority"]);
const writerOptionNames = new Set(["Write"]);
const commandNestedOptionNames = new Set([
  "CompletionOptions",
  "FParseErrWhitelist",
  "completionOptions",
  "fParseErrWhitelist",
]);
const packageConfigTypeNames = new Set(["Config", "JSVMConfig", "PocketBaseConfig", "ServerJSConfig"]);
const packageConfigFunctionNames = new Set([
  "MustRegisterHooksPlugin",
  "MustRegisterHooksPluginAsync",
  "MustRegisterJSVM",
  "MustRegisterJSVMAsync",
  "MustRegisterMigrateCmd",
  "MustRegisterServerJS",
  "MustRegisterServerJSAsync",
  "NewWithConfig",
  "RegisterHooksPlugin",
  "RegisterHooksPluginAsync",
  "RegisterJSVM",
  "RegisterJSVMAsync",
  "RegisterMigrateCmd",
  "RegisterServerJS",
  "RegisterServerJSAsync",
  "mustRegisterServerJS",
  "mustRegisterServerJSAsync",
  "mustRegisterMigrateCmd",
  "newPocketBaseWithConfig",
  "registerMigrateCmd",
  "registerJSVM",
  "registerServerJS",
  "registerServerJSAsync",
]);
const hookBindMethodNames = new Set(["Bind", "bind"]);
const writerMethodNames = new Set(["SetErr", "SetOut", "WriteSSE", "setErr", "setOut", "writeSSE"]);
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
  const plainObjectIdentifiers = collectPlainObjectIdentifiers(sourceFile);

  const visit = (node: ts.Node) => {
    if (ts.isPropertyAccessExpression(node)) {
      if (ts.isIdentifier(node.name) && shouldRewritePropertyAccess(node, plainObjectIdentifiers)) {
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
      if (shouldRewriteObjectLiteralMember(node)) {
        addPropertyNameReplacement(sourceFile, edits, node.name);
      }
    } else if (ts.isShorthandPropertyAssignment(node)) {
      if (shouldRewriteObjectLiteralMember(node)) {
        addShorthandPropertyReplacement(sourceFile, edits, node.name);
      }
    } else if (ts.isMethodDeclaration(node) && ts.isObjectLiteralExpression(node.parent)) {
      if (shouldRewriteObjectLiteralMember(node)) {
        addPropertyNameReplacement(sourceFile, edits, node.name);
      }
    } else if (ts.isBindingElement(node) && ts.isObjectBindingPattern(node.parent)) {
      if (shouldRewriteBindingElement(node)) {
        if (node.propertyName) {
          addPropertyNameReplacement(sourceFile, edits, node.propertyName);
        } else if (ts.isIdentifier(node.name)) {
          addShorthandPropertyReplacement(sourceFile, edits, node.name);
        }
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
  return runtimeNameReplacements.get(name) ?? null;
}

function convertExactLegacyName(name: string): string | null {
  return exactLegacyNames.get(name) ?? null;
}

function createRuntimeNameReplacements(): Map<string, string> {
  const replacements = new Map(fallbackRuntimeNameReplacements);
  const generatedTypes = readGeneratedTypesText();
  if (!generatedTypes) {
    return replacements;
  }

  const sf = ts.createSourceFile("types.d.ts", generatedTypes, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const addName = (name: string | null) => {
    if (!name || name === "constructor" || name.startsWith("_")) {
      return;
    }

    addRuntimeNameReplacement(replacements, convertJSToGoName(name), name);
    const acronym = acronymLegacyName(name);
    if (acronym) {
      addRuntimeNameReplacement(replacements, acronym, name);
    }
  };

  const visit = (node: ts.Node) => {
    if (ts.isMethodSignature(node) || ts.isPropertySignature(node)) {
      addName(propertyNameText(node.name));
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);

  return replacements;
}

function readGeneratedTypesText(): string | null {
  for (const path of generatedTypesCandidatePaths()) {
    try {
      if (existsSync(path)) {
        return readFileSync(path, "utf8");
      }
    } catch {
      // ignore and try the next source/dist-relative candidate
    }
  }
  return null;
}

function generatedTypesCandidatePaths(): string[] {
  return [
    new URL("./internal/types/generated/types.d.ts", import.meta.url),
    new URL("../src/plugins/jsvm/internal/types/generated/types.d.ts", import.meta.url),
  ].map((url) => fileURLToPath(url));
}

function addRuntimeNameReplacement(replacements: Map<string, string>, legacyName: string, preferredName: string): void {
  if (legacyName && legacyName !== preferredName) {
    replacements.set(legacyName, preferredName);
  }
}

function acronymLegacyName(name: string): string | null {
  switch (name) {
    case "html":
      return "HTML";
    case "json":
      return "JSON";
    case "xml":
      return "XML";
    default:
      return null;
  }
}

function propertyNameText(name: ts.PropertyName | ts.BindingName | undefined): string | null {
  if (!name) {
    return null;
  }
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  return null;
}

function collectPlainObjectIdentifiers(sourceFile: ts.SourceFile): Set<string> {
  const identifiers = new Set<string>();

  const visit = (node: ts.Node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isObjectLiteralExpression(node.initializer) &&
      !isKnownOptionObject(node.initializer)
    ) {
      identifiers.add(node.name.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  return identifiers;
}

function shouldRewritePropertyAccess(node: ts.PropertyAccessExpression, plainObjectIdentifiers: Set<string>): boolean {
  if (!convertLegacyName(node.name.text)) {
    return false;
  }

  const baseIdentifier = baseIdentifierText(node.expression);
  return !baseIdentifier || !plainObjectIdentifiers.has(baseIdentifier);
}

function baseIdentifierText(node: ts.Expression): string | null {
  let current: ts.Expression = node;
  while (ts.isPropertyAccessExpression(current) || ts.isElementAccessExpression(current) || ts.isCallExpression(current)) {
    current = current.expression;
  }
  return ts.isIdentifier(current) ? current.text : null;
}

function shouldRewriteObjectLiteralMember(
  node: ts.PropertyAssignment | ts.ShorthandPropertyAssignment | ts.MethodDeclaration,
): boolean {
  const legacyName = propertyNameText(node.name);
  if (!legacyName || !convertLegacyName(legacyName) || !ts.isObjectLiteralExpression(node.parent)) {
    return false;
  }

  const object = node.parent;
  if (packageConfigNameReplacements.has(legacyName)) {
    return isPackageConfigObject(object);
  }
  if (hookHandlerOptionNames.has(legacyName) && isHookHandlerObject(object)) {
    return true;
  }
  if (writerOptionNames.has(legacyName) && isWriterObject(object)) {
    return true;
  }
  if (isCommandNestedOptionObject(object)) {
    return true;
  }
  return isKnownOptionObject(object);
}

function shouldRewriteBindingElement(node: ts.BindingElement): boolean {
  const legacyName = propertyNameText(node.propertyName ?? node.name);
  if (!legacyName || !convertLegacyName(legacyName)) {
    return false;
  }

  const declaration = bindingVariableDeclaration(node);
  return Boolean(declaration?.initializer && isLikelyEventExpression(declaration.initializer));
}

function bindingVariableDeclaration(node: ts.BindingElement): ts.VariableDeclaration | null {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (ts.isVariableDeclaration(current)) {
      return current;
    }
    current = current.parent;
  }
  return null;
}

function isLikelyEventExpression(node: ts.Expression): boolean {
  return ts.isIdentifier(node) && /^(e|event|hookEvent|requestEvent)$/.test(node.text);
}

function isKnownOptionObject(object: ts.ObjectLiteralExpression): boolean {
  const parent = object.parent;
  if (ts.isNewExpression(parent) && isArgument(parent.arguments, object)) {
    const name = expressionName(parent.expression);
    return Boolean(name && (optionObjectConstructors.has(name) || name.endsWith("Field")));
  }
  if (ts.isCallExpression(parent) && isArgument(parent.arguments, object)) {
    const name = expressionName(parent.expression);
    return Boolean(name && ["newAuthCollection", "newBaseCollection", "newCollection", "newViewCollection"].includes(name));
  }
  return isPackageConfigObject(object);
}

function isPackageConfigObject(object: ts.ObjectLiteralExpression): boolean {
  const parent = object.parent;
  if (ts.isVariableDeclaration(parent) && parent.type) {
    const name = typeName(parent.type);
    if (name && packageConfigTypeNames.has(name)) {
      return true;
    }
  }
  if ((ts.isCallExpression(parent) || ts.isNewExpression(parent)) && isArgument(parent.arguments, object)) {
    const name = expressionName(parent.expression);
    return Boolean(name && packageConfigFunctionNames.has(name));
  }
  return false;
}

function isHookHandlerObject(object: ts.ObjectLiteralExpression): boolean {
  const parent = object.parent;
  if (!ts.isCallExpression(parent) || !isArgument(parent.arguments, object)) {
    return false;
  }
  const name = expressionName(parent.expression);
  return Boolean(name && hookBindMethodNames.has(name));
}

function isWriterObject(object: ts.ObjectLiteralExpression): boolean {
  const parent = object.parent;
  if (!ts.isCallExpression(parent) || !isArgument(parent.arguments, object)) {
    return false;
  }
  const name = expressionName(parent.expression);
  return Boolean(name && writerMethodNames.has(name));
}

function isCommandNestedOptionObject(object: ts.ObjectLiteralExpression): boolean {
  const parent = object.parent;
  return ts.isPropertyAssignment(parent) && commandNestedOptionNames.has(propertyNameText(parent.name) ?? "");
}

function isArgument(argumentsList: ts.NodeArray<ts.Expression> | undefined, object: ts.ObjectLiteralExpression): boolean {
  return Boolean(argumentsList?.some((argument) => argument === object));
}

function expressionName(node: ts.Expression): string | null {
  if (ts.isIdentifier(node)) {
    return node.text;
  }
  if (ts.isPropertyAccessExpression(node)) {
    return node.name.text;
  }
  return null;
}

function typeName(node: ts.TypeNode): string | null {
  if (ts.isTypeReferenceNode(node)) {
    const name = node.typeName;
    if (ts.isIdentifier(name)) {
      return name.text;
    }
    return name.right.text;
  }
  return null;
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
