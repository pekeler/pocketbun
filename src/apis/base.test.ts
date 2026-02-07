// Ported from pocketbase/apis/base_test.go.

import { describe, expect, it } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RequestEvent } from "../core/event_request.ts";
import { newTestApp } from "../tests/app.ts";
import { ApiError, ToApiError } from "../tools/router/api_error.ts";
import { MustSubFS, Static, StaticWildcardParam, WrapStdHandler, WrapStdMiddleware } from "./base.ts";

describe("apis base", () => {
  it("WrapStdHandler", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const request = new Request("http://localhost/");
      const event = new RequestEvent({ app, request });

      const response = await WrapStdHandler((_req, res) => {
        res?.write("test");
      })(event);

      const body = await response.text();
      expect(body).toBe("test");
    } finally {
      await cleanup();
    }
  });

  it("WrapStdMiddleware", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const request = new Request("http://localhost/");
      const event = new RequestEvent({ app, request });

      const result = await WrapStdMiddleware((handler) => {
        return (req, res) => {
          res?.write("test");
          return handler(req);
        };
      })(event);

      if (!(result instanceof Response)) {
        throw new Error("Expected Response");
      }

      const body = await result.text();
      expect(body).toBe("test");
    } finally {
      await cleanup();
    }
  });

  it("WrapStdHandler merges event response headers only when missing", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const request = new Request("http://localhost/");
      const event = new RequestEvent({ app, request });
      event.responseHeaders.set("X-PocketBun", "event");
      event.responseHeaders.set("X-Override", "event");

      const response = await WrapStdHandler(() => {
        return new Response("ok", {
          status: 201,
          headers: {
            "X-Override": "handler",
          },
        });
      })(event);

      expect(response.status).toBe(201);
      expect(await response.text()).toBe("ok");
      expect(response.headers.get("X-PocketBun")).toBe("event");
      expect(response.headers.get("X-Override")).toBe("handler");
    } finally {
      await cleanup();
    }
  });

  it("Static", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const dir = createTestDir();
      try {
        const fsys = { root: join(dir, "sub") };

        type StaticScenario = {
          path: string;
          indexFallback: boolean;
          expectedStatus: number;
          expectBody: string;
          expectError: boolean;
        };

        const scenarios: StaticScenario[] = [
          {
            path: "",
            indexFallback: false,
            expectedStatus: 200,
            expectBody: "sub index.html",
            expectError: false,
          },
          {
            path: "missing/a/b/c",
            indexFallback: false,
            expectedStatus: 404,
            expectBody: "",
            expectError: true,
          },
          {
            path: "missing/a/b/c",
            indexFallback: true,
            expectedStatus: 200,
            expectBody: "sub index.html",
            expectError: false,
          },
          {
            path: "testroot",
            indexFallback: false,
            expectedStatus: 404,
            expectBody: "",
            expectError: true,
          },
          {
            path: "test",
            indexFallback: false,
            expectedStatus: 200,
            expectBody: "sub test",
            expectError: false,
          },
          {
            path: "sub2",
            indexFallback: false,
            expectedStatus: 301,
            expectBody: "",
            expectError: false,
          },
          {
            path: "sub2/",
            indexFallback: false,
            expectedStatus: 200,
            expectBody: "sub2 index.html",
            expectError: false,
          },
          {
            path: "sub2/test",
            indexFallback: false,
            expectedStatus: 200,
            expectBody: "sub2 test",
            expectError: false,
          },
          {
            path: "sub2/test/",
            indexFallback: false,
            expectedStatus: 301,
            expectBody: "",
            expectError: false,
          },
        ];

        const dtp = [
          "/../",
          "\\../",
          "../",
          "../../",
          "..\\",
          "..\\..\\",
          "../..\\",
          "..\\..//",
          "%2e%2e%2f",
          "%2e%2e%2f%2e%2e%2f",
          "%2e%2e/",
          "%2e%2e/%2e%2e/",
          "..%2f",
          "..%2f..%2f",
          "%2e%2e%5c",
          "%2e%2e%5c%2e%2e%5c",
          "%2e%2e\\",
          "%2e%2e\\%2e%2e\\",
          "..%5c",
          "..%5c..%5c",
          "%252e%252e%255c",
          "%252e%252e%255c%252e%252e%255c",
          "..%255c",
          "..%255c..%255c",
        ];

        for (const p of dtp) {
          scenarios.push(
            {
              path: `${p}testroot`,
              indexFallback: false,
              expectedStatus: 404,
              expectBody: "",
              expectError: true,
            },
            {
              path: `${p}testroot`,
              indexFallback: true,
              expectedStatus: 200,
              expectBody: "sub index.html",
              expectError: false,
            },
          );
        }

        for (const [index, scenario] of scenarios.entries()) {
          const request = new Request(`http://localhost/${scenario.path}`);
          const event = new RequestEvent({
            app,
            request,
            params: { [StaticWildcardParam]: scenario.path },
          });

          const result = await Static(fsys, scenario.indexFallback)(event);
          const hasErr = result instanceof ApiError;

          expect(hasErr).toBe(scenario.expectError);

          if (result instanceof Response) {
            const body = await result.text();
            expect(result.status).toBe(scenario.expectedStatus);
            expect(body).toBe(scenario.expectBody);
          } else if (hasErr) {
            const apiErr = ToApiError(result);
            expect(apiErr.Status).toBe(scenario.expectedStatus);
          } else {
            throw new Error(`Unexpected result at scenario ${index}`);
          }
        }
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    } finally {
      await cleanup();
    }
  });

  it("MustSubFS", async () => {
    const dir = createTestDir();
    try {
      expect(hasPanicked(() => MustSubFS({ root: dir }, "/test/"))).toBe(true);
      expect(hasPanicked(() => MustSubFS({ root: dir }, "./////a/b/c"))).toBe(false);

      const sub = MustSubFS({ root: dir }, "sub");
      expect(() => statSync(join(sub.root, "test"))).not.toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

function hasPanicked(fn: () => void): boolean {
  try {
    fn();
    return false;
  } catch {
    return true;
  }
}

function createTestDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "test_dir"));

  writeFileSync(join(dir, "index.html"), "root index.html");
  writeFileSync(join(dir, "testroot"), "root test");

  mkdirSync(join(dir, "sub"), { recursive: true });
  writeFileSync(join(dir, "sub/index.html"), "sub index.html");
  writeFileSync(join(dir, "sub/test"), "sub test");

  mkdirSync(join(dir, "sub/sub2"), { recursive: true });
  writeFileSync(join(dir, "sub/sub2/index.html"), "sub2 index.html");
  writeFileSync(join(dir, "sub/sub2/test"), "sub2 test");

  return dir;
}
