// PocketBun-only: finalizes package declaration files emitted by tsc.

import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";

const distRoot = resolve("dist");
const stagedRoot = join(distRoot, ".types-build");

await removeExistingDeclarations(distRoot);
await copyDeclarations(stagedRoot, distRoot);
await rm(stagedRoot, { recursive: true, force: true });

async function removeExistingDeclarations(dir: string): Promise<void> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (path === stagedRoot || path.startsWith(`${stagedRoot}/`)) {
      continue;
    }
    if (entry.isDirectory()) {
      await removeExistingDeclarations(path);
      continue;
    }
    if (entry.isFile() && (entry.name.endsWith(".d.ts") || entry.name.endsWith(".d.ts.map"))) {
      await rm(path, { force: true });
    }
  }
}

async function copyDeclarations(fromDir: string, toDir: string): Promise<void> {
  const entries = await readdir(fromDir, { withFileTypes: true });

  for (const entry of entries) {
    const fromPath = join(fromDir, entry.name);
    const toPath = join(toDir, relative(stagedRoot, fromPath));
    if (entry.isDirectory()) {
      await copyDeclarations(fromPath, toDir);
      continue;
    }
    if (!entry.isFile() || !entry.name.endsWith(".d.ts")) {
      continue;
    }

    const raw = await readFile(fromPath, "utf8");
    await mkdir(dirname(toPath), { recursive: true });
    await writeFile(toPath, rewriteDeclarationSpecifiers(raw));
  }
}

function rewriteDeclarationSpecifiers(raw: string): string {
  return raw.replace(/(["'])((?:\.{1,2}\/)[^"']+)\.ts\1/g, (match, quote: string, specifier: string) => {
    if (`${specifier}.ts`.endsWith(".d.ts")) {
      return match;
    }
    return `${quote}${specifier}.js${quote}`;
  });
}
