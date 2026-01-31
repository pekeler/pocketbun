// Ported from pocketbase/tools/filesystem/filesystem_test.go

import { describe, expect, it } from "bun:test";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { NewFileFromPath } from "./file.ts";
import { NewLocal, NotFoundError, metadataOriginalName, type Attributes } from "./filesystem.ts";
import { createTestDir } from "./test_utils.ts";
import { detectMimeTypeFromBytes } from "./file.ts";

class ResponseRecorder {
  statusCode = 200;
  #headers = new Map<string, string>();
  #chunks: Uint8Array[] = [];

  setHeader(name: string, value: string) {
    this.#headers.set(name, value);
  }

  getHeader(name: string): string | undefined {
    return this.#headers.get(name);
  }

  write(chunk: Uint8Array | string) {
    if (typeof chunk === "string") {
      this.#chunks.push(new TextEncoder().encode(chunk));
    } else {
      this.#chunks.push(chunk);
    }
  }

  end(body?: Uint8Array | string) {
    if (body) {
      this.write(body);
    }
  }

  header(name: string): string {
    return this.getHeader(name) ?? "";
  }
}

describe("filesystem system", () => {
  it("exists", async () => {
    const dir = await createTestDir();
    try {
      const fsys = NewLocal(dir);

      const scenarios = [
        { file: "sub1.txt", exists: false },
        { file: "test/sub1.txt", exists: true },
        { file: "test/sub2.txt", exists: true },
        { file: "image.png", exists: true },
      ];

      for (const scenario of scenarios) {
        const exists = fsys.Exists(scenario.file);
        expect(exists).toBe(scenario.exists);
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("attributes", async () => {
    const dir = await createTestDir();
    try {
      const fsys = NewLocal(dir);

      const scenarios = [
        { file: "sub1.txt", expectError: true, contentType: "" },
        { file: "test/sub1.txt", expectError: false, contentType: "application/octet-stream" },
        { file: "test/sub2.txt", expectError: false, contentType: "application/octet-stream" },
        { file: "image.png", expectError: false, contentType: "image/png" },
      ];

      for (const scenario of scenarios) {
        let err: Error | null = null;
        let attrs: Attributes | null = null;
        try {
          attrs = fsys.Attributes(scenario.file);
        } catch (error) {
          err = error as Error;
        }

        const hasErr = err !== null;
        expect(hasErr).toBe(scenario.expectError);
        if (hasErr) {
          expect(err instanceof NotFoundError).toBe(true);
        } else {
          expect(attrs?.ContentType).toBe(scenario.contentType);
        }
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("delete", async () => {
    const dir = await createTestDir();
    try {
      const fsys = NewLocal(dir);

      let err: Error | null = null;
      try {
        fsys.Delete("missing.txt");
      } catch (error) {
        err = error as Error;
      }
      expect(err instanceof NotFoundError).toBe(true);

      expect(() => fsys.Delete("image.png")).not.toThrow();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("delete prefix without trailing slash", async () => {
    const dir = await createTestDir();
    try {
      const fsys = NewLocal(dir);

      expect(fsys.DeletePrefix("").length).toBeGreaterThan(0);
      expect(fsys.DeletePrefix("missing").length).toBe(0);
      expect(fsys.DeletePrefix("test").length).toBe(0);

      expect(fsys.Exists("test/sub1.txt")).toBe(false);
      expect(fsys.Exists("test/sub2.txt")).toBe(false);

      // prefix dir should remain
      expect(fsys.Exists("test")).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("delete prefix with trailing slash", async () => {
    const dir = await createTestDir();
    try {
      const fsys = NewLocal(dir);

      expect(fsys.DeletePrefix("missing/").length).toBe(0);
      expect(fsys.DeletePrefix("test/").length).toBe(0);

      expect(fsys.Exists("test/sub1.txt")).toBe(false);
      expect(fsys.Exists("test/sub2.txt")).toBe(false);
      expect(fsys.Exists("test")).toBe(false);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("is empty dir", async () => {
    const dir = await createTestDir();
    try {
      const fsys = NewLocal(dir);

      const scenarios = [
        { dir: "", expected: false },
        { dir: "/", expected: true },
        { dir: "missing", expected: true },
        { dir: "missing/", expected: true },
        { dir: "test", expected: false },
        { dir: "test/", expected: false },
        { dir: "empty", expected: true },
        { dir: "empty/", expected: true },
      ];

      for (const scenario of scenarios) {
        expect(fsys.IsEmptyDir(scenario.dir)).toBe(scenario.expected);
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("upload multipart", async () => {
    const dir = await createTestDir();
    try {
      const fsys = NewLocal(dir);
      const fileKey = "newdir/newkey.txt";
      fsys.UploadMultipart(
        { filename: "test", size: 4, buffer: new TextEncoder().encode("demo") },
        fileKey,
      );

      expect(fsys.Exists(fileKey)).toBe(true);

      const attrs = fsys.Attributes(fileKey);
      expect(attrs.Metadata[metadataOriginalName]).toBe("test");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("upload file", async () => {
    const dir = await createTestDir();
    try {
      const fsys = NewLocal(dir);
      const fileKey = "newdir/newkey.txt";
      const file = NewFileFromPath(join(dir, "image.svg"));
      file.OriginalName = "test.txt";

      fsys.UploadFile(file, fileKey);

      expect(fsys.Exists(fileKey)).toBe(true);
      const attrs = fsys.Attributes(fileKey);
      expect(attrs.Metadata[metadataOriginalName]).toBe(file.OriginalName);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("upload bytes", async () => {
    const dir = await createTestDir();
    try {
      const fsys = NewLocal(dir);
      const fileKey = "newdir/newkey.txt";
      fsys.Upload(new TextEncoder().encode("demo"), fileKey);
      expect(fsys.Exists(fileKey)).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("serve", async () => {
    const dir = await createTestDir();
    try {
      const fsys = NewLocal(dir);

      const csp = "default-src 'none'; media-src 'self'; style-src 'unsafe-inline'; sandbox";
      const cacheControl = "max-age=2592000, stale-while-revalidate=86400";

      type ServeScenario = {
        path: string;
        name: string;
        query: Record<string, string>;
        headers: Record<string, string>;
        expectError: boolean;
        expected?: Record<string, string>;
      };

      const scenarios: ServeScenario[] = [
        { path: "missing.txt", name: "test_name.txt", query: {}, headers: {}, expectError: true },
        {
          path: "test/sub1.txt",
          name: "test_name.txt",
          query: {},
          headers: {},
          expectError: false,
          expected: {
            "Content-Disposition": "attachment; filename=test_name.txt",
            "Content-Type": "application/octet-stream",
            "Content-Security-Policy": csp,
            "Cache-Control": cacheControl,
          },
        },
        {
          path: "image.png",
          name: "test_name.png",
          query: {},
          headers: {},
          expectError: false,
          expected: {
            "Content-Disposition": "inline; filename=test_name.png",
            "Content-Type": "image/png",
            "Content-Security-Policy": csp,
            "Cache-Control": cacheControl,
          },
        },
        {
          path: "image.png",
          name: "test_name_download.png",
          query: { download: "1" },
          headers: {},
          expectError: false,
          expected: {
            "Content-Disposition": "attachment; filename=test_name_download.png",
            "Content-Type": "image/png",
            "Content-Security-Policy": csp,
            "Cache-Control": cacheControl,
          },
        },
        {
          path: "image.svg",
          name: "test_name.svg",
          query: {},
          headers: {},
          expectError: false,
          expected: {
            "Content-Disposition": "attachment; filename=test_name.svg",
            "Content-Type": "image/svg+xml",
            "Content-Security-Policy": csp,
            "Cache-Control": cacheControl,
          },
        },
        {
          path: "style.css",
          name: "test_name.css",
          query: {},
          headers: {},
          expectError: false,
          expected: {
            "Content-Disposition": "attachment; filename=test_name.css",
            "Content-Type": "text/css",
            "Content-Security-Policy": csp,
            "Cache-Control": cacheControl,
          },
        },
        {
          path: "main.js",
          name: "test_name.js",
          query: {},
          headers: {},
          expectError: false,
          expected: {
            "Content-Disposition": "attachment; filename=test_name.js",
            "Content-Type": "text/javascript",
            "Content-Security-Policy": csp,
            "Cache-Control": cacheControl,
          },
        },
        {
          path: "main.mjs",
          name: "test_name.mjs",
          query: {},
          headers: {},
          expectError: false,
          expected: {
            "Content-Disposition": "attachment; filename=test_name.mjs",
            "Content-Type": "text/javascript",
            "Content-Security-Policy": csp,
            "Cache-Control": cacheControl,
          },
        },
        {
          path: "test/sub2.txt",
          name: "test_name.txt",
          query: {},
          headers: {
            "Content-Disposition": "1",
            "Content-Type": "2",
            "Content-Length": "1",
            "Content-Security-Policy": "4",
            "Cache-Control": "5",
            "X-Custom": "6",
          },
          expectError: false,
          expected: {
            "Content-Disposition": "1",
            "Content-Type": "2",
            "Content-Security-Policy": "4",
            "Cache-Control": "5",
            "X-Custom": "6",
          },
        },
      ];

      for (const scenario of scenarios) {
        const res = new ResponseRecorder();
        for (const [key, value] of Object.entries(scenario.headers)) {
          res.setHeader(key, value);
        }
        const query = new URLSearchParams(scenario.query).toString();
        const url = query ? `/?${query}` : "/";
        const err = fsys.Serve(
          res,
          { url, headers: {} },
          scenario.path,
          scenario.name,
        );

        expect(Boolean(err)).toBe(scenario.expectError);
        if (scenario.expectError || !scenario.expected) {
          continue;
        }

        for (const [header, value] of Object.entries(scenario.expected)) {
          expect(res.header(header)).toBe(value);
        }

        const attrs = fsys.Attributes(scenario.path);
        expect(res.header("Content-Length")).toBe(String(attrs.Size));
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("get reader", async () => {
    const dir = await createTestDir();
    try {
      const fsys = NewLocal(dir);

      const scenarios = [
        { file: "test/missing.txt", expectError: true, content: "" },
        { file: "test/sub1.txt", expectError: false, content: "sub1" },
      ];

      for (const scenario of scenarios) {
        let err: Error | null = null;
        let content = "";
        try {
          const reader = fsys.GetReader(scenario.file);
          content = new TextDecoder().decode(reader.readAll());
        } catch (error) {
          err = error as Error;
        }
        expect(Boolean(err)).toBe(scenario.expectError);
        if (!scenario.expectError) {
          expect(content).toBe(scenario.content);
        } else {
          expect(err instanceof NotFoundError).toBe(true);
        }
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("get reuploadable file", async () => {
    const dir = await createTestDir();
    try {
      const fsys = NewLocal(dir);
      expect(() => fsys.GetReuploadableFile("missing.txt", false)).toThrow();

      const preserve = fsys.GetReuploadableFile("test/sub1.txt", true);
      expect(preserve.OriginalName).toBe("sub1.txt");
      expect(preserve.Size).toBe(4);
      expect(preserve.Name).toBe("sub1.txt");

      const reader = preserve.Reader?.Open();
      const raw = reader ? new TextDecoder().decode(reader.readAll()) : "";
      expect(raw).toBe("sub1");

      const renamed = fsys.GetReuploadableFile("test/sub1.txt", false);
      expect(renamed.OriginalName).toBe("sub1.txt");
      expect(renamed.Size).toBe(4);
      expect(renamed.Name).not.toBe("sub1.txt");
      expect(renamed.Name.length).toBeGreaterThan("sub1.txt".length);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("copy", async () => {
    const dir = await createTestDir();
    try {
      const fsys = NewLocal(dir);
      expect(() => fsys.Copy("image.png_copy", "image.png")).toThrow();

      fsys.Copy("image.png", "image.png_copy");

      const reader = fsys.GetReader("image.png_copy");
      expect(reader.Size()).toBeGreaterThan(0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("list", async () => {
    const dir = await createTestDir();
    try {
      const fsys = NewLocal(dir);

      const scenarios = [
        {
          prefix: "",
          expected: [
            "image.png",
            "image.jpg",
            "image.svg",
            "image.webp",
            "image_!@ special",
            "image_noext",
            "style.css",
            "main.js",
            "main.mjs",
            "test/sub1.txt",
            "test/sub2.txt",
          ],
        },
        {
          prefix: "test",
          expected: ["test/sub1.txt", "test/sub2.txt"],
        },
        {
          prefix: "missing",
          expected: [],
        },
      ];

      for (const scenario of scenarios) {
        const objs = fsys.List(scenario.prefix);
        expect(objs.length).toBe(scenario.expected.length);
        for (const obj of objs) {
          expect(scenario.expected.includes(obj.Key)).toBe(true);
        }
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("serve single range", async () => {
    const dir = await createTestDir();
    try {
      const fsys = NewLocal(dir);
      const attrs = fsys.Attributes("image.png");
      const res = new ResponseRecorder();
      const err = fsys.Serve(res, { url: "/", headers: { Range: "bytes=0-20" } }, "image.png", "image.png");
      expect(err).toBeNull();
      expect(res.statusCode).toBe(206);
      expect(res.header("Content-Range")).toBe(`bytes 0-20/${attrs.Size}`);
      expect(res.header("Content-Length")).toBe("21");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("serve multi range", async () => {
    const dir = await createTestDir();
    try {
      const fsys = NewLocal(dir);
      const res = new ResponseRecorder();
      const err = fsys.Serve(
        res,
        { url: "/", headers: { Range: "bytes=0-20, 25-30" } },
        "image.png",
        "image.png",
      );
      expect(err).toBeNull();
      expect(res.statusCode).toBe(206);
      expect(res.header("Content-Type").startsWith("multipart/byteranges; boundary=")).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("create thumb", async () => {
    const dir = await createTestDir();
    try {
      const fsys = NewLocal(dir);

      const scenarios = [
        { file: "missing.txt", thumb: "thumb_test_missing", size: "100x100", expectMime: "" },
        { file: "test/sub1.txt", thumb: "thumb_test_sub1", size: "100x100", expectMime: "" },
        { file: "image.png", thumb: "test", size: "100x100", expectMime: "" },
        { file: "image.png", thumb: "thumb0", size: "invalid", expectMime: "" },
        { file: "image.png", thumb: "thumb_0xH", size: "0x100", expectMime: "image/png" },
        { file: "image.png", thumb: "thumb_Wx0", size: "100x0", expectMime: "image/png" },
        { file: "image.png", thumb: "thumb_WxH", size: "100x100", expectMime: "image/png" },
        { file: "image.png", thumb: "thumb_WxHt", size: "100x100t", expectMime: "image/png" },
        { file: "image.png", thumb: "thumb_WxHb", size: "100x100b", expectMime: "image/png" },
        { file: "image.png", thumb: "thumb_WxHf", size: "100x100f", expectMime: "image/png" },
        { file: "image.jpg", thumb: "thumb.jpg", size: "100x100", expectMime: "image/jpeg" },
        { file: "image.webp", thumb: "thumb.webp", size: "100x100", expectMime: "image/png" },
        { file: "image_noext", thumb: "image_noext.jpeg", size: "100x100", expectMime: "image/jpeg" },
      ];

      for (const scenario of scenarios) {
        const err = await fsys.CreateThumb(scenario.file, scenario.thumb, scenario.size);
        const shouldError = scenario.expectMime === "";
        expect(Boolean(err)).toBe(shouldError);
        if (shouldError) {
          continue;
        }

        const reader = fsys.GetReader(scenario.thumb);
        const attrsMime = reader.ContentType();
        const contentMime = detectMimeTypeFromBytes(reader.readAll());

        expect(contentMime).toBe(scenario.expectMime);
        expect(attrsMime).toBe(scenario.expectMime);
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
