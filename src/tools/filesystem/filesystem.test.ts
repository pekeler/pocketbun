// Ported from pocketbase/tools/filesystem/filesystem_test.go

import { describe, expect, it } from "bun:test";
import { rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { NewFileFromPath, PathReader, detectMimeTypeFromBytes } from "./file.ts";
import { NewLocal, NewLocalAsync, NotFoundError, metadataOriginalName, type Attributes } from "./filesystem.ts";
import { createTestDir } from "./test_utils.ts";

class ResponseRecorder {
  statusCode = 200;
  #headers = new Map<string, string>();
  #chunks: Uint8Array[] = [];

  setHeader(name: string, value: string) {
    this.#headers.set(name.toLowerCase(), value);
  }

  getHeader(name: string): string | undefined {
    return this.#headers.get(name.toLowerCase());
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

  body(): Uint8Array {
    if (this.#chunks.length === 0) {
      return new Uint8Array();
    }
    if (this.#chunks.length === 1) {
      return this.#chunks[0] ?? new Uint8Array();
    }

    let total = 0;
    for (const chunk of this.#chunks) {
      total += chunk.length;
    }

    const merged = new Uint8Array(total);
    let offset = 0;
    for (const chunk of this.#chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    return merged;
  }
}

describe("filesystem system", () => {
  it("new local async", async () => {
    const dir = await createTestDir();
    try {
      await using fsys = await NewLocalAsync(dir);
      expect(await fsys.Exists("test/sub1.txt")).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

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
        const exists = await fsys.Exists(scenario.file);
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
          attrs = await fsys.Attributes(scenario.file);
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
        await fsys.Delete("missing.txt");
      } catch (error) {
        err = error as Error;
      }
      expect(err instanceof NotFoundError).toBe(true);

      await fsys.Delete("image.png");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("delete prefix without trailing slash", async () => {
    const dir = await createTestDir();
    try {
      const fsys = NewLocal(dir);

      expect((await fsys.DeletePrefix("")).length).toBeGreaterThan(0);
      expect((await fsys.DeletePrefix("missing")).length).toBe(0);
      expect((await fsys.DeletePrefix("test")).length).toBe(0);

      expect(await fsys.Exists("test/sub1.txt")).toBe(false);
      expect(await fsys.Exists("test/sub2.txt")).toBe(false);

      // prefix dir should remain
      let statErr: Error | null = null;
      try {
        await stat(join(dir, "test"));
      } catch (error) {
        statErr = error as Error;
      }
      expect(statErr).toBeNull();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("delete prefix with trailing slash", async () => {
    const dir = await createTestDir();
    try {
      const fsys = NewLocal(dir);

      expect((await fsys.DeletePrefix("missing/")).length).toBe(0);
      expect((await fsys.DeletePrefix("test/")).length).toBe(0);

      expect(await fsys.Exists("test/sub1.txt")).toBe(false);
      expect(await fsys.Exists("test/sub2.txt")).toBe(false);
      let statErr: Error | null = null;
      try {
        await stat(join(dir, "test"));
      } catch (error) {
        statErr = error as Error;
      }
      expect((statErr as NodeJS.ErrnoException | null)?.code).toBe("ENOENT");
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
        expect(await fsys.IsEmptyDir(scenario.dir)).toBe(scenario.expected);
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
      await fsys.UploadMultipart({ filename: "test", size: 4, buffer: new TextEncoder().encode("demo") }, fileKey);

      expect(await fsys.Exists(fileKey)).toBe(true);

      const attrs = await fsys.Attributes(fileKey);
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

      await fsys.UploadFile(file, fileKey);

      expect(await fsys.Exists(fileKey)).toBe(true);
      const attrs = await fsys.Attributes(fileKey);
      expect(attrs.Metadata[metadataOriginalName]).toBe(file.OriginalName);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("upload file prefers async disk reads for path-backed readers", async () => {
    const dir = await createTestDir();
    try {
      const fsys = NewLocal(dir);
      const fileKey = "newdir/newkey-async.txt";
      const file = NewFileFromPath(join(dir, "image.svg"));
      const reader = file.Reader;
      if (!(reader instanceof PathReader)) {
        throw new Error("expected path reader");
      }

      (reader as unknown as { Open: () => never }).Open = () => {
        throw new Error("sync open should not be used for path readers");
      };

      await fsys.UploadFile(file, fileKey);
      expect(await fsys.Exists(fileKey)).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("upload bytes", async () => {
    const dir = await createTestDir();
    try {
      const fsys = NewLocal(dir);
      const fileKey = "newdir/newkey.txt";
      await fsys.Upload(new TextEncoder().encode("demo"), fileKey);
      expect(await fsys.Exists(fileKey)).toBe(true);
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
          name: "test_name.abc",
          query: {},
          headers: {},
          expectError: false,
          expected: {
            "Content-Disposition": "attachment; filename=test_name.abc",
            "Content-Type": "image/svg+xml",
            "Content-Security-Policy": csp,
            "Cache-Control": cacheControl,
          },
        },
        {
          path: "style.css",
          name: "test_name",
          query: {},
          headers: {},
          expectError: false,
          expected: {
            "Content-Disposition": "attachment; filename=test_name",
            "Content-Type": "text/css",
            "Content-Security-Policy": csp,
            "Cache-Control": cacheControl,
          },
        },
        {
          path: "main.js",
          name: "test_name.abc",
          query: {},
          headers: {},
          expectError: false,
          expected: {
            "Content-Disposition": "attachment; filename=test_name.abc",
            "Content-Type": "text/javascript",
            "Content-Security-Policy": csp,
            "Cache-Control": cacheControl,
          },
        },
        {
          path: "main.mjs",
          name: "test_name.abc",
          query: {},
          headers: {},
          expectError: false,
          expected: {
            "Content-Disposition": "attachment; filename=test_name.abc",
            "Content-Type": "text/javascript",
            "Content-Security-Policy": csp,
            "Cache-Control": cacheControl,
          },
        },
        {
          path: "dummy.xlsx",
          name: "test_name.abc",
          query: {},
          headers: {},
          expectError: false,
          expected: {
            "Content-Disposition": "attachment; filename=test_name.abc",
            "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Security-Policy": csp,
            "Cache-Control": cacheControl,
          },
        },
        {
          path: "dummy.docx",
          name: "test_name.abc",
          query: {},
          headers: {},
          expectError: false,
          expected: {
            "Content-Disposition": "attachment; filename=test_name.abc",
            "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "Content-Security-Policy": csp,
            "Cache-Control": cacheControl,
          },
        },
        {
          path: "dummy.pptx",
          name: "test_name.abc",
          query: {},
          headers: {},
          expectError: false,
          expected: {
            "Content-Disposition": "attachment; filename=test_name.abc",
            "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
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
        const err = await fsys.Serve(res, { url, headers: {} }, scenario.path, scenario.name);

        expect(Boolean(err)).toBe(scenario.expectError);
        if (scenario.expectError || !scenario.expected) {
          continue;
        }

        for (const [header, value] of Object.entries(scenario.expected)) {
          expect(res.header(header)).toBe(value);
        }

        const attrs = await fsys.Attributes(scenario.path);
        expect(res.header("Content-Length")).toBe(String(attrs.Size));
        expect(res.body().length).toBe(attrs.Size);
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
          const reader = await fsys.GetReader(scenario.file);
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

  it("get reader async", async () => {
    const dir = await createTestDir();
    try {
      const fsys = NewLocal(dir);

      let missingErr: Error | null = null;
      try {
        await fsys.GetReaderAsync("test/missing.txt");
      } catch (error) {
        missingErr = error as Error;
      }
      expect(missingErr instanceof NotFoundError).toBe(true);

      using reader = await fsys.GetReaderAsync("test/sub1.txt");
      const part1 = await reader.read(2);
      const part2 = await reader.readAll();

      expect(new TextDecoder().decode(part1 ?? new Uint8Array())).toBe("su");
      expect(new TextDecoder().decode(part2)).toBe("b1");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("get reuploadable file", async () => {
    const dir = await createTestDir();
    try {
      const fsys = NewLocal(dir);
      let missingErr: Error | null = null;
      try {
        await fsys.GetReuploadableFile("missing.txt", false);
      } catch (error) {
        missingErr = error as Error;
      }
      expect(missingErr instanceof NotFoundError).toBe(true);

      const preserve = await fsys.GetReuploadableFile("test/sub1.txt", true);
      expect(preserve.OriginalName).toBe("sub1.txt");
      expect(preserve.Size).toBe(4);
      expect(preserve.Name).toBe("sub1.txt");

      const reader = preserve.Reader?.Open();
      const raw = reader ? new TextDecoder().decode(reader.readAll()) : "";
      expect(raw).toBe("sub1");

      const renamed = await fsys.GetReuploadableFile("test/sub1.txt", false);
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
      let copyErr: Error | null = null;
      try {
        await fsys.Copy("image.png_copy", "image.png");
      } catch (error) {
        copyErr = error as Error;
      }
      expect(copyErr instanceof NotFoundError).toBe(true);

      await fsys.Copy("image.png", "image.png_copy");

      const reader = await fsys.GetReader("image.png_copy");
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
            "dummy.xlsx",
            "dummy.docx",
            "dummy.pptx",
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
        const objs = await fsys.List(scenario.prefix);
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
      const attrs = await fsys.Attributes("image.png");
      const res = new ResponseRecorder();
      const err = await fsys.Serve(res, { url: "/", headers: { Range: "bytes=0-20" } }, "image.png", "image.png");
      expect(err).toBeNull();
      expect(res.statusCode).toBe(206);
      expect(res.header("Content-Range")).toBe(`bytes 0-20/${attrs.Size}`);
      expect(res.header("Content-Length")).toBe("21");
      expect(res.body().length).toBe(21);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("serve suffix range", async () => {
    const dir = await createTestDir();
    try {
      const fsys = NewLocal(dir);
      const attrs = await fsys.Attributes("image.png");
      const expectedLength = Math.min(5, attrs.Size);
      const expectedStart = attrs.Size - expectedLength;
      const source = new Uint8Array(await Bun.file(join(dir, "image.png")).arrayBuffer());
      const res = new ResponseRecorder();
      const err = await fsys.Serve(res, { url: "/", headers: { Range: "bytes=-5" } }, "image.png", "image.png");
      expect(err).toBeNull();
      expect(res.statusCode).toBe(206);
      expect(res.header("Content-Range")).toBe(`bytes ${expectedStart}-${attrs.Size - 1}/${attrs.Size}`);
      expect(res.header("Content-Length")).toBe(String(expectedLength));
      expect(res.body()).toEqual(source.subarray(expectedStart));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("serve unsatisfiable range", async () => {
    const dir = await createTestDir();
    try {
      const fsys = NewLocal(dir);
      const attrs = await fsys.Attributes("image.png");
      const res = new ResponseRecorder();
      const err = await fsys.Serve(res, { url: "/", headers: { Range: "bytes=999999-1000000" } }, "image.png", "image.png");
      expect(err).toBeNull();
      expect(res.statusCode).toBe(416);
      expect(res.header("Content-Range")).toBe(`bytes */${attrs.Size}`);
      expect(res.header("Content-Length")).toBe("0");
      expect(res.body().length).toBe(0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("serve response", async () => {
    const dir = await createTestDir();
    try {
      const fsys = NewLocal(dir);

      const scenarios = [
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
        {
          path: "image.png",
          name: "image.png",
          query: {},
          headers: {},
          expectError: false,
          expected: {
            "Content-Disposition": "inline; filename=image.png",
            "Content-Type": "image/png",
          },
        },
      ];

      for (const scenario of scenarios) {
        const query = new URLSearchParams(scenario.query).toString();
        const url = query ? `/?${query}` : "/";
        const initialHeaders = new Headers(
          Object.entries(scenario.headers).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
        );
        const result = await fsys.ServeResponse(initialHeaders, { url, headers: {} }, scenario.path, scenario.name);

        expect(result instanceof Error).toBe(scenario.expectError);
        if (result instanceof Error || !scenario.expected) {
          continue;
        }

        for (const [header, value] of Object.entries(scenario.expected)) {
          expect(result.headers.get(header)).toBe(value);
        }

        const attrs = await fsys.Attributes(scenario.path);
        expect(result.headers.get("Content-Length")).toBe(String(attrs.Size));
        expect((await result.arrayBuffer()).byteLength).toBe(attrs.Size);
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("serve response single range", async () => {
    const dir = await createTestDir();
    try {
      const fsys = NewLocal(dir);
      const attrs = await fsys.Attributes("image.png");
      const result = await fsys.ServeResponse(
        new Headers(),
        { url: "/", headers: { Range: "bytes=0-20" } },
        "image.png",
        "image.png",
      );
      if (result instanceof Error) {
        throw result;
      }

      expect(result.status).toBe(206);
      expect(result.headers.get("Content-Range")).toBe(`bytes 0-20/${attrs.Size}`);
      expect(result.headers.get("Content-Length")).toBe("21");
      expect((await result.arrayBuffer()).byteLength).toBe(21);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("serve response suffix range", async () => {
    const dir = await createTestDir();
    try {
      const fsys = NewLocal(dir);
      const attrs = await fsys.Attributes("image.png");
      const expectedLength = Math.min(5, attrs.Size);
      const expectedStart = attrs.Size - expectedLength;
      const source = new Uint8Array(await Bun.file(join(dir, "image.png")).arrayBuffer());
      const result = await fsys.ServeResponse(
        new Headers(),
        { url: "/", headers: { Range: "bytes=-5" } },
        "image.png",
        "image.png",
      );
      if (result instanceof Error) {
        throw result;
      }

      expect(result.status).toBe(206);
      expect(result.headers.get("Content-Range")).toBe(`bytes ${expectedStart}-${attrs.Size - 1}/${attrs.Size}`);
      expect(result.headers.get("Content-Length")).toBe(String(expectedLength));
      expect(new Uint8Array(await result.arrayBuffer())).toEqual(source.subarray(expectedStart));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("serve response unsatisfiable range", async () => {
    const dir = await createTestDir();
    try {
      const fsys = NewLocal(dir);
      const attrs = await fsys.Attributes("image.png");
      const result = await fsys.ServeResponse(
        new Headers(),
        { url: "/", headers: { Range: "bytes=999999-1000000" } },
        "image.png",
        "image.png",
      );
      if (result instanceof Error) {
        throw result;
      }

      expect(result.status).toBe(416);
      expect(result.headers.get("Content-Range")).toBe(`bytes */${attrs.Size}`);
      expect(result.headers.get("Content-Length")).toBe("0");
      expect((await result.arrayBuffer()).byteLength).toBe(0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("serve multi range", async () => {
    const dir = await createTestDir();
    try {
      const fsys = NewLocal(dir);
      const attrs = await fsys.Attributes("image.png");
      const res = new ResponseRecorder();
      const err = await fsys.Serve(res, { url: "/", headers: { Range: "bytes=0-1, 4-6" } }, "image.png", "image.png");
      expect(err).toBeNull();
      expect(res.statusCode).toBe(206);
      expect(res.header("Content-Type").startsWith("multipart/byteranges; boundary=")).toBe(true);
      const body = new TextDecoder().decode(res.body());
      expect(body).toContain(`Content-Range: bytes 0-1/${attrs.Size}`);
      expect(body).toContain(`Content-Range: bytes 4-6/${attrs.Size}`);
      expect(res.body().length).toBeGreaterThan(0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("serve response multi range", async () => {
    const dir = await createTestDir();
    try {
      const fsys = NewLocal(dir);
      const attrs = await fsys.Attributes("image.png");
      const result = await fsys.ServeResponse(
        new Headers(),
        { url: "/", headers: { Range: "bytes=0-1, 4-6" } },
        "image.png",
        "image.png",
      );
      if (result instanceof Error) {
        throw result;
      }

      expect(result.status).toBe(206);
      expect(result.headers.get("Content-Type")?.startsWith("multipart/byteranges; boundary=")).toBe(true);
      const body = await result.text();
      expect(body).toContain(`Content-Range: bytes 0-1/${attrs.Size}`);
      expect(body).toContain(`Content-Range: bytes 4-6/${attrs.Size}`);
      expect(body.length).toBeGreaterThan(0);
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
        { file: "image.png", thumb: "thumb_0xH", size: "0x100", expectMime: "image/webp" },
        { file: "image.png", thumb: "thumb_Wx0", size: "100x0", expectMime: "image/webp" },
        { file: "image.png", thumb: "thumb_WxH", size: "100x100", expectMime: "image/webp" },
        { file: "image.png", thumb: "thumb_WxHt", size: "100x100t", expectMime: "image/webp" },
        { file: "image.png", thumb: "thumb_WxHb", size: "100x100b", expectMime: "image/webp" },
        { file: "image.png", thumb: "thumb_WxHf", size: "100x100f", expectMime: "image/webp" },
        { file: "image.jpg", thumb: "thumb.jpg", size: "100x100", expectMime: "image/webp" },
        { file: "image.webp", thumb: "thumb.webp", size: "100x100", expectMime: "image/webp" },
        {
          file: "image_noext",
          thumb: "image_noext.jpeg",
          size: "100x100",
          expectMime: "image/webp",
        },
      ];

      for (const scenario of scenarios) {
        const err = await fsys.CreateThumb(scenario.file, scenario.thumb, scenario.size);
        const shouldError = scenario.expectMime === "";
        expect(Boolean(err)).toBe(shouldError);
        if (shouldError) {
          continue;
        }

        const reader = await fsys.GetReader(scenario.thumb);
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
