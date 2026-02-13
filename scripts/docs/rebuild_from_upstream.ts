#!/usr/bin/env bun
// This script exists to deterministically rebuild PocketBun docs from cached upstream PocketBase docs sources.

import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { posix as pathPosix } from "node:path";

type RouteItem = {
  href: string;
  title: string;
  slug: string;
};

type RouteBundle = {
  route: RouteItem;
  files: string[];
};

type DocsLinkTarget = {
  outputPath: string;
  anchor: string | null;
};

type ReferenceKind = "variables" | "functions" | "classes" | "namespaces";

type ReferenceEntry = {
  declaration: string;
  doc: string;
  kind: ReferenceKind;
  name: string;
};

const CACHE_ROOT = ".cache/upstream-site-docs";
const UPSTREAM_SCREENSHOTS_DIR = pathPosix.join(CACHE_ROOT, "static/images/screenshots");
const LOCAL_SCREENSHOTS_DIR = "docs/assets/upstream/screenshots";
const fileCache = new Map<string, string>();
const JSVM_TYPES_PATH = "src/plugins/jsvm/internal/types/generated/types.d.ts";

function dedupe<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function slugFromHref(href: string): string {
  if (href === "/docs") {
    return "";
  }
  return href.replace(/^\/docs\//, "").replace(/\/+$/, "");
}

function readCachedFile(relPath: string): string {
  const normalized = relPath.replace(/^\/+/, "");
  const fullPath = pathPosix.join(CACHE_ROOT, normalized);
  if (!existsSync(fullPath)) {
    throw new Error(`Missing cached upstream file: ${fullPath}`);
  }
  return readFileSync(fullPath, "utf8");
}

function extractArrayBlock(source: string, exportName: string): string {
  const marker = `export const ${exportName}`;
  const markerIndex = source.indexOf(marker);
  if (markerIndex === -1) {
    throw new Error(`Cannot find ${exportName} in doc_links.js`);
  }

  const openIndex = source.indexOf("[", markerIndex);
  if (openIndex === -1) {
    throw new Error(`Cannot find opening [ for ${exportName}`);
  }

  let depth = 0;
  for (let i = openIndex; i < source.length; i++) {
    const ch = source[i];
    if (ch === "[") {
      depth += 1;
      continue;
    }
    if (ch === "]") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(openIndex + 1, i);
      }
    }
  }

  throw new Error(`Cannot find closing ] for ${exportName}`);
}

function parseRouteItemsFromBlock(block: string): RouteItem[] {
  const order: string[] = [];
  const titleMap = new Map<string, string>();

  const re = /href:\s*"([^"]+)"[\s\S]{0,260}?title:\s*"([^"]+)"/g;
  for (const match of block.matchAll(re)) {
    const href = match[1];
    const title = match[2];

    if (!href.startsWith("/docs")) {
      continue;
    }

    if (!titleMap.has(href)) {
      order.push(href);
    }

    // Keep the latest title for duplicate href entries, e.g. webApi parent/child.
    titleMap.set(href, title);
  }

  return order.map((href) => ({
    href,
    title: titleMap.get(href) ?? href,
    slug: slugFromHref(href),
  }));
}

function normalizeRouteItems(items: RouteItem[]): RouteItem[] {
  const seen = new Set<string>();
  const out: RouteItem[] = [];

  for (const item of items) {
    if (seen.has(item.href)) {
      continue;
    }
    seen.add(item.href);
    out.push(item);
  }

  return out;
}

function extractRelativeImports(relPath: string, content: string): string[] {
  let source = content;

  if (relPath.endsWith(".svelte")) {
    source = [...content.matchAll(/<script[\s\S]*?<\/script>/g)]
      .map((match) => match[0])
      .join("\n");
  }

  const specs: string[] = [];
  const importRegex = /(?:import|export)\s+[^;]*?\sfrom\s+["'](\.{1,2}\/[^"']+)["']/g;

  for (const match of source.matchAll(importRegex)) {
    specs.push(match[1]);
  }

  return dedupe(specs);
}

function normalizeRelPath(baseRelPath: string, importSpec: string): string | null {
  const baseDir = pathPosix.dirname(baseRelPath);
  const resolved = pathPosix.normalize(pathPosix.join(baseDir, importSpec));

  if (resolved.startsWith("../")) {
    return null;
  }

  if (!resolved.endsWith(".svelte") && !resolved.endsWith(".js")) {
    return null;
  }

  return resolved;
}

function fetchFileContent(relPath: string): string {
  const cached = fileCache.get(relPath);
  if (cached !== undefined) {
    return cached;
  }

  const content = readCachedFile(relPath);
  fileCache.set(relPath, content);
  return content;
}

function collectRouteFiles(entryRelPath: string): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];

  function visit(relPath: string): void {
    if (seen.has(relPath)) {
      return;
    }

    seen.add(relPath);
    ordered.push(relPath);

    const content = fetchFileContent(relPath);
    const specs = extractRelativeImports(relPath, content);

    for (const spec of specs) {
      const normalized = normalizeRelPath(relPath, spec);
      if (!normalized) {
        continue;
      }
      visit(normalized);
    }
  }

  visit(entryRelPath);
  return ordered;
}

function extractAttr(attrs: string, name: string): string | null {
  const q = new RegExp(`${name}="([^"]+)"`);
  const qMatch = attrs.match(q);
  if (qMatch) {
    return qMatch[1];
  }

  const braceQuote = new RegExp(`${name}=\{["']([^"']+)["']\}`);
  const bqMatch = attrs.match(braceQuote);
  if (bqMatch) {
    return bqMatch[1];
  }

  return null;
}

function normalizeCodeFenceLanguage(raw: string | null): string {
  const lang = (raw ?? "").trim().toLowerCase();
  if (!lang) {
    // Match upstream CodeBlock.svelte default (`language = "javascript"`).
    return "js";
  }

  switch (lang) {
    case "javascript":
      return "js";
    case "typescript":
      return "ts";
    case "shell":
    case "sh":
      return "bash";
    case "plaintext":
      return "text";
    default:
      return lang;
  }
}

