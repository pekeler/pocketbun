// Ported from pocketbase/tools/router/event_test.go

import { describe, expect, it } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ApiError } from "./api_error.ts";
import { ErrInvalidRedirectStatusCode, Event } from "./event.ts";

type ResponseScenario<T> = {
  name: string;
  status: number;
  headers?: Record<string, string>;
  body: T;
  expectedStatus: number;
  expectedHeaders?: Record<string, string>;
  expectedBody: string;
  expectedError?: ApiError;
  url?: string;
};

async function newMultipartRequest(url: string, form: FormData): Promise<Request> {
  const response = new Response(form);
  const contentType = response.headers.get("content-type") ?? "";
  const body = await response.arrayBuffer();
  return new Request(url, {
    method: "POST",
    headers: { "content-type": contentType },
    body,
  });
}

async function testEventResponseWrite<T>(
  scenario: ResponseScenario<T>,
  writeFunc: (event: Event) => Promise<Response | ApiError> | Response | ApiError,
): Promise<void> {
  const request = new Request(scenario.url ?? "http://example.com/", { method: "GET" });
  const event = new Event({ request });

  if (scenario.headers) {
    for (const [key, value] of Object.entries(scenario.headers)) {
      event.responseHeaders.set(key, value);
    }
  }

  const result = await writeFunc(event);

  if (scenario.expectedError) {
    expect(result).toBeInstanceOf(ApiError);
    if (result instanceof ApiError) {
      expect(result).toBe(scenario.expectedError);
    }
    return;
  }

  expect(result).toBeInstanceOf(Response);
  const response = result as Response;
  expect(response.status).toBe(scenario.expectedStatus);
  const body = await response.text();
  expect(body).toBe(scenario.expectedBody);

  if (scenario.expectedHeaders) {
    for (const [key, value] of Object.entries(scenario.expectedHeaders)) {
      expect(response.headers.get(key)).toBe(value);
    }
  }
}

