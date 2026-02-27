// PocketBun-only: tests for multipart parsing helper behavior.
//
// Why this file exists:
// Keep helper semantics pinned for preserve-body clone parsing and native error
// propagation.

import { describe, expect, it } from "bun:test";
import { parseMultipartFormData } from "./request_form_data.ts";

describe("parseMultipartFormData", () => {
  it("propagates native formData() errors", async () => {
    const request = {
      formData: async () => {
        throw new TypeError("Can't decode form data from body because of incorrect MIME type/boundary");
      },
    };

    let caught: unknown = null;
    try {
      await parseMultipartFormData(request);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(TypeError);
    expect((caught as Error).message).toContain("Can't decode form data from body because of incorrect MIME type/boundary");
  });

  it("uses request.clone() when preserveBody is true", async () => {
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

  it("does not fallback to original request when preserveBody clone parsing fails", async () => {
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