function decodeHtmlEntities(text: string): string {
  return text
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

function normalizeUpstreamHref(href: string): string {
  const trimmed = href.trim();
  if (!trimmed) {
    return "";
  }

  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("mailto:") ||
    trimmed.startsWith("#")
  ) {
    return trimmed;
  }

  if (trimmed.startsWith("/")) {
    return `https://pocketbase.io${trimmed}`;
  }

  return trimmed;
}

function normalizeDocsImageHref(href: string): string {
  const trimmed = href.trim();
  if (!trimmed) {
    return "";
  }

  if (trimmed.startsWith("/images/screenshots/")) {
    const filename = pathPosix.basename(trimmed);
    return `./assets/upstream/screenshots/${filename}`;
  }

  return normalizeUpstreamHref(trimmed);
}

function normalizeSpacing(text: string): string {
  const out: string[] = [];
  let blankRun = 0;
  let inCodeBlock = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/[\t ]+$/g, "");
    const trimmedLine = line.trim();

    if (trimmedLine.startsWith("```")) {
      blankRun = 0;
      out.push(trimmedLine);
      inCodeBlock = !inCodeBlock;
      continue;
    }

    if (inCodeBlock) {
      out.push(line);
      continue;
    }

    if (!trimmedLine) {
      blankRun += 1;
      if (blankRun <= 1) {
        out.push("");
      }
      continue;
    }

    blankRun = 0;
    out.push(trimmedLine);
  }

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function toAnchor(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[*_]/g, "")
    .trim();
}

function buildTieredQuickLinksFromMarkdown(markdown: string): string[] {
  const links: string[] = [];
  let inCodeBlock = false;
  let hasParent = false;

  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (line.startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) {
      continue;
    }

    const match = line.match(/^(#{3,4})\s+(.+)$/);
    if (!match) {
      continue;
    }

    const level = match[1].length;
    const label = stripInlineMarkdown(match[2]).replace(/\s+#+$/, "").trim();
    if (!label) {
      continue;
    }

    if (level === 3) {
      links.push(`- [${label}](#${toAnchor(label)})`);
      hasParent = true;
      continue;
    }

    if (level === 4 && hasParent) {
      links.push(`  - [${label}](#${toAnchor(label)})`);
    }
  }

  return links;
}

function canonicalizeUpstreamDocsPath(href: string): string | null {
  const trimmed = href.trim();
  if (!trimmed) {
    return null;
  }

  let path = "";

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    let url: URL;
    try {
      url = new URL(trimmed);
    } catch {
      return null;
    }

    if (url.hostname !== "pocketbase.io" || !url.pathname.startsWith("/docs")) {
      return null;
    }

    path = url.pathname;
  } else if (trimmed.startsWith("/docs")) {
    path = trimmed;
  } else {
    return null;
  }

  path = path.split("#")[0] ?? path;
  path = path.split("?")[0] ?? path;
  path = path.replace(/\/+$/, "");

  if (path === "") {
    return null;
  }

  return path === "/docs" ? path : path;
}

function extractHrefHash(href: string): string | null {
  const trimmed = href.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const url = new URL(trimmed);
      return url.hash ? url.hash.slice(1) : null;
    } catch {
      return null;
    }
  }

  const hashIndex = trimmed.indexOf("#");
  if (hashIndex < 0 || hashIndex === trimmed.length - 1) {
    return null;
  }
  return trimmed.slice(hashIndex + 1);
}

function rewriteUpstreamDocsLink(
  href: string,
  currentOutputPath: string,
  linkTargets: Map<string, DocsLinkTarget>,
): string | null {
  const docsPath = canonicalizeUpstreamDocsPath(href);
  if (!docsPath) {
    return null;
  }

  const target = linkTargets.get(docsPath);
  if (!target) {
    return null;
  }

  const explicitHash = extractHrefHash(href);
  const anchor = explicitHash || target.anchor;
  const samePage = pathPosix.basename(target.outputPath) === pathPosix.basename(currentOutputPath);

  if (samePage) {
    return anchor ? `#${anchor}` : "./";
  }

  return anchor
    ? `./${pathPosix.basename(target.outputPath)}#${anchor}`
    : `./${pathPosix.basename(target.outputPath)}`;
}

function rewriteUpstreamDocsLinksInMarkdown(
  markdown: string,
  currentOutputPath: string,
  linkTargets: Map<string, DocsLinkTarget>,
): string {
  let out = markdown.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (full, label, href) => {
    const rewritten = rewriteUpstreamDocsLink(href, currentOutputPath, linkTargets);
    if (!rewritten) {
      return full;
    }
    return `[${label}](${rewritten})`;
  });

  out = out.replace(/<((?:https?:\/\/)?pocketbase\.io\/docs\/[^>\s]+)>/g, (full, href) => {
    const rewritten = rewriteUpstreamDocsLink(href, currentOutputPath, linkTargets);
    if (!rewritten) {
      return full;
    }
    return `<${rewritten}>`;
  });

  out = out.replace(/https?:\/\/pocketbase\.io\/docs\/[A-Za-z0-9\-._~:/?#\[\]@!$&'()*+,;=%]*/g, (href) => {
    const rewritten = rewriteUpstreamDocsLink(href, currentOutputPath, linkTargets);
    return rewritten ?? href;
  });

  return out;
}

function rewriteAttributionLink(markdown: string, upstreamUrl: string): string {
  return markdown.replace(
    /This page is adapted from \[PocketBase docs\]\([^)]+\)\./g,
    `This page is adapted from [PocketBase docs](${upstreamUrl}).`,
  );
}

function extractResponseExamples(scriptContent: string): Array<{ code: string; body: string }> {
  const out: Array<{ code: string; body: string }> = [];
  const seen = new Set<string>();

  for (const match of scriptContent.matchAll(/code:\s*([0-9]+)[\s\S]*?body:\s*`([\s\S]*?)`/g)) {
    const code = match[1].trim();
    const body = match[2].trim();
    const key = `${code}:${body}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push({ code, body });
    }
  }

  for (const match of scriptContent.matchAll(/code:\s*([0-9]+)[\s\S]*?body:\s*"([^"]*)"/g)) {
    const code = match[1].trim();
    const body = match[2].trim();
    const key = `${code}:${body}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push({ code, body });
    }
  }

  return out;
}

