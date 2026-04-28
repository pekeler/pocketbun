#!/usr/bin/env bun
// This script exists to apply deterministic PocketBun-specific content patches to generated docs.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const TARGET_DOCS = [
  "docs/users/introduction.md",
  "docs/users/going-to-production.md",
  "docs/users/web-apis.md",
  "docs/users/extend.md",
  "docs/users/reference.md",
];
const OVERLAY_ROOT = "scripts/docs/overlays";

const PRESERVE_POCKETBASE_LINE_PATTERNS: RegExp[] = [/upstream PocketBase/i, /adapted from \[PocketBase docs\]/i];

type HeadingSelector = string | string[];

type OverlayOperation =
  | {
      mode: "replace-section";
      heading: HeadingSelector;
      contentPath: string;
    }
  | {
      mode: "upsert-before-heading";
      anchorHeading: HeadingSelector;
      contentPath: string;
    }
  | {
      mode: "upsert-after-section";
      anchorHeading: HeadingSelector;
      contentPath: string;
    }
  | {
      mode: "insert-after-heading-line";
      heading: HeadingSelector;
      contentPath: string;
    };

const DOC_OVERLAYS: Record<string, OverlayOperation[]> = {
  "docs/users/introduction.md": [
    {
      mode: "replace-section",
      heading: "Introduction",
      contentPath: "introduction/introduction-section.md",
    },
    {
      mode: "replace-section",
      heading: "Why not htmx, Hotwire/Turbo, Unpoly, etc.",
      contentPath: "introduction/why-not-htmx.md",
    },
  ],
  "docs/users/extend.md": [
    {
      mode: "replace-section",
      heading: "JavaScript engine",
      contentPath: "extend/javascript-engine.md",
    },
    {
      mode: "replace-section",
      heading: "TypeScript declarations and code completion",
      contentPath: "extend/typescript-declarations.md",
    },
    {
      mode: "replace-section",
      heading: "Loading modules",
      contentPath: "extend/loading-modules.md",
    },
    {
      mode: "replace-section",
      heading: "Performance",
      contentPath: "extend/performance.md",
    },
    {
      mode: "replace-section",
      heading: ["Runtime limitations", "Engine limitations"],
      contentPath: "extend/runtime-limitations.md",
    },
    {
      mode: "insert-after-heading-line",
      heading: "Routing",
      contentPath: "extend/routing-note.md",
    },
    {
      mode: "upsert-after-section",
      anchorHeading: "Registering new routes",
      contentPath: "extend/route-middleware.md",
    },
    {
      mode: "replace-section",
      heading: "Builtin middlewares",
      contentPath: "extend/builtin-middlewares.md",
    },
    {
      mode: "replace-section",
      heading: "Serving static directory",
      contentPath: "extend/serving-static-directory.md",
    },
    {
      mode: "upsert-before-heading",
      anchorHeading: "Executing queries",
      contentPath: "extend/dbx-or-direct-sqlite.md",
    },
  ],
};

