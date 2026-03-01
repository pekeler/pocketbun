// PocketBun-only: verifies serve asset path resolution in source and packaged layouts.

import { afterAll, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveServeAssetPath } from "./serve.ts";

describe("resolveServeAssetPath", () => {
  const roots: string[] = [];

  afterAll(async () => {
    await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  });

  it("prefers source-layout admin UI assets", async () => {
    const root = await mkdtemp(join(tmpdir(), "pocketbun-serve-paths-source-"));
    roots.push(root);

    const sourceServeDir = join(root, "src", "apis");
    await mkdir(sourceServeDir, { recursive: true });
    const sourceAdminDir = join(root, "vendor", "pocketbase-admin-ui", "dist");
    await mkdir(sourceAdminDir, { recursive: true });

    const resolved = resolveServeAssetPath(sourceServeDir, [
      "../../vendor/pocketbase-admin-ui/dist",
      "../vendor/pocketbase-admin-ui/dist",
    ]);

    expect(resolved).toBe(sourceAdminDir);
  });

  it("falls back to package-layout admin UI assets for dist entrypoint", async () => {
    const root = await mkdtemp(join(tmpdir(), "pocketbun-serve-paths-dist-"));
    roots.push(root);

    const distServeDir = join(root, "dist");
    await mkdir(distServeDir, { recursive: true });
    const packagedAdminDir = join(root, "vendor", "pocketbase-admin-ui", "dist");
    await mkdir(packagedAdminDir, { recursive: true });

    const resolved = resolveServeAssetPath(distServeDir, [
      "../../vendor/pocketbase-admin-ui/dist",
      "../vendor/pocketbase-admin-ui/dist",
    ]);

    expect(resolved).toBe(packagedAdminDir);
  });

  it("falls back to package-layout branding script for dist entrypoint", async () => {
    const root = await mkdtemp(join(tmpdir(), "pocketbun-serve-branding-dist-"));
    roots.push(root);

    const distServeDir = join(root, "dist");
    await mkdir(distServeDir, { recursive: true });
    const packagedBrandingScriptPath = join(root, "src", "ui", "admin_branding.js");
    await mkdir(join(root, "src", "ui"), { recursive: true });
    await writeFile(packagedBrandingScriptPath, "console.log('branding');\n");

    const resolved = resolveServeAssetPath(distServeDir, ["../../src/ui/admin_branding.js", "../src/ui/admin_branding.js"]);

    expect(resolved).toBe(packagedBrandingScriptPath);
  });
});
