// Ported from pocketbase/tools/template/renderer.go
// Deviation: Bun lacks Go's html/template; uses a minimal parser with optional go-text-template support.

import { createRequire } from "node:module";

export type TemplateFunc = (...args: any[]) => unknown;
export type TemplateFuncs = Record<string, TemplateFunc>;
export type TemplateSource = { name: string; content: string };

type TemplateExecutor = {
  render: (data: unknown) => string;
};

type ExternalTemplateResult = { executor: TemplateExecutor } | { parseError: Error } | null;

const require = createRequire(import.meta.url);
let cachedGoTextTemplate: unknown = null;
let hasCachedGoTextTemplate = false;

function loadGoTextTemplate(): unknown {
  if (hasCachedGoTextTemplate) {
    return cachedGoTextTemplate;
  }

  try {
    cachedGoTextTemplate = require("go-text-template");
  } catch {
    cachedGoTextTemplate = null;
  }

  hasCachedGoTextTemplate = true;
  return cachedGoTextTemplate;
}

export class SafeString {
  value: string;

  constructor(value: string) {
    this.value = value;
  }

  toString(): string {
    return this.value;
  }
}

// Renderer defines a single parsed template.
export class Renderer {
  template: TemplateExecutor | null;
  parseError: Error | null;

  constructor(template: TemplateExecutor | null = null, parseError: Error | null = null) {
    this.template = template;
    this.parseError = parseError;
  }

  // Render executes the template with the specified data as the dot object
  // and returns the result as plain string.
  Render(data: unknown): string {
    if (this.parseError) {
      throw this.parseError;
    }

    if (!this.template) {
      throw new Error("invalid or nil template");
    }

    return this.template.render(data);
  }

  render(data: unknown): string {
    return this.Render(data);
  }
}

export function buildRenderer(sources: TemplateSource[], funcs: TemplateFuncs): Renderer {
  const external = tryBuildExternalTemplate(sources, funcs);
  if (external) {
    if ("parseError" in external) {
      return new Renderer(null, external.parseError);
    }
    return new Renderer(external.executor, null);
  }

  try {
    const template = parseTemplateSources(sources, funcs);
    return new Renderer({ render: (data) => template.render(data) }, null);
  } catch (error) {
    return new Renderer(null, error as Error);
  }
}

class InternalTemplate {
  #rootName: string;
  #templates: Record<string, string>;
  #funcs: TemplateFuncs;
  #missingKeyError = false;

  constructor(rootName: string, templates: Record<string, string>, funcs: TemplateFuncs) {
    this.#rootName = rootName;
    this.#templates = templates;
    this.#funcs = funcs;
  }

  SetMissingKeyError(value: boolean): void {
    this.#missingKeyError = value;
  }

