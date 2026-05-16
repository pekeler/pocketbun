#!/usr/bin/env bun
// PocketBun-only: syncs the docs header version from package.json.

const outputPath = "docs/_data/pocketbun.yml";
const { version } = (await Bun.file("package.json").json()) as { version?: unknown };
if (typeof version !== "string") {
  throw new Error("Missing or invalid package.json version.");
}
const content = `# Generated from package.json by bun run docs:version.\nversion: ${JSON.stringify(version)}\n`;

if (!process.argv.includes("--check")) {
  await Bun.write(outputPath, content);
} else if ((await Bun.file(outputPath).text()) !== content) {
  throw new Error(`${outputPath} is stale. Run: bun run docs:version`);
}