function mapOutsideCodeFences(text: string, mapSegment: (segment: string) => string): string {
  const parts = text.split(/(```[\s\S]*?```)/g);
  for (let i = 0; i < parts.length; i += 2) {
    parts[i] = mapSegment(parts[i] ?? "");
  }
  return parts.join("");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeDocument(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd()
    .concat("\n");
}

function normalizeHeadingTitle(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeHeadingSelector(selector: HeadingSelector): string[] {
  const list = Array.isArray(selector) ? selector : [selector];
  return list.map((value) => normalizeHeadingTitle(value));
}

type HeadingRange = {
  lines: string[];
  start: number;
  end: number;
};

function findHeadingRange(text: string, selector: HeadingSelector): HeadingRange | null {
  const needles = new Set(normalizeHeadingSelector(selector));
  const lines = text.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (!match) {
      continue;
    }

    const title = normalizeHeadingTitle(match[2] ?? "");
    if (!needles.has(title)) {
      continue;
    }

    const level = match[1]?.length ?? 0;
    let end = i + 1;
    while (end < lines.length) {
      const next = lines[end] ?? "";
      const nextMatch = next.match(/^(#{1,6})\s+(.+)$/);
      if (nextMatch && (nextMatch[1]?.length ?? 0) <= level) {
        break;
      }
      end += 1;
    }

    return { lines, start: i, end };
  }

  return null;
}

function replaceSectionByHeading(text: string, heading: HeadingSelector, replacement: string): string {
  const range = findHeadingRange(text, heading);
  if (!range) {
    throw new Error(`Missing heading '${Array.isArray(heading) ? heading.join("' or '") : heading}'`);
  }

  const replacementLines = replacement.trim().split(/\r?\n/);
  range.lines.splice(range.start, range.end - range.start, ...replacementLines);
  return range.lines.join("\n");
}

function insertBeforeHeading(text: string, heading: HeadingSelector, block: string): string {
  const range = findHeadingRange(text, heading);
  if (!range) {
    throw new Error(`Missing heading '${Array.isArray(heading) ? heading.join("' or '") : heading}'`);
  }

  const blockLines = block.trim().split(/\r?\n/);
  range.lines.splice(range.start, 0, ...blockLines, "");
  return range.lines.join("\n");
}

function insertAfterSectionByHeading(text: string, heading: HeadingSelector, block: string): string {
  const range = findHeadingRange(text, heading);
  if (!range) {
    throw new Error(`Missing heading '${Array.isArray(heading) ? heading.join("' or '") : heading}'`);
  }

  const blockLines = block.trim().split(/\r?\n/);
  range.lines.splice(range.end, 0, "", ...blockLines);
  return range.lines.join("\n");
}

function insertAfterHeadingLine(text: string, heading: HeadingSelector, block: string): string {
  const range = findHeadingRange(text, heading);
  if (!range) {
    throw new Error(`Missing heading '${Array.isArray(heading) ? heading.join("' or '") : heading}'`);
  }

  const blockLines = block.trim().split(/\r?\n/);
  range.lines.splice(range.start + 1, 0, "", ...blockLines);
  return range.lines.join("\n");
}

function readOverlayContent(relPath: string): string {
  const fullPath = join(OVERLAY_ROOT, relPath);
  if (!existsSync(fullPath)) {
    throw new Error(`Missing docs overlay: ${fullPath}`);
  }
  return normalizeDocument(readFileSync(fullPath, "utf8")).trim();
}

function extractFirstHeadingTitle(text: string): string {
  const match = text.match(/^(#{1,6})\s+(.+)$/m);
  if (!match) {
    throw new Error("Overlay content must start with a markdown heading for upsert operations.");
  }

  return match[2]?.trim() ?? "";
}

function removeExactBlock(text: string, block: string): string {
  const trimmed = block.trim();
  if (!trimmed) {
    return text;
  }

  let out = text;
  while (out.includes(trimmed)) {
    out = out.replace(trimmed, "").replace(/\n{3,}/g, "\n\n");
  }
  return out;
}

function applyDocOverlays(path: string, text: string): string {
  const operations = DOC_OVERLAYS[path] ?? [];
  let out = text;

  for (const operation of operations) {
    const content = readOverlayContent(operation.contentPath);

    switch (operation.mode) {
      case "replace-section":
        out = replaceSectionByHeading(out, operation.heading, content);
        break;
      case "upsert-before-heading": {
        const managedHeading = extractFirstHeadingTitle(content);
        if (findHeadingRange(out, managedHeading)) {
          out = replaceSectionByHeading(out, managedHeading, content);
        } else {
          out = insertBeforeHeading(out, operation.anchorHeading, content);
        }
        break;
      }
      case "upsert-after-section": {
        const managedHeading = extractFirstHeadingTitle(content);
        if (findHeadingRange(out, managedHeading)) {
          out = replaceSectionByHeading(out, managedHeading, content);
        } else {
          out = insertAfterSectionByHeading(out, operation.anchorHeading, content);
        }
        break;
      }
      case "insert-after-heading-line":
        out = insertAfterHeadingLine(removeExactBlock(out, content), operation.heading, content);
        break;
    }
  }

  return out;
}

function removeSectionByHeading(text: string, heading: string): string {
  const lines = text.split(/\r?\n/);
  const headingNeedle = heading.trim().toLowerCase();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const match = line.match(/^(#{2,6})\s+(.+)$/);
    if (!match) {
      continue;
    }

    const level = match[1]?.length ?? 0;
    const title = match[2]?.trim().toLowerCase() ?? "";
    if (title !== headingNeedle) {
      continue;
    }

    let end = i + 1;
    while (end < lines.length) {
      const next = lines[end] ?? "";
      const nextHeading = next.match(/^(#{1,6})\s+(.+)$/);
      if (nextHeading && (nextHeading[1]?.length ?? 0) <= level) {
        break;
      }
      end++;
    }

    let start = i;
    while (start > 0 && !(lines[start - 1] ?? "").trim()) {
      start--;
    }
    while (end < lines.length && !(lines[end] ?? "").trim()) {
      end++;
    }

    lines.splice(start, end - start);
    return lines.join("\n");
  }

  return text;
}

function removeQuickLinkByAnchor(text: string, anchor: string): string {
  const escaped = anchor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(new RegExp(`^\\s*-\\s+\\[[^\\]]+\\]\\(#${escaped}\\)\\s*$\\n?`, "gm"), "");
}

function removeUpstreamMergeLead(text: string): string {
  return text.replace(/^This page merges(?: the)? upstream PocketBase[^\n]*\n\n/gm, "");
}

function replaceBrandMentionsOutsideCode(text: string): string {
  return mapOutsideCodeFences(text, (segment) => {
    const lines = segment.split("\n");
    return lines
      .map((line) => {
        if (PRESERVE_POCKETBASE_LINE_PATTERNS.some((pattern) => pattern.test(line))) {
          return line;
        }

        return line.replace(/\bPocketBase\b/g, "PocketBun").replace(/#([a-z0-9-]*?)pocketbase([a-z0-9-]*)/g, "#$1pocketbun$2");
      })
      .join("\n");
  });
}

function patchIntroduction(text: string): string {
  let out = text;
  const thumbNote =
    "PocketBun uses Sharp for thumbnail generation, so binary output may differ from upstream. BMP thumbnails are emitted as PNG.";
  const thumbBase =
    "The original file would be returned, if the requested thumb size is not found or the file is not an image!";

  out = out.replace(
    /The easiest way to get started is to download the prebuilt minimal PocketB(?:ase|un) executable:[\s\S]*?See the GitHub Releases page for other platforms and more details\.\n\n/m,
    [
      "The easiest way to get started is to install PocketBun with Bun package manager:",
      "",
      "- `bun add pocketbun` to add it to an existing project.",
      "- `bun create pocketbun my-app` to start a new project template.",
      "",
      "",
    ].join("\n"),
  );

  out = out.replace(/^\s*\.tabs-architecture[^\n]*$/gm, "");
  out = out.replace(
    /Once you've extracted the archive, you could start the application by running `\*\*\.\/pocketb(?:ase|un) serve\*\*` in the extracted directory\./g,
    "After installation, you can start the application by running `pocketbun serve`.",
  );
  out = out.replace(/`\*\*pocketbun serve\*\*`/g, "`pocketbun serve`");
  out = out.replace(
    /(- `bun create pocketbun my-app` to start a new project template\.)\nAfter installation,/g,
    "$1\n\nAfter installation,",
  );
  out = out.replace(
    /The prebuilt PocketBun executable will create and manage 2 new directories alongside the executable:/g,
    "By default, PocketBun will create and manage 2 new directories in the current working directory:",
  );
  out = out.replace(
    /can be used both as Go framework and as standalone application\./g,
    "can be used as a standalone application and can be extended with JavaScript.",
  );
  out = out.replace(/extend PocketBun with Go or JavaScript/g, "extend PocketBun with JavaScript");
  out = out.replace(
    /\[Use PocketBun as Go\/JS framework\]\(#extending-pocketbun\)/g,
    "[Use PocketBun as JavaScript framework](#extending-pocketbun)",
  );
  out = out.replace(/When extending PocketBun with Go\/JSVM/g, "When extending PocketBun with JavaScript hooks");
  out = out.replace(/programmatically via Go\/JS\./g, "programmatically via JavaScript hooks.");

  out = out.replace(
    /\*\* Choose \[Extend with Go\][\s\S]*?(?=\n\n\*\* Choose \[Extend with JavaScript\]|\n\nWith both Go and JavaScript, you can:)/m,
    "",
  );
  out = out.replace(/With both Go and JavaScript, you can:/g, "With JavaScript, you can:");
  out = out.replace(
    /For further info, please check the related \[Extend with Go\]\([^)]+\) or \[Extend with JavaScript\]\(\.\/extend\.md#overview\) guides\./g,
    "For further info, please check the [Extend PocketBun](./extend.md#overview) guide.",
  );
  out = out.replace(
    /One of the main features of PocketBun is that \*\*it can be used as a framework\*\* which enables you to write your own custom app business logic in \[Go\]\([^)]+\) or \[JavaScript\]\(\.\/extend\.md#overview\) and still have a portable backend at the end\./g,
    "One of the main features of PocketBun is that **it can be used as a framework** which enables you to write your own custom app business logic in [JavaScript](./extend.md#overview).",
  );
  out = out.replace(
    /\*\* Choose \[Extend with JavaScript\]\(\.\/extend\.md#overview\) if you don't intend to write too much custom code and want a quick way to explore the PocketBun capabilities\. \*\* The embedded JavaScript engine is a pluggable wrapper around the existing Go APIs, so most of the time the slight performance penalty will be negligible because it'll invoke the Go functions under the hood\. As a bonus, because the JS VM mirrors the Go APIs, you would be able migrate gradually without much code changes from JS -> Go at later stage in case you hit a bottleneck or want more control over the execution flow\./g,
    "** Choose [Extend with JavaScript](./extend.md#overview) if you want to build custom server logic directly in your PocketBun project. **",
  );

  out = out.replace(
    /programmatically via the \[Go\]\([^)]+\)\/\[JavaScript\]\(\.\/extend\.md#migrations\) migrations\./g,
    "programmatically via [JavaScript](./extend.md#migrations) migrations.",
  );
  out = out.replace(
    /programmatically via the \[Go\]\([^)]+\)\/\[JavaScript\]\(\.\/extend\.md#record-operations\) Record operations\./g,
    "programmatically via [JavaScript](./extend.md#record-operations) Record operations.",
  );

  out = out.replace(/\n-\nDart SDK\n\n\(Web, Mobile, Desktop, CLI\)\n/g, "\n");
  out = out.replace(
    /When building mobile apps with the JavaScript SDK or Dart SDK you'll have to specify a custom persistence store if you want to preserve the authentication between the various app activities and open\/close state\./g,
    "When building mobile apps with the JavaScript SDK you'll have to specify a custom persistence store if you want to preserve the authentication between the various app activities and open/close state.",
  );
  out = out.replace(
    /The SDKs come with a helper async storage implementation that allows you to hook any custom persistent layer \(local file, SharedPreferences, key-value based database, etc\.\)\. Here is a minimal PocketBun SDKs initialization for React Native \(JavaScript\) and Flutter \(Dart\):/g,
    "The SDK comes with a helper async storage implementation that allows you to hook any custom persistent layer (local file, SharedPreferences, key-value based database, etc.). Here is a minimal PocketBun JS SDK initialization for React Native:",
  );
  out = out.replace(/\ndart=\nimport 'package:pocketbase\/pocketbase\.dart';[\s\S]*?\n\/>\n\n/g, "\n");

  out = out.replace(/\.\/pocketbase\b/g, "./pocketbun");
  out = out.replace(/`\.\/pocketbun/g, "`pocketbun");
  out = out.replace(/\.\/pocketbun\b/g, "pocketbun");
  out = out.replace(
    new RegExp(`${escapeRegExp(thumbBase)}(?:\\n\\n${escapeRegExp(thumbNote)})?`, "g"),
    `${thumbBase}\n\n${thumbNote}`,
  );

  return out;
}

function patchGoingToProduction(text: string): string {
  let out = text;

  out = removeQuickLinkByAnchor(out, "using-docker");
  out = removeQuickLinkByAnchor(out, "set-gomemlimit");
  out = removeSectionByHeading(out, "Using Docker");
  out = removeSectionByHeading(out, "Set GOMEMLIMIT");
  out = out.replace(
    /^\s*# download and unzip PocketB(?:ase|un)[\s\S]*?\* For a full example you could check the \["Host for free on Fly\.io"\]\(https:\/\/github\.com\/pocketbase\/pocketbase\/discussions\/537\) guide\. \*\n*/m,
    "",
  );

  out = out.replace(/\/root\/pb\/pocketbase\b/g, "/root/pb/pocketbun");
  out = out.replace(/\.\/pocketbase\b/g, "./pocketbun");
  out = out.replace(/\bpocketbase serve\b/g, "pocketbun serve");
  out = out.replace(/\bpocketbase\.service\b/g, "pocketbun.service");
  out = out.replace(/\bDescription = pocketbase\b/g, "Description = pocketbun");
  out = out.replace(/\bsystemctl start pocketbase\b/g, "systemctl start pocketbun");
  out = out.replace(/CMD \["\/pb\/pocketbase", "serve"/g, 'CMD ["/pb/pocketbun", "serve"');
  out = out.replace(/^(\s*)pocketbase\s*$/gm, "$1pocketbun");
  out = out.replace(
    /could be deployed by just uploading the executable on your server/g,
    "could be deployed by uploading your app files and running the PocketBun CLI",
  );
  out = out.replace(
    /This means that it doesn't require any external dependency and \*\*could be deployed by uploading your app files and running the PocketBun CLI\*\*\./g,
    "This means that deployment can stay simple: upload your app files, ensure Bun is installed on the server, and run the PocketBun CLI.",
  );
  out = out.replace(
    /Upload the binary and anything else required by your application to your remote server/g,
    "Upload your app files and anything else required by your application to your remote server",
  );
  out = out.replace(/Start the executable/g, "Start the application");
  out = out.replace(
    /\/root\/pb\/pocketbun serve yourdomain\.com/g,
    "cd /root/pb/myapp && bun run pocketbun serve yourdomain.com",
  );
  out = out.replace(
    /sudo setcap 'cap_net_bind_service=\+ep' \/root\/pb\/pocketbun/g,
    "sudo setcap 'cap_net_bind_service=+ep' $(which bun)",
  );
  out = out.replace(/^WorkingDirectory = \/root\/pb(?:\/myapp)+$/gm, "WorkingDirectory = /root/pb/myapp");
  out = out.replace(/^WorkingDirectory = \/root\/pb$/gm, "WorkingDirectory = /root/pb/myapp");
  out = out.replace(
    /^ExecStart\s*=.*pocketbun serve yourdomain\.com$/gm,
    "ExecStart        = cd /root/pb/myapp && bun run pocketbun serve yourdomain.com",
  );
  out = out.replace(
    /\/root\/pb\/pocketbun superuser create EMAIL PASS/g,
    "cd /root/pb/myapp && bun run pocketbun superuser create EMAIL PASS",
  );
  out = out.replace(/`\.\/pocketbun/g, "`pocketbun");
  out = out.replace(/\.\/pocketbun\b/g, "pocketbun");
  out = out.replace(
    /myapp\/\n([ \t]+pb_migrations\/\n)([ \t]+pb_hooks\/\n)(?:[ \t]+pocketbun|[ \t]+package\.json)/g,
    "myapp/\n$1$2    package.json",
  );

  return out;
}

function patchExtend(text: string): string {
  let out = text;
  const hooksWatchNote = "On Windows, HooksWatch restart behavior has no effect.";
  const hooksWatchParagraph =
    "* For convenience, when making changes to the files inside `pb_hooks`, the process will automatically restart/reload itself (currently supported only on UNIX based platforms). The `*.pb.js` files are loaded per their filename sort order.";
  const apisLine =
    "The global [`$apis.*`](https://pocketbase.io/jsvm/modules/_apis.html) object exposes several middlewares that you can use as part of your application.";
  const asyncApisNote =
    "PocketBun also provides async alternatives for several I/O-heavy helpers (for example `$http.sendAsync(...)` and `$os.readFileAsync(...)`).";
  const hooksPluginNote =
    "In the PocketBun package API, use `RegisterHooksPlugin*` / `MustRegisterHooksPlugin*` as preferred names. `RegisterJSVM*` / `MustRegisterJSVM*` remain available as compatibility aliases.";
  const asyncOverviewNote =
    "Many I/O-heavy APIs also expose Async variants (for example `serveAsync(...)`, `migrateAsync(...)`, and `RegisterHooksPluginAsync(...)`).";
  const errorsLine = "- Errors are thrown as regular JavaScript exceptions and not returned as explicit error values.";
  const dbxIntro =
    "To prevent SQL injection attacks, you should use named parameters for any expression value that comes from user input. This could be done using the named `` placeholders in your SQL statement and then define the parameter values for the query with `bind(params)`.";
  const dbxNote =
    "PocketBun rewrites dbx-style named markers for SQLite execution. The logged placeholder syntax can look different from your input query while behavior stays compatible.";
  const migrationCallbacksLine = "Both callbacks accept a transactional `app` instance.";
  const oldMigrationAppNote =
    "For collection/schema changes, use `const migrationApp = app.forMigrations()` before calling collection persistence methods such as `save`, `delete`, or `importCollections`. This skips user hooks while preserving PocketBun system hooks required to save collections and sync record tables. New generated JS collection migrations use this form.";
  const migrationAppNote =
    "For collection/schema changes, use `const migrationApp = app.forMigrations()` before calling collection persistence methods such as `save`, `delete`, or `importCollections`. This skips user hooks while preserving PocketBun system hooks required to save collections and sync record tables. New generated JS collection migrations use this form. This follows the same migration-safety principle explained by Rails in [Using Models in Your Migrations](https://guides.rubyonrails.org/v3.2/migrations.html#using-models-in-your-migrations): old migrations should not accidentally depend on current application model behavior.";
  const migrationDataPolicy =
    "For record, data, and settings migrations, use SQL. If SQL is not enough, keep the transformation logic inside the migration and work with the persisted data shape. Do not use current app behavior from migrations: no normal record/settings `app.save(...)`, forms, services, or hook-driven helpers.";

  out = out.replace(/For complete API bindings reference, see \[Extend PocketBun Reference\]\(\.\/reference\.md\)\.\n\n/g, "");

  out = out.replace(
    /The prebuilt PocketBun v0\.17\+ executable comes with embedded ES5 JavaScript engine \(goja\) which enables you to write custom server-side code using plain JavaScript\./g,
    "PocketBun executes your hooks and custom server code with Bun, allowing you to write server-side logic in JavaScript.",
  );
  out = out.replace(
    /inside a `pb_hooks` directory next to your executable\./g,
    "inside a `pb_hooks` directory in your project.",
  );
  out = out.replace(
    /Please note that the embedded JavaScript engine is not a Node\.js or browser environment, meaning that modules that rely on APIs like \*window\*, \*fs\*, \*fetch\*, \*buffer\* or any other runtime specific API not part of the ES5 spec may not work!/g,
    "Please note that the hooks runtime is not a browser environment. Use APIs that are supported by Bun and PocketBun hooks runtime.",
  );

  out = out.replace(
    /For most parts, the JavaScript APIs are derived from \[Go\]\(https:\/\/pocketbase\.io\/docs\/go-overview\) with 2 main differences:/g,
    "For most parts, the JavaScript APIs mirror the upstream server APIs with 2 main differences:",
  );
  out = out.replace(/Go values/g, "explicit error values");
  out = out.replace(
    /- Errors are thrown as regular JavaScript exceptions and not returned as Go values\./g,
    "- Errors are thrown as regular JavaScript exceptions and not returned as explicit error values.",
  );

  out = out.replace(
    /For this and other more advanced use cases you'll have to \[extend PocketBun with Go\]\(https:\/\/pocketbase\.io\/docs\/go-overview\/\)\./g,
    "For this and other more advanced use cases you'll need custom server code outside the JS hooks runtime.",
  );
  out = out.replace(
    /The prebuilt executable has the `--automigrate` flag enabled by default/g,
    "The PocketBun CLI has the `--automigrate` flag enabled by default",
  );
  out = out.replace(
    /#### Performance[\s\S]*?(?=\n#### (?:Runtime limitations|Engine limitations))/m,
    "#### Performance\n\nPerformance characteristics in PocketBun depend on your hook workload, I/O patterns and runtime configuration. For CPU-heavy operations, prefer built-in helpers where possible.\n\n",
  );
  out = out.replace(
    /#### Engine limitations[\s\S]*?(?=\n## Event hooks)/m,
    "#### Runtime limitations\n\nHooks run in isolated handler contexts, and you should avoid shared mutable state between handlers.\n\n",
  );

  out = out.replace(/```go\n(onRecordCreateRequest\()/g, "```js\n$1");
  out = out.replace(/```go\n(\$app\.rootCmd\.addCommand)/g, "```js\n$1");
  out = out.replace(/\.\/pocketbase\b/g, "./pocketbun");
  out = out.replace(/\.\/pocketbase hello/g, "./pocketbun hello");
  out = out.replace(/^(\s*)pocketbase\s*$/gm, "$1pocketbun");
  out = out.replace(
    /Each scheduled job runs in its own goroutine as part of the `serve` command process/g,
    "Each scheduled job runs in the `serve` command process",
  );
  out = out.replace(
    /The global \[`\\$apis\.\*`\]\(https:\/\/pocketbase\.io\/jsvm\/modules\/_apis\.html\) object exposes several middlewares that you can use as part of your application\./g,
    apisLine,
  );
  out = out.replace(
    new RegExp(`${escapeRegExp(dbxIntro)}(?:\\n\\n${escapeRegExp(dbxNote)})*(?:\\n\\nFor example:)?`, "g"),
    `${dbxIntro}\n\n${dbxNote}\n\nFor example:`,
  );
  out = out.replace(/For example:\s*For example:/g, "For example:");
  out = out.replace(
    /For more information about the template syntax please refer to the \[\*html\/template\*\][\s\S]*?\*\* Another great resource is also the Hashicorp's \[Learn Go Template Syntax\]\(https:\/\/developer\.hashicorp\.com\/nomad\/tutorials\/templates\/go-template-syntax\) tutorial\. \*\*/m,
    "For more information about the template syntax please refer to the [*html/template*](https://pkg.go.dev/html/template#hdr-A_fuller_picture) and [*text/template*](https://pkg.go.dev/text/template) package godocs.\n\nFor closer Go `text/template` parity in PocketBun, install optional `go-text-template`.",
  );
  out = out.replace(
    /\* For convenience, when making changes to the files inside `pb_hooks`, the process will automatically restart\/reload itself \(currently supported only on UNIX based platforms\)\. The `\*\.pb\.js` files are loaded per their filename sort order\. ?\*?/g,
    hooksWatchParagraph,
  );
  out = out.replace(new RegExp(`^\\s*${escapeRegExp(hooksWatchNote)}\\s*\\*?\\s*$`, "gm"), "");
  out = out.replace(
    new RegExp(`${escapeRegExp(hooksWatchParagraph)}(?:\\n+${escapeRegExp(hooksWatchNote)})?`, "m"),
    `${hooksWatchParagraph}\n\n${hooksWatchNote}`,
  );
  out = out.replace(new RegExp(`\\n${escapeRegExp(hooksPluginNote)}\\n`, "g"), "\n");
  out = out.replace(new RegExp(`\\n${escapeRegExp(asyncOverviewNote)}\\n`, "g"), "\n");
  out = out.replace(
    new RegExp(
      `${escapeRegExp(errorsLine)}(?:\\n\\n${escapeRegExp(hooksPluginNote)})?(?:\\n\\n${escapeRegExp(asyncOverviewNote)})?`,
      "g",
    ),
    `${errorsLine}\n\n${hooksPluginNote}\n\n${asyncOverviewNote}`,
  );
  out = out.replace(new RegExp(`\\n${escapeRegExp(asyncApisNote)}\\n`, "g"), "\n");
  out = out.replace(
    new RegExp(`${escapeRegExp(apisLine)}(?:\\n\\n${escapeRegExp(asyncApisNote)})?`, "g"),
    `${apisLine}\n\n${asyncApisNote}`,
  );
  out = out.replace(
    new RegExp(
      `(${escapeRegExp(migrationCallbacksLine)})(?:\\n\\n(?:${escapeRegExp(oldMigrationAppNote)}|${escapeRegExp(migrationAppNote)}))*`,
      "g",
    ),
    `$1\n\n${migrationAppNote}\n\n${migrationDataPolicy}`,
  );
  out = out.replace(new RegExp(`(?:\\n\\n${escapeRegExp(migrationDataPolicy)}){2,}`, "g"), `\n\n${migrationDataPolicy}`);
  out = out.replace(
    /migrate\(\(app\) => \{\n    \/\/ missing default options, system fields like id, email, etc\. are initialized automatically/g,
    "migrate((app) => {\n    const migrationApp = app.forMigrations()\n\n    // missing default options, system fields like id, email, etc. are initialized automatically",
  );
  out = out.replace(
    /    app\.save\(collection\)\n\}, \(app\) => \{\n    let collection = app\.findCollectionByNameOrId\("clients"\)\n    app\.delete\(collection\)/g,
    '    migrationApp.save(collection)\n}, (app) => {\n    const migrationApp = app.forMigrations()\n\n    let collection = migrationApp.findCollectionByNameOrId("clients")\n    migrationApp.delete(collection)',
  );
  out = out.replace(
    /myapp\/\n([ \t]+pb_hooks\/\n)([ \t]+views\/[\s\S]*?\n[ \t]+main\.pb\.js\n)pocketbun/g,
    "myapp/\n$1$2    pocketbun",
  );
  out = out.replace(/`\.\/pocketbun/g, "`pocketbun");
  out = out.replace(/\.\/pocketbun\b/g, "pocketbun");
  out = out.replace(
    /# Extend PocketBun\n\n/g,
    "# Extend PocketBun\n\nFor complete API bindings reference, see [Extend PocketBun Reference](./reference.md).\n\n",
  );

  return out;
}

function patchWebApis(text: string): string {
  let out = text;
  const thumbBase =
    "If the thumb size is not defined in the file schema field options or the file resource is not an image (jpg, png, gif, webp), then the original file resource is returned unmodified.";
  const thumbNote =
    "PocketBun uses Sharp for thumbnail generation, so binary output may differ from upstream. BMP thumbnails are emitted as PNG.";

  out = out.replace(new RegExp(`(${escapeRegExp(thumbBase)})(?:\\s+${escapeRegExp(thumbNote)})+`, "g"), `$1 ${thumbNote}`);
  out = out.replace(new RegExp(`(?:${escapeRegExp(thumbNote)}\\s*){2,}`, "g"), `${thumbNote} `);
  if (!out.includes(`${thumbBase} ${thumbNote}`)) {
    out = out.replace(thumbBase, `${thumbBase} ${thumbNote}`);
  }
  out = out.replace(/"status":\s*200,\n(\s*)"message": "API is healthy\."/g, '"code": 200,\n$1"message": "API is healthy."');

  return out;
}

function patchReference(text: string): string {
  let out = text;
  out = out.replace(/: _TygojaDict;/g, ": { [key: string]: any };");
  const migrateNote = "_Note that this method is available only in pb_migrations context._";
  const oldMigrationAppNote =
    "For collection/schema migrations, use `const migrationApp = app.forMigrations()` before collection persistence calls. It skips user hooks while preserving PocketBun system hooks required for collection schema persistence.";
  const migrationAppNote =
    "For collection/schema migrations, use `const migrationApp = app.forMigrations()` before collection persistence calls. It skips user hooks while preserving PocketBun system hooks required for collection schema persistence. See Rails' [Using Models in Your Migrations](https://guides.rubyonrails.org/v3.2/migrations.html#using-models-in-your-migrations) for the same replay hazard.";
  out = out.replace(
    new RegExp(
      `(${escapeRegExp(migrateNote)})(?:\\n\\n(?:${escapeRegExp(oldMigrationAppNote)}|${escapeRegExp(migrationAppNote)}))*`,
      "g",
    ),
    `$1\n\n${migrationAppNote}`,
  );

  return out;
}

function patchAttribution(path: string, text: string): string {
  const upstreamByDoc = new Map<string, string>([
    ["introduction.md", "https://pocketbase.io/docs/"],
    ["going-to-production.md", "https://pocketbase.io/docs/going-to-production/"],
    ["web-apis.md", "https://pocketbase.io/docs/api-records/"],
    ["extend.md", "https://pocketbase.io/docs/js-overview/"],
  ]);

  let upstreamUrl: string | null = null;
  for (const [suffix, url] of upstreamByDoc.entries()) {
    if (path.endsWith(suffix)) {
      upstreamUrl = url;
      break;
    }
  }
  if (!upstreamUrl) {
    return text;
  }

  return text.replace(
    /This page is adapted from \[PocketBase docs\]\([^)]+\)\./g,
    `This page is adapted from [PocketBase docs](${upstreamUrl}).`,
  );
}

function patchFile(path: string, source: string): string {
  let out = replaceBrandMentionsOutsideCode(source);
  out = removeUpstreamMergeLead(out);

  if (path.endsWith("introduction.md")) {
    out = patchIntroduction(out);
  } else if (path.endsWith("going-to-production.md")) {
    out = patchGoingToProduction(out);
  } else if (path.endsWith("extend.md")) {
    out = patchExtend(out);
  } else if (path.endsWith("web-apis.md")) {
    out = patchWebApis(out);
  } else if (path.endsWith("reference.md")) {
    out = patchReference(out);
  }

  out = applyDocOverlays(path, out);
  out = patchAttribution(path, out);

  return normalizeDocument(out);
}

function main(): void {
  let changedCount = 0;

  for (const path of TARGET_DOCS) {
    if (!existsSync(path)) {
      throw new Error(`Missing generated docs file: ${path}`);
    }

    const original = readFileSync(path, "utf8");
    const patched = patchFile(path, original);

    if (patched === original) {
      continue;
    }

    writeFileSync(path, patched);
    changedCount += 1;
  }

  console.log(`Applied deterministic PocketBun docs patches (${changedCount}/${TARGET_DOCS.length} files changed).`);
}

main();