  render(data: unknown): string {
    return this.renderTemplate(this.#rootName, data);
  }

  private renderTemplate(name: string, data: unknown): string {
    const tpl = this.#templates[name];
    if (tpl == null) {
      throw new Error(`missing template ${name}`);
    }

    return this.renderString(tpl, data);
  }

  private renderString(text: string, data: unknown): string {
    const tagRegex = /{{\s*([^}]+?)\s*}}/g;
    let result = "";
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = tagRegex.exec(text)) !== null) {
      result += text.slice(lastIndex, match.index);
      const expr = (match[1] ?? "").trim();
      result += this.evaluateExpression(expr, data);
      lastIndex = tagRegex.lastIndex;
    }

    result += text.slice(lastIndex);
    return result;
  }

  private evaluateExpression(expr: string, data: unknown): string {
    if (expr.startsWith("template")) {
      const match = expr.match(/^template\s+"([^"]+)"\s+(.+)$/);
      if (!match) {
        throw new Error(`invalid template expression: ${expr}`);
      }
      const name = match[1] ?? "";
      const ctxExpr = match[2];
      if (!name || !ctxExpr) {
        throw new Error(`invalid template expression: ${expr}`);
      }
      const ctxValue = this.resolveValue(ctxExpr.trim(), data);
      return this.renderTemplate(name, ctxValue);
    }

    const pipeline = expr
      .split("|")
      .map((part) => part.trim())
      .filter(Boolean);
    if (pipeline.length === 0) {
      return "";
    }

    const [first, ...rest] = pipeline;
    if (!first) {
      return "";
    }

    let value = this.resolveValue(first, data);
    for (const fnName of rest) {
      const fn = this.#funcs[fnName];
      if (!fn) {
        throw new Error(`missing template func ${fnName}`);
      }

      const result = fn(value);
      if (Array.isArray(result) && result.length === 2 && result[1] instanceof Error) {
        throw result[1];
      }
      if (result instanceof Error) {
        throw result;
      }

      value = Array.isArray(result) ? result[0] : result;
    }

    if (value instanceof SafeString) {
      return value.value;
    }

    const raw = value == null ? "" : globalThis.String(value);
    return escapeHTML(raw);
  }

  private resolveValue(expr: string, data: unknown): unknown {
    if (expr === "." || expr === "") {
      return data;
    }

    if (!expr.startsWith(".")) {
      return expr;
    }

    const path = expr.slice(1).split(".").filter(Boolean);
    let current: unknown = data;

    for (const key of path) {
      if (current == null) {
        if (this.#missingKeyError) {
          throw new Error(`missing key ${key}`);
        }
        return undefined;
      }

      if (current instanceof Map) {
        current = current.get(key);
      } else if (typeof current === "object") {
        current = (current as Record<string, unknown>)[key];
      } else {
        current = undefined;
      }

      if (current === undefined && this.#missingKeyError) {
        throw new Error(`missing key ${key}`);
      }
    }

    return current;
  }
}

function parseTemplateSources(sources: TemplateSource[], funcs: TemplateFuncs): InternalTemplate {
  const templates: Record<string, string> = {};
  const rootName = sources[0]?.name ?? "";

  for (const source of sources) {
    const { remaining } = extractDefines(source.content, templates);
    if (remaining.trim().length > 0 || source.name === rootName) {
      templates[source.name] = remaining;
    }
  }

  if (!(rootName in templates)) {
    templates[rootName] = "";
  }

  return new InternalTemplate(rootName, templates, funcs);
}

function tryBuildExternalTemplate(sources: TemplateSource[], funcs: TemplateFuncs): ExternalTemplateResult {
  const mod = loadGoTextTemplate();
  if (!mod) {
    return null;
  }

  const combined = sources.map((source) => source.content).join("\n");

  try {
    const maybe = mod as Record<string, unknown>;
    const defaultExport = maybe.default as Record<string, unknown> | undefined;

    const renderFn = pickFunction(maybe, defaultExport, ["render", "Render"]);
    if (renderFn) {
      return {
        executor: {
          render: (data) => callRenderFunction(renderFn, combined, data, funcs),
        },
      };
    }

    const parseFn = pickFunction(maybe, defaultExport, ["parse", "Parse"]);
    if (parseFn) {
      const tpl = callParseFunction(parseFn, combined, funcs);
      const executor = buildExecutorFromTemplate(tpl);
      if (executor) {
        return { executor };
      }
    }

    const TemplateCtor = pickConstructor(maybe, defaultExport, ["Template"]);
    if (TemplateCtor) {
      const tpl = new TemplateCtor(sources[0]?.name ?? "");
      applyFuncsToTemplate(tpl, funcs);
      callTemplateParse(tpl, combined);
      const executor = buildExecutorFromTemplate(tpl);
      if (executor) {
        return { executor };
      }
    }
  } catch (error) {
    return { parseError: error as Error };
  }

  return null;
}

