#!/usr/bin/env bun
// This script exists to deterministically rebuild PocketBun docs from cached upstream PocketBase docs sources.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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

const CACHE_ROOT = ".cache/upstream-site-docs";
const UPSTREAM_DOCS_BASE = "https://pocketbase.io/docs";

const fileCache = new Map<string, string>();

function dedupe<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function slugFromHref(href: string): string {
  if (href === "/docs") {
    return "";
  }
  return href.replace(/^\/docs\//, "").replace(/\/+$/, "");
}

function urlForHref(href: string): string {
  if (href === "/docs") {
    return `${UPSTREAM_DOCS_BASE}/`;
  }
  return `${UPSTREAM_DOCS_BASE}/${slugFromHref(href)}/`;
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

function decodeHtmlEntities(text: string): string {
  return text
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

function normalizeSpacing(text: string): string {
  const out: string[] = [];
  let blankRun = 0;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/[\t ]+$/g, "");

    if (!line.trim()) {
      blankRun += 1;
      if (blankRun <= 1) {
        out.push("");
      }
      continue;
    }

    blankRun = 0;
    out.push(line.trim());
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

  let text = content;

  text = text.replace(/<CodeTabs([\s\S]*?)\/>/g, (_full, attrs) => {
    const chunks: string[] = [];

    const jsMatch = attrs.match(/\bjs=\{`([\s\S]*?)`\}/);
    if (jsMatch) {
      chunks.push(`\`\`\`js\n${jsMatch[1].trim()}\n\`\`\``);
    }

    const dartMatch = attrs.match(/\bdart=\{`([\s\S]*?)`\}/);
    if (dartMatch) {
      chunks.push(`\`\`\`dart\n${dartMatch[1].trim()}\n\`\`\``);
    }

    if (chunks.length === 0) {
      return "";
    }

    return stash(chunks.join("\n\n"));
  });

  text = text.replace(/<CodeBlock([\s\S]*?)\/>/g, (_full, attrs) => {
    const lang = extractAttr(attrs, "language") ?? "text";
    const inline = attrs.match(/content=\{`([\s\S]*?)`\}/);

    let code = "";
    if (inline) {
      code = inline[1].trim();
    } else {
      const chunks = [...attrs.matchAll(/`([\s\S]*?)`/g)].map((m) => m[1].trim());
      code = chunks.join("\n").trim();
    }

    if (!code) {
      return "";
    }

    return stash(`\`\`\`${lang}\n${code}\n\`\`\``);
  });

  text = text.replace(/<script[\s\S]*?<\/script>/g, "\n");

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
  text = text.replace(/<FieldsQueryParam[^>]*\/>/g, "\n- `fields` query parameter\n");
  text = text.replace(/<ExpandQueryParam[^>]*\/>/g, "\n- `expand` query parameter\n");
  text = text.replace(/<ThumbFormats[^>]*\/>/g, "\nSupported thumb formats are based on file field options.\n");

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

  text = decodeHtmlEntities(text);
  text = normalizeSpacing(text);

  for (let i = 0; i < stashed.length; i++) {
    text = text.replaceAll(`@@DOC_STASH_${i}@@`, stashed[i]);
  }

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

function buildPage(args: {
  title: string;
  intro: string;
  routes: RouteBundle[];
  outputPath: string;
}): void {
  const { title, intro, routes, outputPath } = args;

  const quickLinks = routes.map((bundle) => `- [${bundle.route.title}](#${toAnchor(bundle.route.title)})`);

  const sections = routes.map((bundle) => {
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

      if (files.length > 1) {
        fileSections.push(`### Source Fragment: \`${relPath}\`\n\n${cleaned}`);
      } else {
        fileSections.push(cleaned);
      }
    }

    const sectionBody = fileSections.join("\n\n").trim();

    return [
      `## ${bundle.route.title}`,
      `Upstream source: [${bundle.route.href}](${urlForHref(bundle.route.href)})`,
      sectionBody,
    ]
      .filter(Boolean)
      .join("\n\n");
  });

  const body = [
    "---",
    "layout: default",
    `title: ${title}`,
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
    "This page is adapted from PocketBase docs and regenerated from upstream source files in `pocketbase/site`.",
    "",
    "- PocketBase docs: <https://pocketbase.io/docs/>",
    "- PocketBase project by Gani Georgiev: <https://github.com/pocketbase/pocketbase>",
    "- Upstream docs source map: [Upstream Docs Map](./maintainers/upstream-docs-map.md)",
    "",
  ].join("\n");

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

function main(): void {
  if (!existsSync(CACHE_ROOT)) {
    throw new Error(
      `Missing upstream docs cache at ${CACHE_ROOT}. Run: bash scripts/docs/sync_upstream_site_docs.sh`,
    );
  }

  mkdirSync("docs", { recursive: true });
  mkdirSync("docs/maintainers", { recursive: true });

  const docLinks = readCachedFile("doc_links.js");

  const introItems = normalizeRouteItems(parseRouteItemsFromBlock(extractArrayBlock(docLinks, "introductionLinks")));
  const prodItems = normalizeRouteItems(parseRouteItemsFromBlock(extractArrayBlock(docLinks, "goingToProductionLinks")));
  const apiItems = normalizeRouteItems(parseRouteItemsFromBlock(extractArrayBlock(docLinks, "webApiLinks")));
  const jsItems = normalizeRouteItems(
    parseRouteItemsFromBlock(extractArrayBlock(docLinks, "jsLinks")).filter((item) => item.href.startsWith("/docs/")),
  );

  const introBundles = buildCategoryRoutes(introItems);
  const prodBundles = buildCategoryRoutes(prodItems);
  const apiBundles = buildCategoryRoutes(apiItems);
  const jsBundles = buildCategoryRoutes(jsItems);

  buildPage({
    title: "PocketBun Introduction",
    intro: "This page merges the upstream PocketBase Introduction section and its child pages.",
    routes: introBundles,
    outputPath: "docs/introduction.md",
  });

  buildPage({
    title: "PocketBun Going To Production",
    intro: "This page merges the upstream PocketBase Going to production section.",
    routes: prodBundles,
    outputPath: "docs/going-to-production.md",
  });

  buildPage({
    title: "PocketBun Web APIs Reference",
    intro: "This page merges upstream PocketBase Web APIs reference pages.",
    routes: apiBundles,
    outputPath: "docs/web-apis.md",
  });

  buildPage({
    title: "PocketBun Extend With JavaScript",
    intro: "This page merges upstream PocketBase JavaScript extension pages.",
    routes: jsBundles,
    outputPath: "docs/extend-with-javascript.md",
  });

  const manifest = {
    generatedAt: new Date().toISOString(),
    upstreamRepo: "pocketbase/site",
    upstreamRef: "master",
    cacheRoot: CACHE_ROOT,
    categories: {
      introduction: introBundles,
      goingToProduction: prodBundles,
      webApis: apiBundles,
      javascript: jsBundles,
    },
  };

  writeFileSync("docs/maintainers/upstream-docs-manifest.json", JSON.stringify(manifest, null, 2) + "\n");

  console.log("Rebuilt docs pages from cached upstream sources.");
  console.log(`Introduction routes: ${introBundles.length}`);
  console.log(`Production routes: ${prodBundles.length}`);
  console.log(`Web API routes: ${apiBundles.length}`);
  console.log(`JS routes: ${jsBundles.length}`);
}

main();
