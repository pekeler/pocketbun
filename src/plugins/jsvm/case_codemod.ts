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

export function rewriteJSVMCase(source: string, fileName = "hooks.pb.js"): JSVMCaseRewriteResult {
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, scriptKindForFile(fileName));
  let replacements = 0;

  const transformer: ts.TransformerFactory<ts.SourceFile> = (context) => {
    const factory = context.factory;

    const visit: ts.Visitor = (node): ts.VisitResult<ts.Node> => {
      if (ts.isPropertyAccessExpression(node)) {
        const expression = ts.visitNode(node.expression, visit, ts.isExpression) ?? node.expression;
        const name = convertLegacyName(node.name.text);
        if (!name && expression === node.expression) {
          return node;
        }
        if (name) {
          replacements += 1;
        }
        return factory.updatePropertyAccessExpression(node, expression, name ? factory.createIdentifier(name) : node.name);
      }

      if (ts.isElementAccessExpression(node)) {
        const expression = ts.visitNode(node.expression, visit, ts.isExpression) ?? node.expression;
        const argument = ts.visitNode(node.argumentExpression, visit, ts.isExpression) ?? node.argumentExpression;
        const name = stringLiteralText(argument);
        const converted = name ? convertLegacyName(name) : null;
        if (!converted && expression === node.expression && argument === node.argumentExpression) {
          return node;
        }
        if (converted) {
          replacements += 1;
        }
        return factory.updateElementAccessExpression(
          node,
          expression,
          converted ? factory.createStringLiteral(converted) : argument,
        );
      }

      if (ts.isPropertyAssignment(node)) {
        const initializer = ts.visitNode(node.initializer, visit, ts.isExpression) ?? node.initializer;
        const name = convertPropertyName(factory, node.name);
        if (!name && initializer === node.initializer) {
          return node;
        }
        if (name) {
          replacements += 1;
        }
        return factory.updatePropertyAssignment(node, name ?? node.name, initializer);
      }

      if (ts.isShorthandPropertyAssignment(node)) {
        const name = convertLegacyName(node.name.text);
        if (!name) {
          return node;
        }
        replacements += 1;
        return factory.createPropertyAssignment(factory.createIdentifier(name), node.name);
      }

      if (ts.isMethodDeclaration(node) && ts.isObjectLiteralExpression(node.parent)) {
        const body = ts.visitNode(node.body, visit, ts.isBlock);
        const name = convertPropertyName(factory, node.name);
        if (!name && body === node.body) {
          return node;
        }
        if (name) {
          replacements += 1;
        }
        return factory.updateMethodDeclaration(
          node,
          node.modifiers,
          node.asteriskToken,
          name ?? node.name,
          node.questionToken,
          node.typeParameters,
          node.parameters,
          node.type,
          body,
        );
      }

      if (ts.isBindingElement(node) && ts.isObjectBindingPattern(node.parent)) {
        const initializer = node.initializer ? ts.visitNode(node.initializer, visit, ts.isExpression) : undefined;
        const propertyName = node.propertyName ? convertPropertyName(factory, node.propertyName) : null;
        if (propertyName) {
          replacements += 1;
          return factory.updateBindingElement(
            node,
            node.dotDotDotToken,
            propertyName,
            node.name,
            initializer ?? node.initializer,
          );
        }

        if (!node.propertyName && ts.isIdentifier(node.name)) {
          const name = convertLegacyName(node.name.text);
          if (name) {
            replacements += 1;
            return factory.updateBindingElement(
              node,
              node.dotDotDotToken,
              factory.createIdentifier(name),
              node.name,
              initializer ?? node.initializer,
            );
          }
        }

        if (initializer !== node.initializer) {
          return factory.updateBindingElement(node, node.dotDotDotToken, node.propertyName, node.name, initializer);
        }
        return node;
      }

      return ts.visitEachChild(node, visit, context);
    };

    return (node) => ts.visitNode(node, visit, ts.isSourceFile) ?? node;
  };

  const transformed = ts.transform(sourceFile, [transformer]);
  try {
    if (replacements === 0) {
      return { code: source, changed: false, replacements: 0 };
    }

    const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
    const code = printer.printFile(transformed.transformed[0] ?? sourceFile);
    return { code, changed: code !== source, replacements };
  } finally {
    transformed.dispose();
  }
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

function convertPropertyName(factory: ts.NodeFactory, name: ts.PropertyName): ts.PropertyName | null {
  if (ts.isIdentifier(name)) {
    const converted = convertLegacyName(name.text);
    return converted ? factory.createIdentifier(converted) : null;
  }
  if (ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    const converted = convertLegacyName(name.text);
    return converted ? factory.createStringLiteral(converted) : null;
  }
  return null;
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