function responseExamplesMarkdown(examples: Array<{ code: string; body: string }>): string {
  if (examples.length === 0) {
    return "";
  }

  const lines: string[] = ["### Response examples", ""];

  for (const example of examples) {
    lines.push(`#### ${example.code}`);
    lines.push("");
    const asJson = example.body.startsWith("{") || example.body.startsWith("[");
    const lang = asJson ? "json" : "text";
    lines.push(`\`\`\`${lang}`);
    lines.push(example.body);
    lines.push("```");
    lines.push("");
  }

  return lines.join("\n").trim();
}

function fieldsQueryParamRow(prefix = ""): string {
  const normalizedPrefix = prefix.trim();
  const expandExample = normalizedPrefix ? `${normalizedPrefix}expand.relField.name` : "expand.relField.name";
  const excerptExample = normalizedPrefix ? `${normalizedPrefix}description:excerpt(200,true)` : "description:excerpt(200,true)";

  return [
    "<tr>",
    '  <td id="query-page">fields</td>',
    "  <td><span class=\"label\">String</span></td>",
    "  <td>",
    "    <p>Comma separated string of the fields to return in the JSON response <em>(by default returns all fields)</em>. Ex.: <code>?fields=*," +
      expandExample +
      "</code></p>",
    "    <p><code>*</code> targets all keys from the specific depth level.</p>",
    "    <p>In addition, the following field modifiers are also supported:</p>",
    "    <ul>",
    "      <li><code>:excerpt(maxLength, withEllipsis?)</code><br />Returns a short plain text version of the field string value.<br />Ex.: <code>?fields=*," +
      excerptExample +
      "</code></li>",
    "    </ul>",
    "  </td>",
    "</tr>",
  ].join("\n");
}

function expandQueryParamRow(): string {
  return [
    "<tr>",
    "  <td>expand</td>",
    "  <td><span class=\"label\">String</span></td>",
    "  <td>",
    "    Auto expand record relations. Ex.: <code>?expand=relField1,relField2.subRelField</code><br />",
    "    Supports up to 6-levels depth nested relations expansion.<br />",
    "    The expanded relations will be appended to the record under the <code>expand</code> property ",
    '    (e.g. <code>"expand": object with relation payload</code>).<br />',
    "    Only the relations to which the request user has permissions to <strong>view</strong> will be expanded.",
    "  </td>",
    "</tr>",
  ].join("\n");
}

function skipTotalQueryParamRow(): string {
  return [
    "<tr>",
    '  <td id="query-page">skipTotal</td>',
    "  <td><span class=\"label\">Boolean</span></td>",
    "  <td>",
    "    If it is set the total counts query will be skipped and the response fields <code>totalItems</code> and",
    "    <code>totalPages</code> will have <code>-1</code> value.<br />",
    "    This could drastically speed up the search queries when the total counters are not needed or cursor based",
    "    pagination is used.<br />",
    "    For optimization purposes, it is set by default for the <code>getFirstListItem()</code> and",
    "    <code>getFullList()</code> SDK methods.",
    "  </td>",
    "</tr>",
  ].join("\n");
}

function filterSyntaxMarkdown(): string {
  return [
    "Filter syntax reference:",
    "",
    "- Format: `OPERAND OPERATOR OPERAND`.",
    "- `OPERAND` can be a field literal, string (single or double quoted), number, `null`, `true`, or `false`.",
    "- Operators:",
    "  - `=` equal",
    "  - `!=` not equal",
    "  - `>` greater than",
    "  - `>=` greater than or equal",
    "  - `&lt;` less than",
    "  - `&lt;=` less than or equal",
    "  - `~` like/contains",
    "  - `!~` not like/contains",
    "  - `?=`, `?!=`, `?>`, `?>=`, `?&lt;`, `?&lt;=`, `?~`, `?!~` are any/at-least-one variants",
    "- Use `(...)`, `&&`, and `||` to group/combine expressions.",
    "- Single line comments are supported: `// comment`.",
    "- For multi-record fields, operators are match-all by default; prefix the operator with `?` for any/at-least-one.",
    "",
  ].join("\n");
}

function thumbFormatsMarkdown(): string {
  return [
    "Supported thumb formats:",
    "",
    "- `WxH` (e.g. `100x300`) crop to `WxH` from center",
    "- `WxHt` (e.g. `100x300t`) crop to `WxH` from top",
    "- `WxHb` (e.g. `100x300b`) crop to `WxH` from bottom",
    "- `WxHf` (e.g. `100x300f`) fit inside `WxH` without cropping",
    "- `0xH` (e.g. `0x300`) resize to height while preserving aspect ratio",
    "- `Wx0` (e.g. `100x0`) resize to width while preserving aspect ratio",
    "",
  ].join("\n");
}

function stripSvelteArtifacts(text: string): string {
  return text
    .replace(/^.*responseTab.*$/gm, "")
    .replace(/^.*activeApiTab.*$/gm, "")
    .replace(/^\s*\([^)]*Tab\s*=\s*[^)]*\)\s*\}\s*>?\s*$/gm, "")
    .replace(/^\s*\)\}\s*>?\s*$/gm, "")
    .replace(/^\s*>\s*$/gm, "")
    .replace(/\nResponses\s*\n(?:>\s*\n)+/g, "\nResponses\n");
}

function dedentCodeBlock(raw: string): string {
  let lines = raw.replace(/\r\n?/g, "\n").split("\n");

  while (lines.length > 0 && !lines[0].trim()) {
    lines.shift();
  }
  while (lines.length > 0 && !lines[lines.length - 1]?.trim()) {
    lines.pop();
  }
  if (lines.length === 0) {
    return "";
  }

  let minIndent = Number.POSITIVE_INFINITY;
  for (const line of lines) {
    if (!line.trim()) {
      continue;
    }
    const indent = line.match(/^[\t ]*/)?.[0].length ?? 0;
    minIndent = Math.min(minIndent, indent);
  }

  if (Number.isFinite(minIndent) && minIndent > 0) {
    const dedentPattern = new RegExp(`^[\\t ]{0,${minIndent}}`);
    lines = lines.map((line) => line.replace(dedentPattern, ""));
  }

  return lines.join("\n").replace(/[ \t]+$/gm, "").trim();
}

