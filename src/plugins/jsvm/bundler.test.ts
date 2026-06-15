// PocketBun-only: regression tests for Bun-native deploy bundling of pb_hooks.

import { describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bundleServerHooksAsync } from "./bundler.ts";

describe("server hook bundler", () => {
  it("reports non-static dynamic require expressions as build errors", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "pocketbun-hooks-bundler-"));
    const hooksDir = join(rootDir, "pb_hooks");

    await mkdir(hooksDir, { recursive: true });
    await writeFile(
      join(hooksDir, "main.pb.js"),
      `const moduleName = Math.random() > 0 ? "./a.js" : "./b.js";
require(moduleName);
`,
    );

    try {
      const buildErr = await bundleServerHooksAsync({
        hooksDir,
        outDir: join(rootDir, "dist", "pb_hooks"),
      }).then(
        () => "",
        (err) => String(err),
      );
      expect(buildErr).toMatch(/failed to bundle server hooks[\s\S]*require\(\) expression/);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });
});
