#!/usr/bin/env bun
// This script exists to verify generated docs coverage against cached upstream route inventories and critical keywords.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

type RouteItem = { href: string; title: string };

const CACHE_DOC_LINKS = ".cache/upstream-site-docs/doc_links.js";

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

    titleMap.set(href, title);
  }

  return order.map((href) => ({ href, title: titleMap.get(href) ?? href }));
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

function assertIncludes(haystack: string, needle: string, label: string): void {
  if (!haystack.includes(needle)) {
    throw new Error(`Missing '${needle}' in ${label}`);
  }
}

function assertIncludesAny(haystack: string, needles: string[], label: string): void {
  for (const needle of needles) {
    if (haystack.includes(needle)) {
      return;
    }
  }
  throw new Error(`Missing any of [${needles.map((needle) => `'${needle}'`).join(", ")}] in ${label}`);
}

function routeTitleVariants(title: string): string[] {
  const variants = new Set<string>([title]);
  variants.add(title.replace(/\bPocketBase\b/g, "PocketBun"));
  return [...variants];
}

function assertLocalScreenshotLinksExist(docPath: string, content: string): void {
  const localLinkRegex = /!\[[^\]]*?\]\((\.\.\/assets\/upstream\/screenshots\/[^)\s]+)\)/g;
  const linked = new Set<string>();

  for (const match of content.matchAll(localLinkRegex)) {
    const rel = match[1];
    linked.add(rel);
  }

  for (const rel of linked) {
    const filePath = join("docs/users", rel);
    if (!existsSync(filePath)) {
      throw new Error(`Missing screenshot asset '${filePath}' referenced in ${docPath}`);
    }
  }

  if (content.includes("https://pocketbase.io/images/screenshots/")) {
    throw new Error(`Found upstream screenshot hotlink in ${docPath}; expected local ../assets/upstream/screenshots/* links`);
  }
}

function main(): void {
  if (!existsSync(CACHE_DOC_LINKS)) {
    throw new Error(
      `Missing cached upstream doc_links.js at ${CACHE_DOC_LINKS}. Run: bash scripts/docs/sync_upstream_site_docs.sh`,
    );
  }

  const docLinks = readFileSync(CACHE_DOC_LINKS, "utf8");

  const introItems = normalizeRouteItems(parseRouteItemsFromBlock(extractArrayBlock(docLinks, "introductionLinks")));
  const prodItems = normalizeRouteItems(parseRouteItemsFromBlock(extractArrayBlock(docLinks, "goingToProductionLinks")));
  const apiItems = normalizeRouteItems(parseRouteItemsFromBlock(extractArrayBlock(docLinks, "webApiLinks")));
  const jsItems = normalizeRouteItems(
    parseRouteItemsFromBlock(extractArrayBlock(docLinks, "jsLinks")).filter((item) => item.href.startsWith("/docs/")),
  );

  const introDoc = readFileSync("docs/users/introduction.md", "utf8");
  const prodDoc = readFileSync("docs/users/going-to-production.md", "utf8");
  const apiDoc = readFileSync("docs/users/web-apis.md", "utf8");
  const jsDoc = readFileSync("docs/users/extend.md", "utf8");
  const referenceDoc = readFileSync("docs/users/reference.md", "utf8");

  for (const route of introItems) {
    assertIncludesAny(introDoc, routeTitleVariants(route.title), "docs/users/introduction.md");
  }

  for (const route of prodItems) {
    assertIncludesAny(prodDoc, routeTitleVariants(route.title), "docs/users/going-to-production.md");
  }

  for (const route of apiItems) {
    assertIncludesAny(apiDoc, routeTitleVariants(route.title), "docs/users/web-apis.md");
  }

  for (const route of jsItems) {
    assertIncludesAny(jsDoc, routeTitleVariants(route.title), "docs/users/extend.md");
  }

  assertLocalScreenshotLinksExist("docs/users/introduction.md", introDoc);
  assertLocalScreenshotLinksExist("docs/users/going-to-production.md", prodDoc);
  assertLocalScreenshotLinksExist("docs/users/web-apis.md", apiDoc);
  assertLocalScreenshotLinksExist("docs/users/extend.md", jsDoc);

  // Critical explicit checks from recent misses.
  assertIncludes(prodDoc, "ulimit", "docs/users/going-to-production.md");
  assertIncludes(jsDoc, "rootCmd", "docs/users/extend.md");
  assertIncludes(apiDoc, "Health", "docs/users/web-apis.md");
  assertIncludes(referenceDoc, "## Variables", "docs/users/reference.md");
  assertIncludes(referenceDoc, "## Functions", "docs/users/reference.md");
  assertIncludes(referenceDoc, "## Classes", "docs/users/reference.md");
  assertIncludes(referenceDoc, "## Namespaces", "docs/users/reference.md");
  assertIncludes(referenceDoc, "`$app`", "docs/users/reference.md");
  assertIncludes(referenceDoc, "`routerAdd`", "docs/users/reference.md");
  assertIncludes(referenceDoc, "`Collection`", "docs/users/reference.md");

  console.log("Generated docs parity checks passed.");
}

main();
