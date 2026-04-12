// Ported from pocketbase/tools/template/registry_test.go

import { describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NewRegistry } from "./registry.ts";

function checkRegistryFuncs(r: ReturnType<typeof NewRegistry>, expectedFuncs: string[]): void {
  const names = Object.keys(r.funcs);
  expect(names.length).toBe(expectedFuncs.length);

  for (const name of expectedFuncs) {
    expect(Object.prototype.hasOwnProperty.call(r.funcs, name)).toBe(true);
  }
}

describe("Registry", () => {
  it("NewRegistry", () => {
    const r = NewRegistry();

    expect(r.cache).toBeTruthy();
    expect(r.cache.length()).toBe(0);

    checkRegistryFuncs(r, ["raw"]);
  });

  it("AddFuncs", () => {
    const r = NewRegistry();

    r.AddFuncs({
      test: (a: string) => `${a}-TEST`,
    });

    checkRegistryFuncs(r, ["raw", "test"]);

    const result = r.LoadString("{{.|test}}").Render("example");
    expect(result).toBe("example-TEST");
  });

  it("LoadFiles", async () => {
    const r = NewRegistry();

    r.LoadFiles("file1.missing", "file2.missing");

    const missingKey = "file1.missing,file2.missing";
    const missingRenderer = r.cache.get(missingKey);

    expect(missingRenderer).toBeTruthy();
    expect(missingRenderer?.template).toBeNull();
    expect(missingRenderer?.parseError).toBeTruthy();

    const dir = await mkdtemp(join(tmpdir(), "template_test"));
    try {
      await writeFile(join(dir, "base.html"), `Base:{{template "content" .}}`);
      await writeFile(join(dir, "content.html"), `{{define "content"}}Content:{{.|raw}}{{end}}`);

      const files = [join(dir, "base.html"), join(dir, "content.html")];

      r.LoadFiles(...files);

      const renderer = r.cache.get(files.join(","));

      expect(renderer).toBeTruthy();
      expect(renderer?.template).toBeTruthy();
      expect(renderer?.parseError).toBeNull();

      const result = renderer?.Render("<h1>123</h1>");
      expect(result).toBe("Base:Content:<h1>123</h1>");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("LoadFilesAsync", async () => {
    const r = NewRegistry();

    await r.LoadFilesAsync("file1.missing", "file2.missing");

    const missingKey = "file1.missing,file2.missing";
    const missingRenderer = r.cache.get(missingKey);

    expect(missingRenderer).toBeTruthy();
    expect(missingRenderer?.template).toBeNull();
    expect(missingRenderer?.parseError).toBeTruthy();

    const dir = await mkdtemp(join(tmpdir(), "template_test_async"));
    try {
      await writeFile(join(dir, "base.html"), `Base:{{template "content" .}}`);
      await writeFile(join(dir, "content.html"), `{{define "content"}}Content:{{.|raw}}{{end}}`);

      const files = [join(dir, "base.html"), join(dir, "content.html")];

      await r.LoadFilesAsync(...files);

      const renderer = r.cache.get(files.join(","));

      expect(renderer).toBeTruthy();
      expect(renderer?.template).toBeTruthy();
      expect(renderer?.parseError).toBeNull();

      const result = renderer?.Render("<h1>123</h1>");
      expect(result).toBe("Base:Content:<h1>123</h1>");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("LoadString", () => {
    const r = NewRegistry();

    const invalid = `test {{define "content"}}`;

    r.LoadString(invalid);

    const invalidRenderer = r.cache.get(invalid);
    expect(invalidRenderer).toBeTruthy();
    expect(invalidRenderer?.template).toBeNull();
    expect(invalidRenderer?.parseError).toBeTruthy();

    const valid = `test {{.|raw}}`;

    r.LoadString(valid);

    const validRenderer = r.cache.get(valid);
    expect(validRenderer).toBeTruthy();
    expect(validRenderer?.template).toBeTruthy();
    expect(validRenderer?.parseError).toBeNull();

    const result = validRenderer?.Render("<h1>123</h1>");
    expect(result).toBe("test <h1>123</h1>");
  });

  it("LoadFS", async () => {
    const r = NewRegistry();

    const missingFs = { root: "__missing__" };
    const missingFiles = ["missing1", "missing2"];
    const missingKey = String(missingFs as unknown) + missingFiles.join(",");

    r.LoadFS(missingFs, ...missingFiles);

    const missingRenderer = r.cache.get(missingKey);
    expect(missingRenderer).toBeTruthy();
    expect(missingRenderer?.template).toBeNull();
    expect(missingRenderer?.parseError).toBeTruthy();

    const dir = await mkdtemp(join(tmpdir(), "template_test2"));
    try {
      await writeFile(join(dir, "base.html"), `Base:{{template "content" .}}`);
      await writeFile(join(dir, "content.html"), `{{define "content"}}Content:{{.|raw}}{{end}}`);

      const fsys = { root: dir };
      const files = ["base.html", "content.html"];
      const key = String(fsys as unknown) + files.join(",");

      r.LoadFS(fsys, ...files);

      const renderer = r.cache.get(key);
      expect(renderer).toBeTruthy();
      expect(renderer?.template).toBeTruthy();
      expect(renderer?.parseError).toBeNull();

      const result = renderer?.Render("<h1>123</h1>");
      expect(result).toBe("Base:Content:<h1>123</h1>");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("LoadFS supports hierarchical glob patterns", async () => {
    const r = NewRegistry();

    const dir = await mkdtemp(join(tmpdir(), "template_test_glob"));
    try {
      await mkdir(join(dir, "nested"), { recursive: true });
      await writeFile(join(dir, "base.html"), `Base:{{template "content" .}}`);
      await writeFile(join(dir, "nested", "content.html"), `{{define "content"}}Content:{{.|raw}}{{end}}`);

      const fsys = { root: dir };
      const patterns = ["**/*.html"];
      const key = String(fsys as unknown) + patterns.join(",");

      r.LoadFS(fsys, ...patterns);

      const renderer = r.cache.get(key);
      expect(renderer).toBeTruthy();
      expect(renderer?.template).toBeTruthy();
      expect(renderer?.parseError).toBeNull();

      const result = renderer?.Render("<h1>123</h1>");
      expect(result).toBe("Base:Content:<h1>123</h1>");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("LoadFS keeps missing-pattern errors when another wildcard matches", async () => {
    const r = NewRegistry();

    const dir = await mkdtemp(join(tmpdir(), "template_test_glob_missing"));
    try {
      await writeFile(join(dir, "base.html"), `Base`);

      const fsys = { root: dir };
      const patterns = ["**/*.html", "missing*.html"];
      const key = String(fsys as unknown) + patterns.join(",");

      r.LoadFS(fsys, ...patterns);

      const renderer = r.cache.get(key);
      expect(renderer).toBeTruthy();
      expect(renderer?.template).toBeNull();
      expect(renderer?.parseError).toBeTruthy();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("LoadFSAsync", async () => {
    const r = NewRegistry();

    const missingFs = { root: "__missing__" };
    const missingFiles = ["missing1", "missing2"];
    const missingKey = String(missingFs as unknown) + missingFiles.join(",");

    await r.LoadFSAsync(missingFs, ...missingFiles);

    const missingRenderer = r.cache.get(missingKey);
    expect(missingRenderer).toBeTruthy();
    expect(missingRenderer?.template).toBeNull();
    expect(missingRenderer?.parseError).toBeTruthy();

    const dir = await mkdtemp(join(tmpdir(), "template_test2_async"));
    try {
      await writeFile(join(dir, "base.html"), `Base:{{template "content" .}}`);
      await writeFile(join(dir, "content.html"), `{{define "content"}}Content:{{.|raw}}{{end}}`);

      const fsys = { root: dir };
      const files = ["base.html", "content.html"];
      const key = String(fsys as unknown) + files.join(",");

      await r.LoadFSAsync(fsys, ...files);

      const renderer = r.cache.get(key);
      expect(renderer).toBeTruthy();
      expect(renderer?.template).toBeTruthy();
      expect(renderer?.parseError).toBeNull();

      const result = renderer?.Render("<h1>123</h1>");
      expect(result).toBe("Base:Content:<h1>123</h1>");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("LoadFSAsync supports hierarchical glob patterns", async () => {
    const r = NewRegistry();

    const dir = await mkdtemp(join(tmpdir(), "template_test_glob_async"));
    try {
      await mkdir(join(dir, "nested"), { recursive: true });
      await writeFile(join(dir, "base.html"), `Base:{{template "content" .}}`);
      await writeFile(join(dir, "nested", "content.html"), `{{define "content"}}Content:{{.|raw}}{{end}}`);

      const fsys = { root: dir };
      const patterns = ["**/*.html"];
      const key = String(fsys as unknown) + patterns.join(",");

      await r.LoadFSAsync(fsys, ...patterns);

      const renderer = r.cache.get(key);
      expect(renderer).toBeTruthy();
      expect(renderer?.template).toBeTruthy();
      expect(renderer?.parseError).toBeNull();

      const result = renderer?.Render("<h1>123</h1>");
      expect(result).toBe("Base:Content:<h1>123</h1>");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
