// Ported from pocketbase/apis/file_test.go

import { describe, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { FileField } from "../core/field_file.ts";
import { runApiScenario, type ApiScenario } from "../tests/api.ts";
import { newTestApp, type TestApp } from "../tests/app.ts";
import { Pointer } from "../tools/types/index.ts";
import { buildServeHandler } from "./serve.ts";

const userToken =
  "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjRxMXhsY2xtZmxva3UzMyIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoiX3BiX3VzZXJzX2F1dGhfIiwiZXhwIjoyNTI0NjA0NDYxLCJyZWZyZXNoYWJsZSI6dHJ1ZX0.ZT3F0Z3iM-xbGgSG3LEKiEzHrPHr8t8IuHLZGGNuxLo";
const superuserToken =
  "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InN5d2JoZWNuaDQ2cmhtMCIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoicGJjXzMxNDI2MzU4MjMiLCJleHAiOjI1MjQ2MDQ0NjEsInJlZnJlc2hhYmxlIjp0cnVlfQ.UXgO3j-0BumcugrFjbd7j0M4MQvbrLggLlcu_YNGjoY";

describe("file token", () => {
  const scenarios: ApiScenario[] = [
    {
      name: "unauthorized",
      method: "POST",
      url: "/api/files/token",
      expectedStatus: 401,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "regular user",
      method: "POST",
      url: "/api/files/token",
      headers: { Authorization: userToken },
      expectedStatus: 200,
      expectedContent: ['"token":"'],
      expectedEvents: { "*": 0, OnFileTokenRequest: 1 },
    },
    {
      name: "superuser",
      method: "POST",
      url: "/api/files/token",
      headers: { Authorization: superuserToken },
      expectedStatus: 200,
      expectedContent: ['"token":"'],
      expectedEvents: { "*": 0, OnFileTokenRequest: 1 },
    },
    {
      name: "hook token overwrite",
      method: "POST",
      url: "/api/files/token",
      headers: { Authorization: superuserToken },
      beforeTest: (app) => {
        app.OnFileTokenRequest().BindFunc((event: any) => {
          event.Token = "test";
          return event.Next();
        });
      },
      expectedStatus: 200,
      expectedContent: ['"token":"test"'],
      expectedEvents: { "*": 0, OnFileTokenRequest: 1 },
    },
  ];

  for (const scenario of scenarios) {
    const name = scenario.name ?? `${scenario.method}:${scenario.url}`;
    it(name, async () => {
      await runApiScenario(scenario);
    });
  }
});

type FileScenario = {
  name: string;
  method: string;
  url: string;
  expectedStatus: number;
  expectedBody?: Uint8Array | string[];
  expectedEvents?: Record<string, number>;
  beforeTest?: (app: TestApp) => void | Promise<void>;
};

const dataDir = fileURLToPath(new URL("../tests/data/", import.meta.url));

const testFile = readFileSync(join(dataDir, "storage/_pb_users_auth_/oap640cot4yru2s/test_kfd2wYLxkz.txt"));
const testImg = readFileSync(join(dataDir, "storage/_pb_users_auth_/4q1xlclmfloku33/300_1SEi6Q6U72.png"));
const testThumbCropCenter = readFileSync(
  join(dataDir, "storage/_pb_users_auth_/4q1xlclmfloku33/thumbs_300_1SEi6Q6U72.png/70x50_300_1SEi6Q6U72.png"),
);
const testThumbCropTop = readFileSync(
  join(dataDir, "storage/_pb_users_auth_/4q1xlclmfloku33/thumbs_300_1SEi6Q6U72.png/70x50t_300_1SEi6Q6U72.png"),
);
const testThumbCropBottom = readFileSync(
  join(dataDir, "storage/_pb_users_auth_/4q1xlclmfloku33/thumbs_300_1SEi6Q6U72.png/70x50b_300_1SEi6Q6U72.png"),
);
const testThumbFit = readFileSync(
  join(dataDir, "storage/_pb_users_auth_/4q1xlclmfloku33/thumbs_300_1SEi6Q6U72.png/70x50f_300_1SEi6Q6U72.png"),
);
const testThumbZeroWidth = readFileSync(
  join(dataDir, "storage/_pb_users_auth_/4q1xlclmfloku33/thumbs_300_1SEi6Q6U72.png/0x50_300_1SEi6Q6U72.png"),
);
const testThumbZeroHeight = readFileSync(
  join(dataDir, "storage/_pb_users_auth_/4q1xlclmfloku33/thumbs_300_1SEi6Q6U72.png/70x0_300_1SEi6Q6U72.png"),
);

describe("file download", () => {
  const scenarios: FileScenario[] = [
    {
      name: "missing collection",
      method: "GET",
      url: "/api/files/missing/4q1xlclmfloku33/300_1SEi6Q6U72.png",
      expectedStatus: 404,
      expectedBody: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "missing record",
      method: "GET",
      url: "/api/files/_pb_users_auth_/missing/300_1SEi6Q6U72.png",
      expectedStatus: 404,
      expectedBody: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "missing file",
      method: "GET",
      url: "/api/files/_pb_users_auth_/4q1xlclmfloku33/missing.png",
      expectedStatus: 404,
      expectedBody: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "existing image",
      method: "GET",
      url: "/api/files/_pb_users_auth_/4q1xlclmfloku33/300_1SEi6Q6U72.png",
      expectedStatus: 200,
      expectedBody: testImg,
      expectedEvents: { "*": 0, OnFileDownloadRequest: 1 },
    },
    {
      name: "existing image - missing thumb (should fallback to the original)",
      method: "GET",
      url: "/api/files/_pb_users_auth_/4q1xlclmfloku33/300_1SEi6Q6U72.png?thumb=999x999",
      beforeTest: (app) => {
        app.OnFileDownloadRequest().BindFunc((event: any) => {
          if (!event.ThumbError) {
            throw new Error("Expected thumb error, got nil");
          }
          return event.Next();
        });
      },
      expectedStatus: 200,
      expectedBody: testImg,
      expectedEvents: { "*": 0, OnFileDownloadRequest: 1 },
    },
    {
      name: "existing image - existing thumb (crop center)",
      method: "GET",
      url: "/api/files/_pb_users_auth_/4q1xlclmfloku33/300_1SEi6Q6U72.png?thumb=70x50",
      beforeTest: (app) => {
        app.OnFileDownloadRequest().BindFunc((event: any) => {
          if (event.ThumbError) {
            throw new Error(`Expected no thumb error, got ${event.ThumbError}`);
          }
          return event.Next();
        });
      },
      expectedStatus: 200,
      expectedBody: testThumbCropCenter,
      expectedEvents: { "*": 0, OnFileDownloadRequest: 1 },
    },
    {
      name: "existing image - existing thumb (crop top)",
      method: "GET",
      url: "/api/files/_pb_users_auth_/4q1xlclmfloku33/300_1SEi6Q6U72.png?thumb=70x50t",
      beforeTest: (app) => {
        app.OnFileDownloadRequest().BindFunc((event: any) => {
          if (event.ThumbError) {
            throw new Error(`Expected no thumb error, got ${event.ThumbError}`);
          }
          return event.Next();
        });
      },
      expectedStatus: 200,
      expectedBody: testThumbCropTop,
      expectedEvents: { "*": 0, OnFileDownloadRequest: 1 },
    },
    {
      name: "existing image - existing thumb (crop bottom)",
      method: "GET",
      url: "/api/files/_pb_users_auth_/4q1xlclmfloku33/300_1SEi6Q6U72.png?thumb=70x50b",
      beforeTest: (app) => {
        app.OnFileDownloadRequest().BindFunc((event: any) => {
          if (event.ThumbError) {
            throw new Error(`Expected no thumb error, got ${event.ThumbError}`);
          }
          return event.Next();
        });
      },
      expectedStatus: 200,
      expectedBody: testThumbCropBottom,
      expectedEvents: { "*": 0, OnFileDownloadRequest: 1 },
    },
    {
      name: "existing image - existing thumb (fit)",
      method: "GET",
      url: "/api/files/_pb_users_auth_/4q1xlclmfloku33/300_1SEi6Q6U72.png?thumb=70x50f",
      beforeTest: (app) => {
        app.OnFileDownloadRequest().BindFunc((event: any) => {
          if (event.ThumbError) {
            throw new Error(`Expected no thumb error, got ${event.ThumbError}`);
          }
          return event.Next();
        });
      },
      expectedStatus: 200,
      expectedBody: testThumbFit,
      expectedEvents: { "*": 0, OnFileDownloadRequest: 1 },
    },
    {
      name: "existing image - existing thumb (zero width)",
      method: "GET",
      url: "/api/files/_pb_users_auth_/4q1xlclmfloku33/300_1SEi6Q6U72.png?thumb=0x50",
      beforeTest: (app) => {
        app.OnFileDownloadRequest().BindFunc((event: any) => {
          if (event.ThumbError) {
            throw new Error(`Expected no thumb error, got ${event.ThumbError}`);
          }
          return event.Next();
        });
      },
      expectedStatus: 200,
      expectedBody: testThumbZeroWidth,
      expectedEvents: { "*": 0, OnFileDownloadRequest: 1 },
    },
    {
      name: "existing image - existing thumb (zero height)",
      method: "GET",
      url: "/api/files/_pb_users_auth_/4q1xlclmfloku33/300_1SEi6Q6U72.png?thumb=70x0",
      beforeTest: (app) => {
        app.OnFileDownloadRequest().BindFunc((event: any) => {
          if (event.ThumbError) {
            throw new Error(`Expected no thumb error, got ${event.ThumbError}`);
          }
          return event.Next();
        });
      },
      expectedStatus: 200,
      expectedBody: testThumbZeroHeight,
      expectedEvents: { "*": 0, OnFileDownloadRequest: 1 },
    },
    {
      name: "existing non image file - thumb parameter should be ignored",
      method: "GET",
      url: "/api/files/_pb_users_auth_/oap640cot4yru2s/test_kfd2wYLxkz.txt?thumb=100x100",
      beforeTest: (app) => {
        app.OnFileDownloadRequest().BindFunc((event: any) => {
          if (!event.ThumbError) {
            throw new Error("Expected thumb error, got nil");
          }
          return event.Next();
        });
      },
      expectedStatus: 200,
      expectedBody: testFile,
      expectedEvents: { "*": 0, OnFileDownloadRequest: 1 },
    },

    {
      name: "protected file - superuser with expired file token",
      method: "GET",
      url: "/api/files/demo1/al1h9ijdeojtsjy/300_Jsjq7RdBgA.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InN5d2JoZWNuaDQ2cmhtMCIsImV4cCI6MTY0MDk5MTY2MSwidHlwZSI6ImZpbGUiLCJjb2xsZWN0aW9uSWQiOiJwYmNfMzE0MjYzNTgyMyJ9.nqqtqpPhxU0045F4XP_ruAkzAidYBc5oPy9ErN3XBq0",
      expectedStatus: 404,
      expectedBody: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "protected file - superuser with valid file token",
      method: "GET",
      url: "/api/files/demo1/al1h9ijdeojtsjy/300_Jsjq7RdBgA.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InN5d2JoZWNuaDQ2cmhtMCIsImV4cCI6MjUyNDYwNDQ2MSwidHlwZSI6ImZpbGUiLCJjb2xsZWN0aW9uSWQiOiJwYmNfMzE0MjYzNTgyMyJ9.Lupz541xRvrktwkrl55p5pPCF77T69ZRsohsIcb2dxc",
      expectedStatus: 200,
      expectedBody: ["PNG"],
      expectedEvents: { "*": 0, OnFileDownloadRequest: 1 },
    },
    {
      name: "protected file - guest without view access",
      method: "GET",
      url: "/api/files/demo1/al1h9ijdeojtsjy/300_Jsjq7RdBgA.png",
      expectedStatus: 404,
      expectedBody: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "protected file - guest with view access",
      method: "GET",
      url: "/api/files/demo1/al1h9ijdeojtsjy/300_Jsjq7RdBgA.png",
      beforeTest: async (app) => {
        let collection: ReturnType<TestApp["FindCachedCollectionByNameOrId"]> | null = null;
        try {
          collection = app.FindCachedCollectionByNameOrId("demo1");
        } catch {
          collection = null;
        }
        if (!collection) {
          throw new Error("Failed to fetch mock collection");
        }
        collection.viewRule = Pointer("");
        const err = await app.UnsafeWithoutHooks().Save(collection);
        if (err) {
          throw new Error(`Failed to update mock collection: ${err.message}`);
        }
      },
      expectedStatus: 200,
      expectedBody: ["PNG"],
      expectedEvents: { "*": 0, OnFileDownloadRequest: 1 },
    },
    {
      name: "protected file - auth record without view access",
      method: "GET",
      url: "/api/files/demo1/al1h9ijdeojtsjy/300_Jsjq7RdBgA.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjRxMXhsY2xtZmxva3UzMyIsImV4cCI6MjUyNDYwNDQ2MSwidHlwZSI6ImZpbGUiLCJjb2xsZWN0aW9uSWQiOiJfcGJfdXNlcnNfYXV0aF8ifQ.nSTLuCPcGpWn2K2l-BFkC3Vlzc-ZTDPByYq8dN1oPSo",
      beforeTest: async (app) => {
        let collection: ReturnType<TestApp["FindCachedCollectionByNameOrId"]> | null = null;
        try {
          collection = app.FindCachedCollectionByNameOrId("demo1");
        } catch {
          collection = null;
        }
        if (!collection) {
          throw new Error("Failed to fetch mock collection");
        }
        collection.viewRule = Pointer("@request.auth.verified = true");
        const err = await app.UnsafeWithoutHooks().Save(collection);
        if (err) {
          throw new Error(`Failed to update mock collection: ${err.message}`);
        }
      },
      expectedStatus: 404,
      expectedBody: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "protected file - auth record with view access",
      method: "GET",
      url: "/api/files/demo1/al1h9ijdeojtsjy/300_Jsjq7RdBgA.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjRxMXhsY2xtZmxva3UzMyIsImV4cCI6MjUyNDYwNDQ2MSwidHlwZSI6ImZpbGUiLCJjb2xsZWN0aW9uSWQiOiJfcGJfdXNlcnNfYXV0aF8ifQ.nSTLuCPcGpWn2K2l-BFkC3Vlzc-ZTDPByYq8dN1oPSo",
      beforeTest: async (app) => {
        let collection: ReturnType<TestApp["FindCachedCollectionByNameOrId"]> | null = null;
        try {
          collection = app.FindCachedCollectionByNameOrId("demo1");
        } catch {
          collection = null;
        }
        if (!collection) {
          throw new Error("Failed to fetch mock collection");
        }
        collection.viewRule = Pointer("@request.auth.verified = false");
        const err = await app.UnsafeWithoutHooks().Save(collection);
        if (err) {
          throw new Error(`Failed to update mock collection: ${err.message}`);
        }
      },
      expectedStatus: 200,
      expectedBody: ["PNG"],
      expectedEvents: { "*": 0, OnFileDownloadRequest: 1 },
    },
    {
      name: "protected file in view (view's View API rule failure)",
      method: "GET",
      url: "/api/files/view1/al1h9ijdeojtsjy/300_Jsjq7RdBgA.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjRxMXhsY2xtZmxva3UzMyIsImV4cCI6MjUyNDYwNDQ2MSwidHlwZSI6ImZpbGUiLCJjb2xsZWN0aW9uSWQiOiJfcGJfdXNlcnNfYXV0aF8ifQ.nSTLuCPcGpWn2K2l-BFkC3Vlzc-ZTDPByYq8dN1oPSo",
      expectedStatus: 404,
      expectedBody: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "protected file in view (view's View API rule success)",
      method: "GET",
      url: "/api/files/view1/84nmscqy84lsi1t/test_d61b33QdDU.txt?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjRxMXhsY2xtZmxva3UzMyIsImV4cCI6MjUyNDYwNDQ2MSwidHlwZSI6ImZpbGUiLCJjb2xsZWN0aW9uSWQiOiJfcGJfdXNlcnNfYXV0aF8ifQ.nSTLuCPcGpWn2K2l-BFkC3Vlzc-ZTDPByYq8dN1oPSo",
      expectedStatus: 200,
      expectedBody: ["test"],
      expectedEvents: { "*": 0, OnFileDownloadRequest: 1 },
    },
    {
      name: "RateLimit rule - users:file",
      method: "GET",
      url: "/api/files/_pb_users_auth_/4q1xlclmfloku33/300_1SEi6Q6U72.png",
      beforeTest: (app) => {
        app.settings().rateLimits.enabled = true;
        app.settings().rateLimits.rules = [
          { maxRequests: 100, label: "abc", duration: 1 },
          { maxRequests: 100, label: "*:file", duration: 1 },
          { maxRequests: 0, label: "users:file", duration: 1 },
        ];
      },
      expectedStatus: 429,
      expectedBody: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "RateLimit rule - *:file",
      method: "GET",
      url: "/api/files/_pb_users_auth_/4q1xlclmfloku33/300_1SEi6Q6U72.png",
      beforeTest: (app) => {
        app.settings().rateLimits.enabled = true;
        app.settings().rateLimits.rules = [
          { maxRequests: 100, label: "abc", duration: 1 },
          { maxRequests: 0, label: "*:file", duration: 1 },
        ];
      },
      expectedStatus: 429,
      expectedBody: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
  ];

  for (const scenario of scenarios) {
    const headScenario: FileScenario = {
      ...scenario,
      method: "HEAD",
      name: `(HEAD) ${scenario.name}`,
      expectedBody: undefined,
    };

    it(headScenario.name, async () => {
      await runFileScenario(headScenario);
    });

    it(scenario.name, async () => {
      await runFileScenario(scenario);
    });
  }
});

describe("concurrent thumbs generation", () => {
  it("creates new thumbs", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const fsys = app.NewFilesystem();

      let demo1: ReturnType<TestApp["FindCachedCollectionByNameOrId"]> | null = null;
      try {
        demo1 = app.FindCachedCollectionByNameOrId("demo1");
      } catch {
        demo1 = null;
      }
      if (!demo1) {
        throw new Error("Failed to fetch demo1 collection");
      }

      const fileField = demo1.Fields.GetByName("file_one") as FileField | null;
      if (!fileField) {
        throw new Error("Failed to fetch demo1 file field");
      }

      fileField.Protected = false;
      fileField.MaxSelect = 1;
      fileField.MaxSize = 999_999;
      fileField.Thumbs = ["111x111", "111x222", "111x333"];
      demo1.Fields.Add(fileField);

      const saveErr = await app.Save(demo1);
      if (saveErr) {
        throw saveErr;
      }

      const fileKey = "wsmn24bux7wo113/al1h9ijdeojtsjy/300_Jsjq7RdBgA.png";
      const urls = [
        `/api/files/${fileKey}?thumb=111x111`,
        `/api/files/${fileKey}?thumb=111x111`,
        `/api/files/${fileKey}?thumb=111x222`,
        `/api/files/${fileKey}?thumb=111x333`,
      ];

      const handler = buildServeHandler(app);
      await Promise.all(
        urls.map((url) => {
          const requestUrl = new URL(url, "http://localhost").toString();
          return handler(new Request(requestUrl));
        }),
      );

      const thumbKeys = [
        "wsmn24bux7wo113/al1h9ijdeojtsjy/thumbs_300_Jsjq7RdBgA.png/111x111_300_Jsjq7RdBgA.png",
        "wsmn24bux7wo113/al1h9ijdeojtsjy/thumbs_300_Jsjq7RdBgA.png/111x222_300_Jsjq7RdBgA.png",
        "wsmn24bux7wo113/al1h9ijdeojtsjy/thumbs_300_Jsjq7RdBgA.png/111x333_300_Jsjq7RdBgA.png",
      ];

      for (const key of thumbKeys) {
        if (!(await fsys.Exists(key))) {
          throw new Error(`Missing thumb ${JSON.stringify(key)}`);
        }
      }
    } finally {
      await cleanup();
    }
  });
});

