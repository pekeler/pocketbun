// Ported from pocketbase/apis/extensions_test.go.

import { describe, it } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ServeEvent } from "../core/events.ts";
import { runApiScenario, type ApiScenario } from "../tests/api.ts";
import { newTestApp } from "../tests/app.ts";

async function createExtensionRoot(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "pocketbun-ui-extension-"));
  for (const [name, contents] of Object.entries(files)) {
    await writeFile(join(root, name), contents, "utf8");
  }
  return root;
}

async function newExtensionsTestApp() {
  const started = await newTestApp();
  const roots = await Promise.all([
    createExtensionRoot({ "main.js": "ext1_main", "test.txt": "ext1_txt" }),
    createExtensionRoot({ "test.txt": "ext2_txt" }),
    createExtensionRoot({ "main.js": "ext3_main", "test.txt": "ext3_txt" }),
  ]);

  started.app.OnServe().BindFunc((event: ServeEvent) => {
    event.UIExtensions = [
      { Name: "ext1", FS: roots[0]! },
      { Name: "ext2", FS: roots[1]! },
      { Name: "ext3 with spaces", FS: roots[2]! },
    ];
    return event.Next();
  });

  return {
    app: started.app,
    cleanup: async () => {
      await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
      await started.cleanup();
    },
  };
}

const mainJsSuccessAfterTest: NonNullable<ApiScenario["afterTest"]> = async (_app, res) => {
  if (res.headers.get("content-type") !== "text/javascript") {
    throw new Error(`Expected Content-Type text/javascript, got ${res.headers.get("content-type")}`);
  }
};

describe("UI extensions main.js API", () => {
  const scenarios: ApiScenario[] = [
    {
      name: "no extensions",
      method: "GET",
      url: "/_/extensions.js",
      afterTest: mainJsSuccessAfterTest,
      expectedStatus: 200,
      expectedContent: [],
      expectedEvents: { "*": 0 },
    },
    {
      name: "with extensions",
      method: "GET",
      url: "/_/extensions.js",
      testAppFactory: newExtensionsTestApp,
      afterTest: mainJsSuccessAfterTest,
      expectedStatus: 200,
      expectedContent: ["(function(){ext1_main})();(function(){ext3_main})();"],
      expectedEvents: { "*": 0 },
    },
  ];

  for (const scenario of scenarios) {
    const name = scenario.name ?? `${scenario.method} ${scenario.url}`;
    it(name, async () => {
      await runApiScenario(scenario);
    });
  }
});

describe("UI extensions files API", () => {
  const scenarios: ApiScenario[] = [
    {
      name: "no extensions",
      method: "GET",
      url: "/_/extensions/ext1/test.txt",
      expectedStatus: 404,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "with missing extension file",
      method: "GET",
      url: "/_/extensions/ext1/missing",
      testAppFactory: newExtensionsTestApp,
      expectedStatus: 404,
      expectedContent: ['"data":{}'],
      expectedEvents: { "*": 0 },
    },
    {
      name: "with existing extension file (ext1)",
      method: "GET",
      url: "/_/extensions/ext1/test.txt",
      testAppFactory: newExtensionsTestApp,
      expectedStatus: 200,
      expectedContent: ["ext1_txt"],
      expectedEvents: { "*": 0 },
    },
    {
      name: "with existing extension file (extension name escape)",
      method: "GET",
      url: "/_/extensions/ext3%20with%20spaces/test.txt",
      testAppFactory: newExtensionsTestApp,
      expectedStatus: 200,
      expectedContent: ["ext3_txt"],
      expectedEvents: { "*": 0 },
    },
  ];

  for (const scenario of scenarios) {
    const name = scenario.name ?? `${scenario.method} ${scenario.url}`;
    it(name, async () => {
      await runApiScenario(scenario);
    });
  }
});
