// Ported from pocketbase/tools/filesystem/file_test.go

import { describe, expect, it } from "bun:test";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { startBunServerWithRetry } from "../../tests/helpers.ts";
import {
  BytesReader,
  MultipartReader,
  detectExtensionAsync,
  NewFileFromBytes,
  NewFileFromMultipart,
  NewFileFromPath,
  NewFileFromPathWithOriginalName,
  NewFileFromPathAsync,
  NewFileFromURL,
  PathReader,
  ReadFileReaderBytes,
  ReadFileReaderBytesAsync,
} from "./file.ts";
import { createTestDir } from "./test_utils.ts";

describe("filesystem file", () => {
  it("as map", () => {
    const file = NewFileFromBytes(new TextEncoder().encode("test"), "test123.txt");
    const result = file.AsMap();

    expect(Object.keys(result).length).toBe(3);
    expect(result.size).toBe(4);
    expect((result.name as string).startsWith("test123")).toBe(true);
    expect(result.originalName).toBe("test123.txt");
  });

  it("NewFileFromPath", async () => {
    const dir = await createTestDir();
    try {
      expect(() => NewFileFromPath("missing")).toThrow();

      const originalName = "image_!@ special";
      const f = NewFileFromPath(join(dir, originalName));
      expect(f.OriginalName).toBe(originalName);
      expect(f.Name).toMatch(/^image_special_\w{10}\.png$/);
      expect(f.Size).toBeGreaterThan(0);
      expect(f.Reader).toBeInstanceOf(PathReader);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("NewFileFromPathAsync", async () => {
    const dir = await createTestDir();
    try {
      let missingErr: Error | null = null;
      try {
        await NewFileFromPathAsync("missing");
      } catch (error) {
        missingErr = error as Error;
      }
      expect(missingErr).not.toBeNull();

      const originalName = "image_!@ special";
      const f = await NewFileFromPathAsync(join(dir, originalName));
      expect(f.OriginalName).toBe(originalName);
      expect(f.Name).toMatch(/^image_special_\w{10}\.png$/);
      expect(f.Size).toBeGreaterThan(0);
      expect(f.Reader).toBeInstanceOf(PathReader);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("NewFileFromPathWithOriginalName", async () => {
    const dir = await createTestDir();
    try {
      const f = NewFileFromPathWithOriginalName(join(dir, "image_!@ special"), "uploaded name.txt");
      expect(f.OriginalName).toBe("uploaded name.txt");
      expect(f.Name).toMatch(/^uploaded_name_\w{10}\.txt$/);
      expect(f.Size).toBeGreaterThan(0);
      expect(f.Reader).toBeInstanceOf(PathReader);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("NewFileFromBytes", () => {
    expect(() => NewFileFromBytes(null, "photo.jpg")).toThrow();
    expect(() => NewFileFromBytes(new Uint8Array(), "photo.jpg")).toThrow();

    const originalName = "image_!@ special";
    const f = NewFileFromBytes(new TextEncoder().encode("text\n"), originalName);
    expect(f.Size).toBe(5);
    expect(f.OriginalName).toBe(originalName);
    expect(f.Name).toMatch(/^image_special_\w{10}\.txt$/);
    expect(f.Reader).toBeInstanceOf(BytesReader);
  });

  it("NewFileFromMultipart", () => {
    const header = {
      filename: "tmpfile-abc.txt",
      size: 4,
      buffer: new TextEncoder().encode("demo"),
    };

    const f = NewFileFromMultipart(header);
    expect(f.OriginalName).toMatch(/^tmpfile-\w+\.txt$/);
    expect(f.Name).toMatch(/^tmpfile_\w+_\w{10}\.txt$/);
    expect(f.Size).toBe(4);
    expect(f.Reader).toBeInstanceOf(MultipartReader);
  });

  it("NewFileFromURL", async () => {
    const server = startBunServerWithRetry({
      fetch(req) {
        const url = new URL(req.url);
        if (url.pathname === "/error") {
          return new Response("error", { status: 500 });
        }
        return new Response("test");
      },
    });

    try {
      const controller = new AbortController();
      controller.abort();
      let cancelErr: Error | null = null;
      try {
        await NewFileFromURL(controller.signal, `http://127.0.0.1:${server.port}/cancel`);
      } catch (err) {
        cancelErr = err as Error;
      }
      expect(cancelErr).not.toBeNull();

      let errorErr: Error | null = null;
      try {
        await NewFileFromURL(null, `http://127.0.0.1:${server.port}/error`);
      } catch (err) {
        errorErr = err as Error;
      }
      expect(errorErr).not.toBeNull();

      const originalName = "image_!@ special";
      const f = await NewFileFromURL(null, `http://127.0.0.1:${server.port}/${originalName}`);
      expect(f.OriginalName).toBe(originalName);
      expect(f.Name).toMatch(/^image_special_\w{10}\.txt$/);
      expect(f.Size).toBe(4);
      expect(f.Reader).toBeInstanceOf(BytesReader);
    } finally {
      await server.stop();
    }
  });

  it("name normalizations", () => {
    const scenarios = [
      { name: "", pattern: /^\w{10}_\w{10}\.txt$/ },
      { name: ".png", pattern: /^\w{10}_\w{10}\.png$/ },
      { name: ".tar.gz", pattern: /^\w{10}_\w{10}\.tar\.gz$/ },
      { name: "a.tar.gz", pattern: /^a\w{10}_\w{10}\.tar\.gz$/ },
      { name: "....abc", pattern: /^\w{10}_\w{10}\.abc$/ },
      { name: "a.b.c.?.?.?.2", pattern: /^a_b_c_\w{10}\.2$/ },
      { name: "a.b.c.d.tar.gz", pattern: /^a_b_c_d_\w{10}\.tar\.gz$/ },
      { name: "abcd", pattern: /^abcd_\w{10}\.txt$/ },
      { name: ".abcd.123.", pattern: /^abcd_\w{10}\.123$/ },
      { name: "a  b! c d  . 456", pattern: /^a_b_c_d_\w{10}\.456$/ },
      { name: `${"a".repeat(101)}.${"b".repeat(21)}`, pattern: /^a{100}_\w{10}\.b{20}$/ },
      { name: `abc${"d".repeat(290)}.${"b".repeat(9)}`, pattern: /^d{100}_\w{10}\.b{9}$/ },
    ];

    for (const scenario of scenarios) {
      const f = NewFileFromBytes(new TextEncoder().encode("abc"), scenario.name);
      expect(f.Name).toMatch(scenario.pattern);
    }
  });

  it("ReadFileReaderBytes", async () => {
    const dir = await createTestDir();
    try {
      const file = NewFileFromPath(join(dir, "image_!@ special"));
      const bytes = ReadFileReaderBytes(file.Reader);
      expect(bytes.length).toBeGreaterThan(0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("ReadFileReaderBytesAsync prefers async disk reads for path readers", async () => {
    const dir = await createTestDir();
    try {
      const file = NewFileFromPath(join(dir, "image_!@ special"));
      const reader = file.Reader;
      if (!(reader instanceof PathReader)) {
        throw new Error("expected path reader");
      }
      (reader as unknown as { Open: () => never }).Open = () => {
        throw new Error("sync open should not be used for path readers");
      };

      const bytes = await ReadFileReaderBytesAsync(reader);
      expect(bytes.length).toBeGreaterThan(0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("detectExtensionAsync prefers async sample reads for path readers", async () => {
    const dir = await createTestDir();
    try {
      class ThrowingPathReader extends PathReader {
        override Open(): never {
          throw new Error("sync open should not be used for path readers");
        }
      }

      const ext = await detectExtensionAsync(new ThrowingPathReader(join(dir, "image_noext")));
      expect(ext).toBe(".jpg");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