async function runFileScenario(scenario: FileScenario): Promise<void> {
  const { app, cleanup } = await newTestApp();

  try {
    if (scenario.beforeTest) {
      await scenario.beforeTest(app);
    }

    app.resetEventCalls();

    const handler = buildServeHandler(app);
    const requestUrl = new URL(scenario.url, "http://localhost").toString();
    const response = await handler(new Request(requestUrl, { method: scenario.method }));

    if (response.status !== scenario.expectedStatus) {
      throw new Error(`Expected status ${scenario.expectedStatus}, got ${response.status}`);
    }

    if (scenario.expectedBody instanceof Uint8Array) {
      const body = new Uint8Array(await response.arrayBuffer());
      if (body.length !== scenario.expectedBody.length) {
        throw new Error(`Expected body length ${scenario.expectedBody.length}, got ${body.length}`);
      }
      for (let i = 0; i < body.length; i += 1) {
        if (body[i] !== scenario.expectedBody[i]) {
          throw new Error("Response body mismatch");
        }
      }
    } else if (Array.isArray(scenario.expectedBody)) {
      const bodyText = normalizeBody(await response.text());
      for (const item of scenario.expectedBody) {
        if (!bodyText.includes(item)) {
          throw new Error(`Cannot find ${item} in response body ${bodyText}`);
        }
      }
    } else {
      const body = await response.arrayBuffer();
      if (body.byteLength !== 0) {
        throw new Error(`Expected empty body, got ${body.byteLength} bytes`);
      }
    }

    const expectedEvents = scenario.expectedEvents ?? {};
    const remainingEvents: Record<string, number> = { ...app.eventCalls };
    let noOtherEvents = false;
    for (const [eventName, expectedCount] of Object.entries(expectedEvents)) {
      if (eventName === "*" && expectedCount <= 0) {
        noOtherEvents = true;
        continue;
      }
      const actualCount = remainingEvents[eventName] ?? 0;
      if (actualCount !== expectedCount) {
        throw new Error(`Expected event ${eventName} to be called ${expectedCount}, got ${actualCount}`);
      }
      delete remainingEvents[eventName];
    }
    if (noOtherEvents && Object.keys(remainingEvents).length > 0) {
      throw new Error(`Missing expected remaining events: ${JSON.stringify(remainingEvents)}`);
    }
  } finally {
    await cleanup();
  }
}

function normalizeBody(body: string): string {
  if (body.trim() === "") {
    return body;
  }

  try {
    return JSON.stringify(JSON.parse(body));
  } catch {
    return body;
  }
}