function parseCodeBlockContent(attrs: string): string {
  const inline = attrs.match(/content=\{`([\s\S]*?)`\}/);
  if (inline) {
    return dedentCodeBlock(inline[1]);
  }

  const simple = attrs.match(/content="([^"]*)"/);
  if (simple) {
    return dedentCodeBlock(simple[1]);
  }

  const chunks = [...attrs.matchAll(/`([\s\S]*?)`/g)].map((m) => dedentCodeBlock(m[1]));
  return chunks.join("\n").trim();
}

function convertInlineHtml(raw: string): string {
  let text = raw;

  text = text.replace(/<CodeBlock([\s\S]*?)\/>/g, (_full, attrs) => {
    const code = parseCodeBlockContent(attrs);
    if (!code) {
      return "";
    }
    return `<code>${code}</code>`;
  });

  text = text.replace(/<a([^>]*)>([\s\S]*?)<\/a>/g, (_full, attrs, inner) => {
    const href = normalizeUpstreamHref(extractAttr(attrs, "href") ?? "");
    const label = convertInlineHtml(inner)
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .trim();
    if (!href) {
      return label;
    }
    return `[${label}](${href})`;
  });

  text = text.replace(/<br\s*\/?>/gi, "<br>");
  text = text.replace(/<\/p>\s*<p[^>]*>/gi, "<br><br>");
  text = text.replace(/<p[^>]*>/gi, "");
  text = text.replace(/<\/p>/gi, "");
  text = text.replace(/<span[^>]*>/gi, "");
  text = text.replace(/<\/span>/gi, "");
  text = text.replace(/<div[^>]*>/gi, "");
  text = text.replace(/<\/div>/gi, "");
  text = text.replace(/<code[^>]*>/gi, "`");
  text = text.replace(/<\/code>/gi, "`");
  text = text.replace(/<strong[^>]*>/gi, "**");
  text = text.replace(/<\/strong>/gi, "**");
  text = text.replace(/<em[^>]*>/gi, "*");
  text = text.replace(/<\/em>/gi, "*");
  text = text.replace(/\{`([^`]*)`\}/g, "$1");
  text = text.replace(/\{["']([^"']+)["']\}/g, "$1");
  text = text.replace(/\{[^}]+\}/g, "");
  text = text.replace(/<[^>]+>/g, "");

  text = decodeHtmlEntities(text);
  text = text.replace(/\s*<br>\s*/g, "<br>");
  text = text.replace(/(<br>){2,}/g, "<br>");
  text = text.replace(/[\r\n]+/g, " ");
  text = text.replace(/[\t ]+/g, " ");
  text = text.trim();
  text = text.replace(/\|/g, "\\|");

  return text;
}

function htmlToInlineMarkdown(raw: string): string {
  let text = raw;
  text = text.replace(/<ul[^>]*>/gi, "");
  text = text.replace(/<\/ul>/gi, "");
  text = text.replace(/<li[^>]*>/gi, "- ");
  text = text.replace(/<\/li>/gi, "<br>");
  return convertInlineHtml(text);
}

function tableToMarkdown(tableHtml: string): string {
  const parsedRows: Array<{ cells: string[]; header: boolean }> = [];

  for (const rowMatch of tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const rowBody = rowMatch[1];
    const cells: string[] = [];
    let header = true;

    for (const cellMatch of rowBody.matchAll(/<(th|td)[^>]*>([\s\S]*?)<\/\1>/gi)) {
      const kind = cellMatch[1].toLowerCase();
      if (kind !== "th") {
        header = false;
      }
      const cell = htmlToInlineMarkdown(cellMatch[2]) || "-";
      cells.push(cell);
    }

    if (cells.length > 0) {
      parsedRows.push({ cells, header });
    }
  }

  if (parsedRows.length === 0) {
    return "";
  }

  const headerIndex = parsedRows.findIndex((row) => row.header);
  const headerCells =
    headerIndex >= 0 ? parsedRows[headerIndex].cells : parsedRows[0].cells.map((_v, i) => `Column ${i + 1}`);
  const colCount = Math.max(headerCells.length, ...parsedRows.map((row) => row.cells.length));

  const normalizeRow = (cells: string[]): string[] => {
    const out = [...cells];
    while (out.length < colCount) {
      out.push("-");
    }
    return out.map((cell) => (cell.trim() ? cell : "-"));
  };

  const lines: string[] = [];
  lines.push(`| ${normalizeRow(headerCells).join(" | ")} |`);
  lines.push(`| ${Array(colCount).fill("---").join(" | ")} |`);

  parsedRows.forEach((row, idx) => {
    if (idx === headerIndex) {
      return;
    }
    lines.push(`| ${normalizeRow(row.cells).join(" | ")} |`);
  });

  return lines.join("\n");
}

function convertJsHelper(content: string): string {
  const titles = dedupe([...content.matchAll(/title:\s*"([^"]+)"/g)].map((m) => m[1]));
  const hooks = dedupe([...content.matchAll(/On[A-Z][A-Za-z0-9]+/g)].map((m) => m[0]));

  const parts: string[] = [];

  if (titles.length > 0) {
    parts.push("Detected hook groups from helper source:");
    parts.push(...titles.map((title) => `- ${title}`));
    parts.push("");
  }

  if (hooks.length > 0) {
    parts.push("Detected hook names from helper source:");
    parts.push(...hooks.map((hook) => `- \`${hook}\``));
  }

  return parts.join("\n").trim();
}

