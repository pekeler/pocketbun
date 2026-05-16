// PocketBun-only: verify pb_hooks/pb_migrations loader behavior since upstream lacks coverage.

import { describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildServeHandler } from "../../apis/serve.ts";
import { CollectionNameSuperusers } from "../../core/collection_model.ts";
import { TestApp, newTestApp } from "../../tests/app.ts";
import { Register, RegisterAsync } from "./jsvm.ts";

describe("jsvm loader", () => {
  it.serial("writes PocketBun reference declarations in generated types", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "pocketbun-jsvm-"));
    const dataDir = join(rootDir, "pb_data");
    const hooksDir = join(rootDir, "pb_hooks");
    const app = new TestApp({ dataDir, encryptionEnv: "pb_test_env" });
    const previousCwd = process.cwd();

    await mkdir(hooksDir, { recursive: true });

    try {
      process.chdir(rootDir);
      const err = Register(app, {
        HooksDir: hooksDir,
        TypesDir: rootDir,
      });
      expect(err).toBeNull();

      app.bootstrap();

      const types = await readFile(join(rootDir, "types.d.ts"), "utf8");
      const requiredSnippets = [
        "declare function unmarshal(data: any, dst: any): void;",
        "function fileFromPathAsync(path: string): Promise<filesystem.File>;",
        "function fileFromURLAsync(url: string, secTimeout?: number): Promise<filesystem.File>;",
        "function readFileAsync(name: string): Promise<string | Array<number>>;",
        "function sendAsync(config:",
        "PocketBun app cron expressions are interpreted in UTC",
        "support extra patterns such as `**`",
      ];

      for (const snippet of requiredSnippets) {
        expect(types).toContain(snippet);
      }
    } finally {
      process.chdir(previousCwd);
      app.resetBootstrapState();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it.serial("loads migration helper constructors and app.save() mapping", async () => {
    const { app, cleanup } = await newTestApp();
    const rootDir = await mkdtemp(join(tmpdir(), "pocketbun-jsvm-"));
    const hooksDir = join(rootDir, "pb_hooks");
    const migrationsDir = join(rootDir, "pb_migrations");

    await mkdir(hooksDir, { recursive: true });
    await mkdir(migrationsDir, { recursive: true });

    await writeFile(
      join(migrationsDir, "9999999998_collection_helper_test.js"),
      `migrate((app) => {
  const tasks = newBaseCollection("jsvm_tasks");
  tasks.Fields.add(new TextField({ name: "title", required: true }));
  tasks.listRule = "@request.auth.id != ''";
  app.save(tasks);
});
`,
    );

    try {
      const err = Register(app, {
        HooksDir: hooksDir,
        MigrationsDir: migrationsDir,
        TypesDir: rootDir,
      });
      expect(err).toBeNull();

      app.runAppMigrations();
      const tasks = app.FindCachedCollectionByNameOrId("jsvm_tasks");
      expect(tasks).not.toBeNull();
      expect(tasks?.Fields.GetByName("title")).not.toBeNull();
      expect(tasks?.ListRule).toBe("@request.auth.id != ''");
    } finally {
      await cleanup();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it.serial("loads hooks and migrations from pb_* directories", async () => {
    const { app, cleanup } = await newTestApp();
    const rootDir = await mkdtemp(join(tmpdir(), "pocketbun-jsvm-"));
    const hooksDir = join(rootDir, "pb_hooks");
    const migrationsDir = join(rootDir, "pb_migrations");

    await mkdir(hooksDir, { recursive: true });
    await mkdir(migrationsDir, { recursive: true });

    await writeFile(
      join(hooksDir, "hooks.pb.js"),
      `globalThis.__pbHooksCalls = 0;
routerAdd("GET", "/hooks-test", (e) => {
  e.response.header().set("X-Hooks-Test", "1");
  return e.json(200, { ok: true });
});
routerAdd("GET", "/hooks-request/{name}", (e) => {
  const originalName = e.request.pathValue("name");
  const search = e.request.url.query().get("search");
  const missingQuery = e.request.url.query().get("missing");
  const requestToken = e.request.header.get("X-Test-Token");
  const missingHeader = e.request.header.get("X-Missing");
  const manualRaw = originalName + "%2Fmanual";

  e.request.setPathValue("name", originalName + "_updated");
  const updatedName = e.request.pathValue("name");
  e.request.setPathValue("manual", manualRaw);
  const manualRoundtrip = e.request.pathValue("manual");

  e.response.header().set("X-Request-Compat", updatedName);
  return e.json(200, {
    path: e.request.url.path,
    originalName,
    updatedName,
    manualRaw,
    manualRoundtrip,
    search,
    missingQuery,
    requestToken,
    missingHeader
  });
});
onModelUpdate((e) => {
  globalThis.__pbHooksCalls++;
  e.next();
}, "demo2");
`,
    );

    await writeFile(
      join(migrationsDir, "9999999999_pb_hooks_test.js"),
      `migrate((app) => {
  app.db().exec("CREATE TABLE IF NOT EXISTS pb_hooks_test (id TEXT)");
});
`,
    );

    const err = Register(app, {
      HooksDir: hooksDir,
      MigrationsDir: migrationsDir,
      TypesDir: rootDir,
    });
    expect(err).toBeNull();

    app.runAppMigrations();
    const row = app.db().query("select name from sqlite_master where type='table' and name='pb_hooks_test'").get();
    expect(row).not.toBeNull();

    const handler = buildServeHandler(app);
    const response = await handler(new Request("http://127.0.0.1/hooks-test"));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-hooks-test")).toBe("1");
    expect(await response.json()).toEqual({ ok: true });

    const compatResponse = await handler(
      new Request("http://127.0.0.1/hooks-request/alice?search=demo", {
        headers: {
          "X-Test-Token": "abc123",
        },
      }),
    );
    expect(compatResponse.status).toBe(200);
    expect(compatResponse.headers.get("x-request-compat")).toBe("alice_updated");
    expect(await compatResponse.json()).toEqual({
      path: "/hooks-request/alice",
      originalName: "alice",
      updatedName: "alice_updated",
      manualRaw: "alice%2Fmanual",
      manualRoundtrip: "alice%2Fmanual",
      search: "demo",
      missingQuery: "",
      requestToken: "abc123",
      missingHeader: "",
    });

    const encodedCompatResponse = await handler(new Request("http://127.0.0.1/hooks-request/hello%20world"));
    expect(encodedCompatResponse.status).toBe(200);
    expect(encodedCompatResponse.headers.get("x-request-compat")).toBe("hello world_updated");
    expect(await encodedCompatResponse.json()).toEqual({
      path: "/hooks-request/hello%20world",
      originalName: "hello world",
      updatedName: "hello world_updated",
      manualRaw: "hello world%2Fmanual",
      manualRoundtrip: "hello world%2Fmanual",
      search: "",
      missingQuery: "",
      requestToken: "",
      missingHeader: "",
    });

    const malformedCompatResponse = await handler(new Request("http://127.0.0.1/hooks-request/a%ZZ"));
    expect(malformedCompatResponse.status).toBe(200);
    expect(malformedCompatResponse.headers.get("x-request-compat")).toBe("a%ZZ_updated");
    expect(await malformedCompatResponse.json()).toEqual({
      path: "/hooks-request/a%ZZ",
      originalName: "a%ZZ",
      updatedName: "a%ZZ_updated",
      manualRaw: "a%ZZ%2Fmanual",
      manualRoundtrip: "a%ZZ%2Fmanual",
      search: "",
      missingQuery: "",
      requestToken: "",
      missingHeader: "",
    });

    const record = app.FindFirstRecordByFilter("demo2", "1=1");
    record.Set("title", "update");
    const saveErr = await app.Save(record);
    expect(saveErr).toBeNull();
    expect((globalThis as Record<string, unknown>).__pbHooksCalls).toBe(1);

    delete (globalThis as Record<string, unknown>).__pbHooksCalls;
    await cleanup();
    await rm(rootDir, { recursive: true, force: true });
  });

  it.serial("supports relative imports in .pb.ts hooks", async () => {
    const { app, cleanup } = await newTestApp();
    const rootDir = await mkdtemp(join(tmpdir(), "pocketbun-jsvm-"));
    const hooksDir = join(rootDir, "pb_hooks");

    await mkdir(hooksDir, { recursive: true });
    await writeFile(join(hooksDir, "shared_value.ts"), `export const sharedValue = 3;\n`);
    await writeFile(
      join(hooksDir, "hooks.pb.ts"),
      `import { sharedValue } from "./shared_value.ts";
routerAdd("GET", "/hello", (e) => e.json(200, { sharedValue }));
`,
    );

    try {
      const err = await RegisterAsync(app, {
        HooksDir: hooksDir,
        TypesDir: rootDir,
      });
      expect(err).toBeNull();

      const handler = buildServeHandler(app);
      const response = await handler(new Request("http://127.0.0.1/hello"));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ sharedValue: 3 });
    } finally {
      await cleanup();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it.serial("supports dependency imports in .pb.ts hooks", async () => {
    const { app, cleanup } = await newTestApp();
    const rootDir = await mkdtemp(join(tmpdir(), "pocketbun-jsvm-"));
    const hooksDir = join(rootDir, "pb_hooks");
    const dependencyDir = join(rootDir, "node_modules", "pocketbun-hooks-dependency");

    await mkdir(hooksDir, { recursive: true });
    await mkdir(dependencyDir, { recursive: true });
    await writeFile(
      join(dependencyDir, "package.json"),
      JSON.stringify(
        {
          name: "pocketbun-hooks-dependency",
          type: "module",
          exports: "./index.js",
        },
        null,
        2,
      ),
    );
    await writeFile(join(dependencyDir, "index.js"), `export const dependencyMessage = "from dependency";\n`);
    await writeFile(
      join(hooksDir, "hooks.pb.ts"),
      `import { dependencyMessage } from "pocketbun-hooks-dependency";
routerAdd("GET", "/hello", (event) => event.json(200, { message: dependencyMessage }));
`,
    );

    try {
      const err = await RegisterAsync(app, {
        HooksDir: hooksDir,
        TypesDir: rootDir,
      });
      expect(err).toBeNull();

      const handler = buildServeHandler(app);
      const response = await handler(new Request("http://127.0.0.1/hello"));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ message: "from dependency" });
    } finally {
      await cleanup();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it.serial("supports onRecordUpdateRequest hooks that return e.next()", async () => {
    const { app, cleanup } = await newTestApp();
    const rootDir = await mkdtemp(join(tmpdir(), "pocketbun-jsvm-"));
    const hooksDir = join(rootDir, "pb_hooks");

    await mkdir(hooksDir, { recursive: true });
    await writeFile(
      join(hooksDir, "record-update.pb.js"),
      `onRecordUpdateRequest((e) => {
  if (e.record.get("title") != "") {
    e.record.set("title", "js_update");
  }

  return e.next();
}, "demo2");
`,
    );

    try {
      const err = await RegisterAsync(app, {
        HooksDir: hooksDir,
        TypesDir: rootDir,
      });
      expect(err).toBeNull();

      const record = app.FindFirstRecordByFilter("demo2", "1=1");
      expect(record).not.toBeNull();
      const id = record?.Id ?? "";

      const superuser = app.FindFirstRecordByFilter(CollectionNameSuperusers, "1=1");
      expect(superuser).not.toBeNull();
      const token = superuser?.NewAuthToken() ?? "";
      expect(token).not.toBe("");

      const handler = buildServeHandler(app);
      const response = await handler(
        new Request(`http://127.0.0.1/api/collections/demo2/records/${id}`, {
          method: "PATCH",
          headers: {
            Authorization: token,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ title: "hook_update" }),
        }),
      );

      expect(response.status).toBe(200);
      const body = (await response.json()) as { title?: string };
      expect(body.title).toBe("js_update");
    } finally {
      await cleanup();
      await rm(rootDir, { recursive: true, force: true });
    }
  });
});
