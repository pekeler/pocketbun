// PocketBun-only: regression tests for multipart parsing fallback behavior.
//
// Why this file exists:
// Bun multipart parsing may fail on some incoming request shapes. These tests
// pin the fallback and preserve-body behavior used across API handlers.

import { describe, expect, it } from "bun:test";
import { parseMultipartFormData } from "./request_form_data.ts";

describe("parseMultipartFormData", () => {
  it("falls back to reconstructed multipart parsing when formData() throws", async () => {
    const form = new FormData();
    form.set("title", "from-fallback");
    const sourceRequest = new Request("http://localhost", { method: "POST", body: form });
    const contentType = sourceRequest.headers.get("content-type") ?? "";
    const body = await sourceRequest.arrayBuffer();

    const request = {
      headers: {
        get: (name: string) => (name.toLowerCase() === "content-type" ? contentType : null),
      },
      formData: async () => {
        throw new TypeError("undefined is not a function");
      },
      arrayBuffer: async () => body,
      method: "POST",
      url: "http://localhost",
    };

    const parsed = await parseMultipartFormData(request);
    expect(parsed.get("title")).toBe("from-fallback");
  });

  it("uses request.clone() when preserveBody is true", async () => {
    let sourceCalls = 0;
    let cloneCalls = 0;

    const sourceForm = new FormData();
    sourceForm.set("source", "source");
    const cloneForm = new FormData();
    cloneForm.set("source", "clone");

    const cloneRequest = {
      headers: { get: (_name: string) => "multipart/form-data; boundary=test" },
      formData: async () => {
        cloneCalls += 1;
        return cloneForm;
      },
    };

    const request = {
      headers: { get: (_name: string) => "multipart/form-data; boundary=test" },
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
});
