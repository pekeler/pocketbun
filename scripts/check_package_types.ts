// PocketBun-only: verifies generated package declarations from a consumer project.

import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = process.cwd();
const distIndexDts = resolve(root, "dist", "index.d.ts");
if (!(await exists(distIndexDts))) {
  throw new Error("Missing dist/index.d.ts. Run `bun run build` before checking package types.");
}

const fixtureRoot = resolve(root, ".tmp", "package-types-consumer");
const packageRoot = join(fixtureRoot, "node_modules", "pocketbun");

await rm(fixtureRoot, { recursive: true, force: true });
await mkdir(packageRoot, { recursive: true });
await cp(resolve(root, "dist"), join(packageRoot, "dist"), { recursive: true });
await cp(resolve(root, "package.json"), join(packageRoot, "package.json"));

await writeFile(join(fixtureRoot, "package.json"), JSON.stringify({ type: "module", private: true }, null, 2) + "\n");
await writeFile(
  join(fixtureRoot, "tsconfig.json"),
  JSON.stringify(
    {
      compilerOptions: {
        target: "ES2022",
        module: "NodeNext",
        moduleResolution: "NodeNext",
        strict: true,
        noEmit: true,
        types: ["bun"],
      },
      include: ["index.ts"],
    },
    null,
    2,
  ) + "\n",
);
await writeFile(
  join(fixtureRoot, "index.ts"),
  [
    'import { BaseApp, PocketBase, serveAsync, type PocketBaseConfig } from "pocketbun";',
    "",
    "const config: PocketBaseConfig = { DefaultDev: true };",
    "const pb = new PocketBase(config);",
    "const app = new BaseApp({ dataDir: 'pb_data' });",
    "void serveAsync(app, { httpAddr: '127.0.0.1:0' });",
    "void pb;",
    "",
  ].join("\n"),
);

const proc = Bun.spawn({
  cmd: ["bun", "x", "tsc", "-p", join(fixtureRoot, "tsconfig.json")],
  cwd: root,
  stdout: "inherit",
  stderr: "inherit",
});

const exitCode = await proc.exited;
if (exitCode !== 0) {
  process.exit(exitCode ?? 1);
}

async function exists(path: string): Promise<boolean> {
  try {
    await Bun.file(path).bytes();
    return true;
  } catch {
    return false;
  }
}