function convertSvelte(content: string): string {
  const stashed: string[] = [];
  const stash = (value: string): string => {
    const token = `@@DOC_STASH_${stashed.length}@@`;
    stashed.push(value.trimEnd());
    return `\n${token}\n`;
  };

  const scriptContent = [...content.matchAll(/<script[\s\S]*?<\/script>/g)]
    .map((match) => match[0])
    .join("\n");
  const responses = extractResponseExamples(scriptContent);

  let text = content;

  text = text.replace(/<CodeTabs([\s\S]*?)\/>/g, (_full, attrs) => {
    const chunks: string[] = [];

    const jsMatch = attrs.match(/\bjs=\{`([\s\S]*?)`\}/);
    if (jsMatch) {
      chunks.push(`\`\`\`js\n${jsMatch[1].trim()}\n\`\`\``);
    }

    if (chunks.length === 0) {
      return "";
    }

    return stash(chunks.join("\n\n"));
  });

  text = text.replace(/<div class="api-route[^"]*"[^>]*>\s*<strong[^>]*>([\s\S]*?)<\/strong>\s*<div[^>]*>([\s\S]*?)<\/div>\s*<\/div>/g, (_full, method, path) => {
    const normalizedMethod = htmlToInlineMarkdown(method).replace(/\s+/g, " ").trim();
    const normalizedPath = htmlToInlineMarkdown(path).replace(/\s+/g, " ").trim();
    if (!normalizedMethod && !normalizedPath) {
      return "";
    }
    return stash(`\`${[normalizedMethod, normalizedPath].filter(Boolean).join(" ")}\``);
  });

  text = text.replace(/<FieldsQueryParam([^>]*)\/>/g, (_full, attrs) => {
    const prefix = extractAttr(attrs, "prefix") ?? "";
    return `\n${fieldsQueryParamRow(prefix)}\n`;
  });
  text = text.replace(/<ExpandQueryParam[^>]*\/>/g, `\n${expandQueryParamRow()}\n`);
  text = text.replace(/<SkipTotalQueryParam[^>]*\/>/g, `\n${skipTotalQueryParamRow()}\n`);
  text = text.replace(/<FilterSyntax[^>]*\/>/g, `\n${filterSyntaxMarkdown()}\n`);
  text = text.replace(/<ThumbFormats[^>]*\/>/g, `\n${thumbFormatsMarkdown()}\n`);

  text = text.replace(/<table[^>]*>[\s\S]*?<\/table>/g, (tableHtml) => {
    const convertedTable = tableToMarkdown(tableHtml);
    if (!convertedTable) {
      return "";
    }
    return stash(convertedTable);
  });

  text = text.replace(/<CodeBlock([\s\S]*?)\/>/g, (_full, attrs) => {
    const lang = normalizeCodeFenceLanguage(extractAttr(attrs, "language"));
    let code = parseCodeBlockContent(attrs);

    code = code
      .replace(/^\s*\+\s*$/gm, "")
      .replace(/^\s*\(import\.meta\.env[\s\S]*?\)\s*$/gm, "")
      .trim();

    if (!code) {
      return "";
    }

    return stash(`\`\`\`${lang}\n${code}\n\`\`\``);
  });

  text = text.replace(/<script[\s\S]*?<\/script>/g, "\n");
  text = text.replace(/<img([\s\S]*?)\/?>/gi, (_full, attrs) => {
    const src = normalizeDocsImageHref(extractAttr(attrs, "src") ?? "");
    if (!src) {
      return "";
    }

    const alt = decodeHtmlEntities(extractAttr(attrs, "alt") ?? "Screenshot").trim() || "Screenshot";
    return stash(`![${alt}](${src})`);
  });

  text = text.replace(/<p[^>]*>([\s\S]*?)<\/p>/g, (_full, inner) => {
    const paragraph = convertInlineHtml(inner);
    if (!paragraph) {
      return "\n";
    }
    return `\n${paragraph}\n`;
  });

  text = text.replace(/<a([^>]*)>([\s\S]*?)<\/a>/g, (_full, attrs, inner) => {
    const href = normalizeUpstreamHref(extractAttr(attrs, "href") ?? "");
    const label = convertInlineHtml(inner)
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .trim();
    if (!href) {
      return label;
    }
    return `[${label}](${href})`;
  });

  text = text.replace(/<HeadingLink([^>]*)\/>/g, (_full, attrs) => {
    const title = extractAttr(attrs, "title");
    if (!title) {
      return "";
    }

    const tag = extractAttr(attrs, "tag") ?? "h3";
    const marker = tag === "h5" ? "####" : tag === "h4" ? "###" : "###";
    return `\n${marker} ${title}\n`;
  });

  text = text.replace(/<Accordion([^>]*)>/g, (_full, attrs) => {
    const title = extractAttr(attrs, "title");
    if (title) {
      return `\n### ${title}\n`;
    }
    return "\n### Details\n";
  });
  text = text.replace(/<\/Accordion>/g, "\n");

  text = text.replace(/<Toc[^>]*\/>/g, "\n");

  text = text.replace(/\{#each[^}]*\}/g, "\n");
  text = text.replace(/\{\/each\}/g, "\n");
  text = text.replace(/\{#if[^}]*\}/g, "\n");
  text = text.replace(/\{\/if\}/g, "\n");
  text = text.replace(/\{:else\}/g, "\n");
  text = text.replace(/\{@html[^}]*\}/g, "\n");
  text = text.replace(/\{`([^`]*)`\}/g, "$1");
  text = text.replace(/\{["']([^"']+)["']\}/g, "$1");

  text = text.replace(/<br\s*\/?>/g, "\n");
  text = text.replace(/<li[^>]*>/g, "\n- ");
  text = text.replace(/<\/li>/g, "\n");
  text = text.replace(/<p[^>]*>/g, "\n");
  text = text.replace(/<\/p>/g, "\n");
  text = text.replace(/<ul[^>]*>/g, "\n");
  text = text.replace(/<\/ul>/g, "\n");
  text = text.replace(/<ol[^>]*>/g, "\n");
  text = text.replace(/<\/ol>/g, "\n");
  text = text.replace(/<code[^>]*>/g, "`");
  text = text.replace(/<\/code>/g, "`");
  text = text.replace(/<strong[^>]*>/g, "**");
  text = text.replace(/<\/strong>/g, "**");
  text = text.replace(/<em[^>]*>/g, "*");
  text = text.replace(/<\/em>/g, "*");

  text = text.replace(/<[^>]+>/g, "\n");
  text = text.replace(/\{[^}]+\}/g, "");
  text = text.replace(/^Upstream source:.*$/gim, "");
  text = text.replace(/^Source Fragment:.*$/gim, "");
  text = text.replace(/^### Source Fragment:.*$/gim, "");
  text = stripSvelteArtifacts(text);
  text = decodeHtmlEntities(text);
  text = text.replace(/^Upstream source:.*$/gim, "");
  text = text.replace(/^Source Fragment:.*$/gim, "");
  text = text.replace(/^### Source Fragment:.*$/gim, "");
  text = stripSvelteArtifacts(text);
  text = normalizeSpacing(text);

  for (let i = stashed.length - 1; i >= 0; i--) {
    text = text.replaceAll(`@@DOC_STASH_${i}@@`, stashed[i]);
  }

  const responseText = responseExamplesMarkdown(responses);
  if (responseText) {
    text = `${text}\n\n${responseText}`;
  }

  // PocketBun docs intentionally omit Dart SDK examples.
  text = text.replace(/\n```dart[\s\S]*?```\n?/gi, "\n");
  text = normalizeSpacing(text);

  return text.trim();
}

function convertFile(relPath: string, content: string): string {
  if (relPath.endsWith(".js")) {
    return convertJsHelper(content);
  }
  if (relPath.endsWith(".svelte")) {
    return convertSvelte(content);
  }
  return "";
}

function routeEntryFile(route: RouteItem): string {
  if (!route.slug) {
    return "+page.svelte";
  }
  return `${route.slug}/+page.svelte`;
}

function cleanSection(text: string): string {
  return text.replace(/\n{3,}/g, "\n\n").trim();
}

function parseJsDocCommentToMarkdown(raw: string): string {
  const normalized: string[] = [];
  const lines = raw
    .replace(/^\/\*\*\s*/, "")
    .replace(/\s*\*\/$/, "")
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*\*\s?/, ""));

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("@group ") || trimmed.startsWith("@namespace")) {
      continue;
    }
    if (trimmed.startsWith("@deprecated")) {
      normalized.push("Deprecated.");
      continue;
    }
    if (trimmed.startsWith("@")) {
      continue;
    }
    normalized.push(line);
  }

  return normalizeSpacing(normalized.join("\n"));
}