function pickFunction(
  root: Record<string, unknown>,
  fallback: Record<string, unknown> | undefined,
  names: string[],
): ((...args: unknown[]) => unknown) | null {
  for (const name of names) {
    const candidate = root[name];
    if (typeof candidate === "function") {
      return candidate as (...args: unknown[]) => unknown;
    }
    if (fallback && typeof fallback[name] === "function") {
      return fallback[name] as (...args: unknown[]) => unknown;
    }
  }

  return null;
}

function pickConstructor(
  root: Record<string, unknown>,
  fallback: Record<string, unknown> | undefined,
  names: string[],
): (new (...args: unknown[]) => unknown) | null {
  for (const name of names) {
    const candidate = root[name];
    if (typeof candidate === "function") {
      return candidate as new (...args: unknown[]) => unknown;
    }
    if (fallback && typeof fallback[name] === "function") {
      return fallback[name] as new (...args: unknown[]) => unknown;
    }
  }

  return null;
}

function callRenderFunction(
  renderFn: (...args: unknown[]) => unknown,
  templateText: string,
  data: unknown,
  funcs: TemplateFuncs,
): string {
  try {
    return renderFn(templateText, data, { funcs }) as string;
  } catch {
    try {
      return renderFn(templateText, data, funcs) as string;
    } catch {
      return renderFn(templateText, data) as string;
    }
  }
}

function callParseFunction(parseFn: (...args: unknown[]) => unknown, templateText: string, funcs: TemplateFuncs): unknown {
  try {
    return parseFn(templateText, { funcs });
  } catch {
    try {
      return parseFn(templateText, funcs);
    } catch {
      return parseFn(templateText);
    }
  }
}

function callTemplateParse(tpl: unknown, templateText: string): void {
  const candidate = tpl as Record<string, unknown>;
  if (typeof candidate.parse === "function") {
    candidate.parse(templateText);
    return;
  }
  if (typeof candidate.Parse === "function") {
    candidate.Parse(templateText);
    return;
  }
  throw new Error("unsupported go-text-template parser");
}

function applyFuncsToTemplate(tpl: unknown, funcs: TemplateFuncs): void {
  const candidate = tpl as Record<string, unknown>;
  if (typeof candidate.funcs === "function") {
    candidate.funcs(funcs);
    return;
  }
  if (typeof candidate.Funcs === "function") {
    candidate.Funcs(funcs);
    return;
  }
}

function buildExecutorFromTemplate(tpl: unknown): TemplateExecutor | null {
  const candidate = tpl as Record<string, unknown>;
  if (typeof candidate.execute === "function") {
    const exec = candidate.execute as (data: unknown) => unknown;
    return { render: (data) => exec(data) as string };
  }
  if (typeof candidate.Execute === "function") {
    const exec = candidate.Execute as (data: unknown) => unknown;
    return { render: (data) => exec(data) as string };
  }
  if (typeof candidate.render === "function") {
    const exec = candidate.render as (data: unknown) => unknown;
    return { render: (data) => exec(data) as string };
  }
  if (typeof candidate.Render === "function") {
    const exec = candidate.Render as (data: unknown) => unknown;
    return { render: (data) => exec(data) as string };
  }

  return null;
}

function extractDefines(text: string, templates: Record<string, string>): { remaining: string } {
  const defineMatches = text.match(/{{\s*define\s+"[^"]+"\s*}}/g) ?? [];
  const endMatches = text.match(/{{\s*end\s*}}/g) ?? [];
  if (defineMatches.length !== endMatches.length) {
    throw new Error("invalid template: missing {{end}}");
  }

  const defineRegex = /{{\s*define\s+"([^"]+)"\s*}}([\s\S]*?){{\s*end\s*}}/g;
  const remaining = text.replace(defineRegex, (_match, name: string, body: string) => {
    templates[name] = body;
    return "";
  });

  if (remaining.includes("{{define") || remaining.includes("{{end")) {
    throw new Error("invalid template: unexpected define/end");
  }

  return { remaining };
}

function escapeHTML(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