describe("Event", () => {
  it("Written and Status", () => {
    const event = new Event({ request: new Request("http://example.com/") });
    expect(event.Written()).toBe(false);
    expect(event.Status()).toBe(0);

    event.String(123, "test");

    expect(event.Written()).toBe(true);
    expect(event.Status()).toBe(123);
  });

  it("IsTLS", () => {
    const httpEvent = new Event({ request: new Request("http://example.com/") });
    const httpsEvent = new Event({ request: new Request("https://example.com/") });

    expect(httpEvent.IsTLS()).toBe(false);
    expect(httpsEvent.IsTLS()).toBe(true);
  });

  it("SetCookie", () => {
    const event = new Event({ request: new Request("http://example.com/") });
    expect(event.responseHeaders.get("set-cookie") ?? "").toBe("");

    event.SetCookie({ Name: "test", Value: "a" });
    expect(event.responseHeaders.get("set-cookie")).toBe("test=a");
  });

  it("RemoteIP", () => {
    const scenarios = [
      { remoteAddr: "", expected: "invalid IP" },
      { remoteAddr: "1.2.3.4", expected: "invalid IP" },
      { remoteAddr: "1.2.3.4:8090", expected: "1.2.3.4" },
      {
        remoteAddr: "[0000:0000:0000:0000:0000:0000:0000:0002]:80",
        expected: "0000:0000:0000:0000:0000:0000:0000:0002",
      },
      { remoteAddr: "[::2]:80", expected: "0000:0000:0000:0000:0000:0000:0000:0002" },
    ];

    for (const scenario of scenarios) {
      const event = new Event({ request: new Request("http://example.com/"), remoteAddress: scenario.remoteAddr });
      expect(event.RemoteIP()).toBe(scenario.expected);
    }
  });

  it("FindUploadedFiles", async () => {
    const scenarios = [
      { filename: "ab.png", expectedPattern: /^ab\w{10}_\w{10}\.png$/ },
      { filename: "test", expectedPattern: /^test_\w{10}\.txt$/ },
      { filename: "a b c d!@$.j!@$pg", expectedPattern: /^a_b_c_d_\w{10}\.jpg$/ },
      { filename: "a".repeat(150), expectedPattern: new RegExp(`^a{100}_\\w{10}\\.txt$`) },
    ];

    for (const scenario of scenarios) {
      const form = new FormData();
      form.set("test", new File(["test"], scenario.filename));
      const request = await newMultipartRequest("http://example.com/", form);
      const event = new Event({ request });

      const result = await event.FindUploadedFiles("test");
      expect(result.length).toBe(1);
      expect(result[0]?.Size).toBe(4);
      expect(scenario.expectedPattern.test(result[0]?.Name ?? "")).toBe(true);
    }
  });

  it("FindUploadedFiles missing", async () => {
    const form = new FormData();
    const request = new Request("http://example.com/", { method: "POST", body: form });
    const event = new Event({ request });

    let hasError = false;
    try {
      await event.FindUploadedFiles("test");
    } catch {
      hasError = true;
    }
    expect(hasError).toBe(true);
  });

  it("Get/Set store", () => {
    const event = new Event({ request: new Request("http://example.com/") });

    expect(event.Get("test")).toBeUndefined();

    event.Set("a", 123);
    event.Set("b", 456);

    expect(event.Get("missing")).toBeUndefined();
    expect(event.Get("a")).toBe(123);
    expect(event.Get("b")).toBe(456);

    event.SetAll({ c: 789 });
    const all = event.GetAll();
    expect(all).toEqual({ a: 123, b: 456, c: 789 });
  });

  it("String", async () => {
    const scenarios: ResponseScenario<string>[] = [
      {
        name: "no explicit content-type",
        status: 123,
        body: "test",
        expectedStatus: 123,
        expectedHeaders: { "content-type": "text/plain; charset=utf-8" },
        expectedBody: "test",
      },
      {
        name: "with explicit content-type",
        status: 123,
        headers: { "content-type": "text/test" },
        body: "test",
        expectedStatus: 123,
        expectedHeaders: { "content-type": "text/test" },
        expectedBody: "test",
      },
    ];

    for (const scenario of scenarios) {
      await testEventResponseWrite(scenario, (event) => event.String(scenario.status, scenario.body));
    }
  });

  it("HTML", async () => {
    const scenarios: ResponseScenario<string>[] = [
      {
        name: "no explicit content-type",
        status: 123,
        body: "test",
        expectedStatus: 123,
        expectedHeaders: { "content-type": "text/html; charset=utf-8" },
        expectedBody: "test",
      },
      {
        name: "with explicit content-type",
        status: 123,
        headers: { "content-type": "text/test" },
        body: "test",
        expectedStatus: 123,
        expectedHeaders: { "content-type": "text/test" },
        expectedBody: "test",
      },
    ];

    for (const scenario of scenarios) {
      await testEventResponseWrite(scenario, (event) => event.HTML(scenario.status, scenario.body));
    }
  });

  it("JSON", async () => {
    const body = { a: 123, b: 456, c: "test" };

    const scenarios: ResponseScenario<typeof body>[] = [
      {
        name: "no explicit content-type",
        status: 200,
        body,
        expectedStatus: 200,
        expectedHeaders: { "content-type": "application/json" },
        expectedBody: `{"a":123,"c":"test"}\n`,
        url: "http://example.com/?fields=a,c",
      },
      {
        name: "with explicit content-type (200)",
        status: 200,
        headers: { "content-type": "application/test" },
        body,
        expectedStatus: 200,
        expectedHeaders: { "content-type": "application/test" },
        expectedBody: `{"a":123,"c":"test"}\n`,
        url: "http://example.com/?fields=a,c",
      },
      {
        name: "with explicit content-type (400)",
        status: 400,
        headers: { "content-type": "application/test" },
        body,
        expectedStatus: 400,
        expectedHeaders: { "content-type": "application/test" },
        expectedBody: `{"a":123,"b":456,"c":"test"}\n`,
        url: "http://example.com/?fields=a,c",
      },
    ];

    for (const scenario of scenarios) {
      await testEventResponseWrite(scenario, (event) => event.JSON(scenario.status, scenario.body));
    }
  });

  it("XML", async () => {
    const scenarios: ResponseScenario<string>[] = [
      {
        name: "no explicit content-type",
        status: 234,
        body: "test",
        expectedStatus: 234,
        expectedHeaders: { "content-type": "application/xml; charset=utf-8" },
        expectedBody: `<?xml version="1.0" encoding="UTF-8"?>\n<string>test</string>`,
      },
      {
        name: "with explicit content-type",
        status: 234,
        headers: { "content-type": "text/test" },
        body: "test",
        expectedStatus: 234,
        expectedHeaders: { "content-type": "text/test" },
        expectedBody: `<?xml version="1.0" encoding="UTF-8"?>\n<string>test</string>`,
      },
    ];

    for (const scenario of scenarios) {
      await testEventResponseWrite(scenario, (event) => event.XML(scenario.status, scenario.body));
    }
  });

  it("Stream", async () => {
    const scenario: ResponseScenario<string> = {
      name: "stream",
      status: 234,
      headers: { "content-type": "text/test" },
      body: "test",
      expectedStatus: 234,
      expectedHeaders: { "content-type": "text/test" },
      expectedBody: "test",
    };

    await testEventResponseWrite(scenario, (event) => event.Stream(scenario.status, "text/test", scenario.body));
  });

  it("Blob", async () => {
    const scenario: ResponseScenario<Uint8Array> = {
      name: "blob",
      status: 234,
      headers: { "content-type": "text/test" },
      body: new TextEncoder().encode("test"),
      expectedStatus: 234,
      expectedHeaders: { "content-type": "text/test" },
      expectedBody: "test",
    };

    await testEventResponseWrite(scenario, (event) => event.Blob(scenario.status, "text/test", scenario.body));
  });

  it("NoContent", async () => {
    const scenario: ResponseScenario<null> = {
      name: "no content",
      status: 234,
      headers: { "content-type": "text/test" },
      body: null,
      expectedStatus: 234,
      expectedHeaders: { "content-type": "text/test" },
      expectedBody: "",
    };

    await testEventResponseWrite(scenario, (event) => event.NoContent(scenario.status));
  });

  it("Redirect", async () => {
    const scenarios: ResponseScenario<null>[] = [
      {
        name: "non-30x status",
        status: 200,
        body: null,
        expectedStatus: 200,
        expectedBody: "",
        expectedError: ErrInvalidRedirectStatusCode,
      },
      {
        name: "30x status",
        status: 302,
        headers: { location: "test" },
        body: null,
        expectedStatus: 302,
        expectedHeaders: { location: "example" },
        expectedBody: "",
      },
    ];

    for (const scenario of scenarios) {
      await testEventResponseWrite(scenario, (event) => event.Redirect(scenario.status, "example"));
    }
  });

  it("FileFS", async () => {
    const dir = mkdtempSync(join(tmpdir(), "EventFileFS"));
    try {
      writeFileSync(join(dir, "index.html"), "index");
      writeFileSync(join(dir, "test.txt"), "test");
      mkdirSync(join(dir, "sub1"), { recursive: true });
      writeFileSync(join(dir, "sub1", "index.html"), "sub1 index");
      mkdirSync(join(dir, "sub2"), { recursive: true });
      writeFileSync(join(dir, "sub2", "test.txt"), "sub2 test");

      const scenarios = [
        { name: "missing file", path: "", expected: "" },
        { name: "root with explicit file", path: "test.txt", expected: "test" },
        { name: "sub dir with no explicit file", path: "sub1", expected: "sub1 index" },
        { name: "sub dir with no explicit file (no index.html)", path: "sub2", expected: "" },
        { name: "sub dir explicit file", path: "sub2/test.txt", expected: "sub2 test" },
      ];

      for (const scenario of scenarios) {
        const event = new Event({ request: new Request("http://example.com/") });
        const result = await event.FileFS(dir, scenario.path);
        const expectErr = scenario.expected === "";

        if (expectErr) {
          expect(result).toBeInstanceOf(ApiError);
          continue;
        }

        expect(result).toBeInstanceOf(Response);
        const response = result as Response;
        const body = await response.text();
        expect(body).toBe(scenario.expected);
        expect(response.headers.get("content-length")).toBe(String(scenario.expected.length));
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("ApiError helpers", () => {
    const event = new Event({ request: new Request("http://example.com/") });
    const raw = { a: new Error("test"), b: "test" };

    const scenarios = [
      { err: event.Error(123, "message_test", raw), expectedStatus: 123 },
      { err: event.BadRequestError("message_test", raw), expectedStatus: 400 },
      { err: event.NotFoundError("message_test", raw), expectedStatus: 404 },
      { err: event.ForbiddenError("message_test", raw), expectedStatus: 403 },
      { err: event.UnauthorizedError("message_test", raw), expectedStatus: 401 },
      { err: event.TooManyRequestsError("message_test", raw), expectedStatus: 429 },
      { err: event.InternalServerError("message_test", raw), expectedStatus: 500 },
    ];

    for (const scenario of scenarios) {
      const result = JSON.stringify(scenario.err);
      const expected = `{"data":{"a":{"code":"validation_invalid_value","message":"Invalid value."},"b":{"code":"validation_invalid_value","message":"Invalid value."}},"message":"Message_test.","status":${scenario.expectedStatus}}`;
      expect(result).toBe(expected);
    }
  });

  it("BindBody", async () => {
    const empty = { a: 0, b: 0, c: "" };
    const queryDst = "a=123&b=-456&c=test";
    const xmlDst = `<?xml version="1.0" encoding="UTF-8"?><root><a>123</a><b>-456</b><c>test</c></root>`;
    const jsonDst = `{"a":123,"b":-456,"c":"test"}`;

    const form = new FormData();
    form.set("@jsonPayload", `{"a":123}`);
    form.set("b", "-456");
    form.set("c", "test");

    const scenarios = [
      { contentType: "", body: jsonDst, expect: empty, hasError: true },
      { contentType: "application/rtf", body: jsonDst, expect: empty, hasError: true },
      { contentType: "application/json", body: "", expect: empty, hasError: false, contentLength: "0" },
      { contentType: "application/json", body: jsonDst, expect: { a: 123, b: -456, c: "test" }, hasError: false },
      { contentType: "text/xml", body: xmlDst, expect: { a: 123, b: -456, c: "test" }, hasError: false },
      { contentType: "application/xml", body: xmlDst, expect: { a: 123, b: -456, c: "test" }, hasError: false },
      {
        contentType: "application/x-www-form-urlencoded",
        body: queryDst,
        expect: { a: 123, b: -456, c: "test" },
        hasError: false,
      },
    ];

    for (const scenario of scenarios) {
      const request = new Request("http://example.com/", {
        method: "POST",
        headers: {
          "content-type": scenario.contentType,
          ...(scenario.contentLength ? { "content-length": scenario.contentLength } : {}),
        },
        body: scenario.body,
      });
      const event = new Event({ request });
      const dest = { ...empty };

      let err: unknown = null;
      try {
        await event.bindBody(dest);
      } catch (error) {
        err = error;
      }

      expect(Boolean(err)).toBe(scenario.hasError);
      if (err) {
        expect(err).toBeInstanceOf(ApiError);
      }
      expect(dest).toEqual(scenario.expect);
    }

    const formRequest = await newMultipartRequest("http://example.com/", form);
    const formEvent = new Event({ request: formRequest });
    const formDest = { a: 0, b: 0, c: "" };
    await formEvent.bindBody(formDest);
    expect(formDest).toEqual({ a: 123, b: -456, c: "test" });

    const invalidPayloadForm = new FormData();
    invalidPayloadForm.set("@jsonPayload", "[]");
    const invalidRequest = await newMultipartRequest("http://example.com/", invalidPayloadForm);
    const invalidEvent = new Event({ request: invalidRequest });
    const invalidDest = { a: 0 };
    let invalidErr: unknown = null;
    try {
      await invalidEvent.bindBody(invalidDest);
    } catch (error) {
      invalidErr = error;
    }
    expect(Boolean(invalidErr)).toBe(true);
  });

  // unsupported content types are covered in the BindBody scenarios above.
});