function parseReferenceDeclarationName(line: string): string | null {
  const patterns = [
    /^declare function\s+([A-Za-z0-9_$]+)/,
    /^declare class\s+([A-Za-z0-9_$]+)/,
    /^declare namespace\s+([A-Za-z0-9_$]+)/,
    /^declare (?:var|const)\s+([A-Za-z0-9_$]+)/,
  ];

  for (const pattern of patterns) {
    const match = line.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}

function parseReferenceDeclarationKind(line: string): ReferenceKind | null {
  if (line.startsWith("declare function ")) {
    return "functions";
  }
  if (line.startsWith("declare class ")) {
    return "classes";
  }
  if (line.startsWith("declare namespace ")) {
    return "namespaces";
  }
  if (line.startsWith("declare var ") || line.startsWith("declare const ")) {
    return "variables";
  }
  return null;
}

function readReferenceDeclaration(
  lines: string[],
  startIndex: number,
  kind: ReferenceKind,
): { declaration: string; endIndex: number } {
  let braceBalance = 0;
  let parenBalance = 0;
  let sawOpenBrace = false;
  let endIndex = startIndex;

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    const open = (line.match(/\{/g) ?? []).length;
    const close = (line.match(/\}/g) ?? []).length;
    const openParen = (line.match(/\(/g) ?? []).length;
    const closeParen = (line.match(/\)/g) ?? []).length;
    braceBalance += open - close;
    parenBalance += openParen - closeParen;
    if (open > 0) {
      sawOpenBrace = true;
    }

    endIndex = i;

    const trimmed = line.trim();

    if (kind === "functions") {
      if (trimmed.endsWith(";") && parenBalance <= 0 && braceBalance <= 0) {
        break;
      }
      continue;
    }

    if (kind === "classes" || kind === "namespaces") {
      if (sawOpenBrace && braceBalance <= 0) {
        break;
      }
      continue;
    }

    if (kind === "variables") {
      if (sawOpenBrace) {
        if (braceBalance <= 0) {
          break;
        }
      } else if (trimmed.endsWith(";")) {
        break;
      }
    }
  }

  const declaration = lines.slice(startIndex, endIndex + 1).join("\n").trim();
  return { declaration, endIndex };
}

function parseReferenceEntries(typesContent: string): ReferenceEntry[] {
  const lines = typesContent.split(/\r?\n/);
  const entries: ReferenceEntry[] = [];

  let lastJsDoc: string | null = null;
  let lastJsDocEnd = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.startsWith("/**")) {
      const start = i;
      let end = i;
      while (end < lines.length && !lines[end].includes("*/")) {
        end += 1;
      }
      if (end < lines.length) {
        lastJsDoc = lines.slice(start, end + 1).join("\n");
        lastJsDocEnd = end;
        i = end;
      }
      continue;
    }

    if (!line.startsWith("declare ")) {
      continue;
    }

    const kind = parseReferenceDeclarationKind(line);
    const name = parseReferenceDeclarationName(line);
    if (!kind || !name) {
      continue;
    }

    const declarationStart = i;
    const { declaration, endIndex } = readReferenceDeclaration(lines, declarationStart, kind);

    let doc = "";
    if (lastJsDoc && lastJsDocEnd >= 0) {
      let onlyBlankLines = true;
      for (let j = lastJsDocEnd + 1; j < declarationStart; j++) {
        if (lines[j].trim() !== "") {
          onlyBlankLines = false;
          break;
        }
      }
      if (onlyBlankLines) {
        doc = parseJsDocCommentToMarkdown(lastJsDoc);
      }
    }

    entries.push({
      declaration,
      doc,
      kind,
      name,
    });

    i = endIndex;
  }

  return entries;
}

function referenceKindTitle(kind: ReferenceKind): string {
  switch (kind) {
    case "variables":
      return "Variables";
    case "functions":
      return "Functions";
    case "classes":
      return "Classes";
    case "namespaces":
      return "Namespaces";
  }
}

