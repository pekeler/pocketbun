// PocketBun-only: tests for multipart parsing helper behavior.
//
// Why this file exists:
// Keep the streaming multipart parser semantics pinned, including temp-file
// spooling, request-scoped caching, and fallback clone behavior for test doubles.

import { describe, expect, it } from "bun:test";
import {
  cleanupParsedMultipartFormData,
  multipartValueToFilesystemFile,
  parseMultipartFormData,
  StoredMultipartFile,
} from "./request_form_data.ts";

async function newMultipartRequest(url: string, form: FormData): Promise<Request> {
  const boundary = `----PocketBunBoundary${Math.random().toString(16).slice(2)}`;
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];

  const appendText = (text: string): void => {
    chunks.push(encoder.encode(text));
  };

  for (const [name, value] of form.entries()) {
    const entryValue: unknown = value;
    appendText(`--${boundary}\r\n`);
    if (entryValue instanceof File) {
      const contentType = entryValue.type || "application/octet-stream";
      appendText(`Content-Disposition: form-data; name="${name}"; filename="${entryValue.name}"\r\n`);
      appendText(`Content-Type: ${contentType}\r\n\r\n`);
      chunks.push(new Uint8Array(await entryValue.arrayBuffer()));
      appendText("\r\n");
      continue;
    }
    appendText(`Content-Disposition: form-data; name="${name}"\r\n\r\n${String(entryValue)}\r\n`);
  }

  appendText(`--${boundary}--\r\n`);

  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.length;
  }

  return new Request(url, {
    method: "POST",
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    body,
  });
}

describe("parseMultipartFormData", () => {
  it("spools uploaded files to temp files and reuses the cached parse result", async () => {
    const form = new FormData();
    form.set("title", "example");
    form.set("file", new File([new TextEncoder().encode("demo")], "test upload.bin", { type: "application/octet-stream" }));
    const request = await newMultipartRequest("http://localhost/test", form);

    const parsed = await parseMultipartFormData(request, { preserveBody: true });
    const parsedAgain = await parseMultipartFormData(request, { preserveBody: true });
    expect(parsedAgain).toBe(parsed);
    expect(parsed.get("title")).toBe("example");

    const value = parsed.get("file");
    expect(value).toBeInstanceOf(StoredMultipartFile);
    expect((value as StoredMultipartFile).name).toBe("test upload.bin");
    expect((value as StoredMultipartFile).size).toBe(4);
    expect(await (value as StoredMultipartFile).exists()).toBe(true);

    const localFile = await multipartValueToFilesystemFile(value);
    expect(localFile?.OriginalName).toBe("test upload.bin");
    expect(localFile?.Size).toBe(4);

    await cleanupParsedMultipartFormData(request);
    expect(await (value as StoredMultipartFile).exists()).toBe(false);
  });

  it("uses request.clone() when preserveBody is true for non-Request test doubles", async () => {
    let sourceCalls = 0;
    let cloneCalls = 0;

    const sourceForm = new FormData();
    sourceForm.set("source", "source");
    const cloneForm = new FormData();
    cloneForm.set("source", "clone");

    const cloneRequest = {
      formData: async () => {
        cloneCalls += 1;
        return cloneForm;
      },
    };

    const request = {
      formData: async () => {
        sourceCalls += 1;
        return sourceForm;
      },
      clone: () => cloneRequest,
    };

    const parsed = await parseMultipartFormData(request, { preserveBody: true });
    expect(parsed.get("source")).toBe("clone");
    expect(cloneCalls).toBe(1);
    expect(sourceCalls).toBe(0);
  });

  it("propagates fallback clone parsing errors", async () => {
    let sourceCalls = 0;
    let cloneCalls = 0;

    const sourceForm = new FormData();
    sourceForm.set("source", "source");

    const cloneRequest = {
      formData: async () => {
        cloneCalls += 1;
        throw new TypeError("Can't decode form data from body because of incorrect MIME type/boundary");
      },
    };

    const request = {
      formData: async () => {
        sourceCalls += 1;
        return sourceForm;
      },
      clone: () => cloneRequest,
    };

    let caught: unknown = null;
    try {
      await parseMultipartFormData(request, { preserveBody: true });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(TypeError);
    expect((caught as Error).message).toContain("Can't decode form data from body because of incorrect MIME type/boundary");
    expect(cloneCalls).toBe(1);
    expect(sourceCalls).toBe(0);
  });
});