function buildReferencePage(args: {
  outputPath: string;
  permalink?: string;
  linkTargets: Map<string, DocsLinkTarget>;
}): void {
  const { outputPath, permalink, linkTargets } = args;

  if (!existsSync(JSVM_TYPES_PATH)) {
    throw new Error(`Missing JSVM types source: ${JSVM_TYPES_PATH}`);
  }

  const typesContent = readFileSync(JSVM_TYPES_PATH, "utf8");
  const entries = parseReferenceEntries(typesContent);

  const grouped = new Map<ReferenceKind, ReferenceEntry[]>();
  for (const entry of entries) {
    const list = grouped.get(entry.kind) ?? [];
    list.push(entry);
    grouped.set(entry.kind, list);
  }

  const orderedKinds: ReferenceKind[] = ["variables", "functions", "classes", "namespaces"];
  const presentKinds = orderedKinds.filter((kind) => (grouped.get(kind)?.length ?? 0) > 0);

  const quickLinks = presentKinds.map((kind) => `- [${referenceKindTitle(kind)}](#${toAnchor(referenceKindTitle(kind))})`);

  const sections: string[] = [];

  for (const [kindIndex, kind] of presentKinds.entries()) {
    const entriesForKind = grouped.get(kind) ?? [];
    if (kindIndex > 0) {
      sections.push("---");
      sections.push("");
    }
    sections.push(`## ${referenceKindTitle(kind)}`);
    sections.push("");
    sections.push(...entriesForKind.map((entry) => `- [\`${entry.name}\`](#${toAnchor(entry.name)})`));
    sections.push("");

    for (const entry of entriesForKind) {
      sections.push("---");
      sections.push("");
      sections.push(`### ${entry.name}`);
      sections.push("");
      if (entry.doc) {
        sections.push(entry.doc);
        sections.push("");
      }
      sections.push("```ts");
      sections.push(entry.declaration);
      sections.push("```");
      sections.push("");
    }
  }

  let body = [
    "---",
    "layout: default",
    "title: Extend PocketBun Reference",
    ...(permalink ? [`permalink: ${permalink}`] : []),
    "---",
    "",
    "# Extend PocketBun Reference",
    "",
    "This page is generated from PocketBun JSVM TypeScript declarations and serves as the API reference for the Extend PocketBun docs.",
    "",
    "Quick links:",
    "",
    ...quickLinks,
    "",
    ...sections,
    "## Attribution",
    "",
    "This page is generated from `src/plugins/jsvm/internal/types/generated/types.d.ts`.",
    "",
  ].join("\n");

  body = rewriteUpstreamDocsLinksInMarkdown(body, outputPath, linkTargets);
  writeFileSync(outputPath, body);
}

function buildPage(args: {
  title: string;
  intro: string;
  routes: RouteBundle[];
  outputPath: string;
  permalink?: string;
  linkTargets: Map<string, DocsLinkTarget>;
  attributionUrl: string;
}): void {
  const { title, intro, routes, outputPath, permalink, linkTargets, attributionUrl } = args;

  const sectionsData = routes.map((bundle) => {
    const files = bundle.files;
    const fileSections: string[] = [];

    for (const relPath of files) {
      const content = fileCache.get(relPath);
      if (!content) {
        continue;
      }

      const converted = convertFile(relPath, content);
      const cleaned = cleanSection(converted);
      if (!cleaned) {
        continue;
      }

      fileSections.push(cleaned);
    }

    // Add a visible separator between fragments that originate from different upstream files.
    const sectionBody = fileSections.join("\n\n---\n\n").trim();

    return {
      routeTitle: bundle.route.title,
      sectionBody,
    };
  });

  const sections = sectionsData.map((section) => {
    return [`## ${section.routeTitle}`, section.sectionBody]
      .filter(Boolean)
      .join("\n\n");
  });

  let quickLinks = routes.map((bundle) => `- [${bundle.route.title}](#${toAnchor(bundle.route.title)})`);
  if (routes.length === 1) {
    const tiered = buildTieredQuickLinksFromMarkdown(sectionsData[0]?.sectionBody ?? "");
    if (tiered.length > 0) {
      quickLinks = tiered;
    }
  }

  let body = [
    "---",
    "layout: default",
    `title: ${title}`,
    ...(permalink ? [`permalink: ${permalink}`] : []),
    "---",
    "",
    `# ${title}`,
    "",
    intro,
    "",
    "Quick links:",
    "",
    ...quickLinks,
    "",
    ...sections,
    "",
    "## Attribution",
    "",
    "This page is adapted from [PocketBase docs](https://pocketbase.io/docs/).",
    "",
  ].join("\n");

  body = rewriteUpstreamDocsLinksInMarkdown(body, outputPath, linkTargets);
  body = rewriteAttributionLink(body, attributionUrl);

  writeFileSync(outputPath, body);
}

function buildCategoryRoutes(items: RouteItem[]): RouteBundle[] {
  const bundles: RouteBundle[] = [];

  for (const route of items) {
    const entry = routeEntryFile(route);
    const files = collectRouteFiles(entry);
    bundles.push({ route, files });
  }

  return bundles;
}

function parseOnlyArg(): string | null {
  const idx = Bun.argv.indexOf("--only");
  if (idx === -1) {
    return null;
  }
  return Bun.argv[idx + 1] ?? null;
}

function createDocsLinkTargets(args: {
  introItems: RouteItem[];
  prodItems: RouteItem[];
  apiItems: RouteItem[];
  jsItems: RouteItem[];
}): Map<string, DocsLinkTarget> {
  const targets = new Map<string, DocsLinkTarget>();

  const register = (items: RouteItem[], outputPath: string): void => {
    for (const item of items) {
      const path = canonicalizeUpstreamDocsPath(item.href);
      if (!path) {
        continue;
      }
      targets.set(path, {
        outputPath,
        anchor: toAnchor(item.title),
      });
    }
  };

  register(args.introItems, "docs/users/introduction.md");
  register(args.prodItems, "docs/users/going-to-production.md");
  register(args.apiItems, "docs/users/web-apis.md");
  register(args.jsItems, "docs/users/extend.md");

  // Prefer linking to the top of the merged introduction page for /docs root.
  targets.set("/docs", {
    outputPath: "docs/users/introduction.md",
    anchor: null,
  });

  return targets;
}

function syncScreenshotAssetsFromCache(): number {
  if (!existsSync(UPSTREAM_SCREENSHOTS_DIR)) {
    throw new Error(
      `Missing upstream screenshots cache at ${UPSTREAM_SCREENSHOTS_DIR}. Run: bash scripts/docs/sync_upstream_site_docs.sh`,
    );
  }

  rmSync(LOCAL_SCREENSHOTS_DIR, { recursive: true, force: true });
  mkdirSync(LOCAL_SCREENSHOTS_DIR, { recursive: true });

  let copied = 0;
  const entries = readdirSync(UPSTREAM_SCREENSHOTS_DIR, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }

    if (!/\.(png|jpg|jpeg|webp|gif|svg)$/i.test(entry.name)) {
      continue;
    }

    const srcPath = pathPosix.join(UPSTREAM_SCREENSHOTS_DIR, entry.name);
    const destPath = pathPosix.join(LOCAL_SCREENSHOTS_DIR, entry.name);
    copyFileSync(srcPath, destPath);
    copied += 1;
  }

  return copied;
}

function main(): void {
  if (!existsSync(CACHE_ROOT)) {
    throw new Error(
      `Missing upstream docs cache at ${CACHE_ROOT}. Run: bash scripts/docs/sync_upstream_site_docs.sh`,
    );
  }

  mkdirSync("docs", { recursive: true });
  mkdirSync("docs/users", { recursive: true });
  mkdirSync("docs/maintainers", { recursive: true });

  const docLinks = readCachedFile("doc_links.js");

  const introItems = normalizeRouteItems(parseRouteItemsFromBlock(extractArrayBlock(docLinks, "introductionLinks")));
  const prodItems = normalizeRouteItems(parseRouteItemsFromBlock(extractArrayBlock(docLinks, "goingToProductionLinks")));
  const apiItems = normalizeRouteItems(parseRouteItemsFromBlock(extractArrayBlock(docLinks, "webApiLinks")));
  const jsItems = normalizeRouteItems(
    parseRouteItemsFromBlock(extractArrayBlock(docLinks, "jsLinks")).filter((item) => item.href.startsWith("/docs/")),
  );
  const docsLinkTargets = createDocsLinkTargets({
    introItems,
    prodItems,
    apiItems,
    jsItems,
  });

  const targets = new Set([
    "introduction",
    "going-to-production",
    "web-apis",
    "extend",
    "extend-with-javascript",
    "reference",
  ]);
  const only = parseOnlyArg();
  if (only && !targets.has(only)) {
    throw new Error(`Unsupported --only value '${only}'. Expected one of: ${[...targets].join(", ")}`);
  }

  let introBundles: RouteBundle[] = [];
  let prodBundles: RouteBundle[] = [];
  let apiBundles: RouteBundle[] = [];
  let jsBundles: RouteBundle[] = [];

  if (!only || only === "introduction") {
    introBundles = buildCategoryRoutes(introItems);
    buildPage({
      title: "PocketBun Introduction",
      intro: "This page merges the upstream PocketBase Introduction section and its child pages.",
      routes: introBundles,
      outputPath: "docs/users/introduction.md",
      permalink: "/introduction.html",
      linkTargets: docsLinkTargets,
      attributionUrl: "https://pocketbase.io/docs/",
    });
  }

  if (!only || only === "going-to-production") {
    prodBundles = buildCategoryRoutes(prodItems);
    buildPage({
      title: "PocketBun Going To Production",
      intro: "This page merges the upstream PocketBase Going to production section.",
      routes: prodBundles,
      outputPath: "docs/users/going-to-production.md",
      permalink: "/going-to-production.html",
      linkTargets: docsLinkTargets,
      attributionUrl: "https://pocketbase.io/docs/going-to-production/",
    });
  }

  if (!only || only === "web-apis") {
    apiBundles = buildCategoryRoutes(apiItems);
    buildPage({
      title: "PocketBun Web APIs Reference",
      intro: "This page merges upstream PocketBase Web APIs reference pages.",
      routes: apiBundles,
      outputPath: "docs/users/web-apis.md",
      permalink: "/web-apis.html",
      linkTargets: docsLinkTargets,
      attributionUrl: "https://pocketbase.io/docs/api-records/",
    });
  }

  if (!only || only === "extend" || only === "extend-with-javascript") {
    jsBundles = buildCategoryRoutes(jsItems);
    buildPage({
      title: "Extend PocketBun",
      intro:
        "This page merges upstream PocketBase JavaScript extension pages. For complete API bindings reference, see [Extend PocketBun Reference](./reference.md).",
      routes: jsBundles,
      outputPath: "docs/users/extend.md",
      permalink: "/extend.html",
      linkTargets: docsLinkTargets,
      attributionUrl: "https://pocketbase.io/docs/js-overview/",
    });
  }

  if (!only || only === "reference") {
    buildReferencePage({
      outputPath: "docs/users/reference.md",
      permalink: "/reference.html",
      linkTargets: docsLinkTargets,
    });
  }

  const manifest: Record<string, unknown> = {
    generatedAt: new Date().toISOString(),
    upstreamRepo: "pocketbase/site",
    upstreamRef: "master",
    cacheRoot: CACHE_ROOT,
    only: only ?? null,
    categories: {},
  };

  if (introBundles.length > 0) {
    (manifest.categories as Record<string, unknown>).introduction = introBundles;
  }
  if (prodBundles.length > 0) {
    (manifest.categories as Record<string, unknown>).goingToProduction = prodBundles;
  }
  if (apiBundles.length > 0) {
    (manifest.categories as Record<string, unknown>).webApis = apiBundles;
  }
  if (jsBundles.length > 0) {
    (manifest.categories as Record<string, unknown>).javascript = jsBundles;
  }
  if (!only || only === "reference") {
    (manifest.categories as Record<string, unknown>).reference = {
      source: JSVM_TYPES_PATH,
      outputPath: "docs/users/reference.md",
    };
  }

  writeFileSync("docs/maintainers/upstream-docs-manifest.json", JSON.stringify(manifest, null, 2) + "\n");

  const copiedScreenshots = syncScreenshotAssetsFromCache();

  console.log("Rebuilt docs pages from cached upstream sources.");
  if (introBundles.length > 0) {
    console.log(`Introduction routes: ${introBundles.length}`);
  }
  if (prodBundles.length > 0) {
    console.log(`Production routes: ${prodBundles.length}`);
  }
  if (apiBundles.length > 0) {
    console.log(`Web API routes: ${apiBundles.length}`);
  }
  if (jsBundles.length > 0) {
    console.log(`JS routes: ${jsBundles.length}`);
  }
  if (!only || only === "reference") {
    console.log(`Reference source: ${JSVM_TYPES_PATH}`);
  }
  console.log(`Screenshots copied: ${copiedScreenshots}`);
}

main();
