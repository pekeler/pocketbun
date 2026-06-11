// Ported from pocketbase/plugins/jsvm/binds_test.go

import { describe, expect, it, setDefaultTimeout } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { buildServeHandler } from "../../apis/serve.ts";
import { Collection } from "../../core/collection_model.ts";
import { AutodateField } from "../../core/field_autodate.ts";
import { BoolField } from "../../core/field_bool.ts";
import { DateField } from "../../core/field_date.ts";
import { EditorField } from "../../core/field_editor.ts";
import { EmailField } from "../../core/field_email.ts";
import { FileField } from "../../core/field_file.ts";
import { GeoPointField } from "../../core/field_geo_point.ts";
import { JSONField } from "../../core/field_json.ts";
import { NumberField } from "../../core/field_number.ts";
import { PasswordField, PasswordFieldValue } from "../../core/field_password.ts";
import { RelationField } from "../../core/field_relation.ts";
import { SelectField } from "../../core/field_select.ts";
import { TextField } from "../../core/field_text.ts";
import { URLField } from "../../core/field_url.ts";
import { FieldsList } from "../../core/fields_list.ts";
import { Record as RecordModel } from "../../core/record_model.ts";
import { ValidationError } from "../../internal/compat/validation.ts";
import { TestApp, newTestApp } from "../../tests/app.ts";
import { newTempDir } from "../../tests/fs.ts";
import { File } from "../../tools/filesystem/file.ts";
import { System } from "../../tools/filesystem/filesystem.ts";
import { ApiError } from "../../tools/router/api_error.ts";
import { JSONRaw } from "../../tools/types/index.ts";
import {
  BindApis,
  BindCore,
  BindDbx,
  BindFilesystem,
  BindFilepath,
  BindForms,
  BindHTTP,
  BindMails,
  BindOS,
  BindSecurity,
  apisBinds,
  appBinds,
  baseBinds,
  cronBinds,
  dbxBinds,
  filesystemBinds,
  formsBinds,
  hooksBinds,
  httpClientBinds,
  mailsBinds,
  osBinds,
  filepathBinds,
  routerBinds,
  securityBinds,
} from "./binds.ts";

setDefaultTimeout(15000);

type BindScope = Record<string, any>;
const generatedTypesUrl = new URL("./internal/types/generated/types.d.ts", import.meta.url);
type StartedExternalServer = {
  port: number;
  stop: () => Promise<void>;
  [Symbol.asyncDispose]: () => Promise<void>;
};

function extractNamespace(source: string, namespaceName: string): string {
  const markers = [
    `declare namespace ${namespaceName} {`,
    `namespace ${namespaceName} {`,
    `declare namespace $${namespaceName} {`,
    `namespace $${namespaceName} {`,
  ];

  let marker = "";
  let start = -1;
  for (const candidate of markers) {
    const index = source.indexOf(candidate);
    if (index === -1) {
      continue;
    }
    if (start === -1 || index < start) {
      marker = candidate;
      start = index;
    }
  }

  if (start === -1 || !marker) {
    return "";
  }

  const rest = source.slice(start + marker.length);
  const nextNamespaceStarts = [rest.indexOf("\ndeclare namespace "), rest.indexOf("\nnamespace ")].filter(
    (index) => index >= 0,
  );
  if (nextNamespaceStarts.length === 0) {
    return source.slice(start);
  }
  const nextNamespaceStart = Math.min(...nextNamespaceStarts);

  return source.slice(start, start + marker.length + nextNamespaceStart);
}

function extractInterfaceMethodNames(source: string, interfaceName: string): string[] {
  const methodNames = new Set<string>();
  const startToken = `interface ${interfaceName} {`;
  let offset = 0;

  while (offset < source.length) {
    const start = source.indexOf(startToken, offset);
    if (start === -1) {
      break;
    }

    const end = source.indexOf("\n  }", start);
    if (end === -1) {
      break;
    }

    const block = source.slice(start, end);
    const methodMatches = block.matchAll(/\n\s*([A-Za-z_][A-Za-z0-9_]*)\s*\(/g);
    for (const match of methodMatches) {
      methodNames.add(match[1] ?? "");
    }

    offset = end + 4;
  }

  return [...methodNames].filter(Boolean).sort();
}

function extractInterfacePropertyNames(source: string, interfaceName: string): string[] {
  const propertyNames = new Set<string>();
  const startToken = `interface ${interfaceName} {`;
  let offset = 0;

  while (offset < source.length) {
    const start = source.indexOf(startToken, offset);
    if (start === -1) {
      break;
    }

    const end = source.indexOf("\n  }", start);
    if (end === -1) {
      break;
    }

    const block = source.slice(start, end);
    const propertyMatches = block.matchAll(/\n\s*([A-Za-z_][A-Za-z0-9_]*)\s*:\s*[^;\n]+;/g);
    for (const match of propertyMatches) {
      propertyNames.add(match[1] ?? "");
    }

    offset = end + 4;
  }

  return [...propertyNames].filter(Boolean).sort();
}

async function startExternalServer(script: string): Promise<StartedExternalServer> {
  const maxAttempts = 15;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await startExternalServerOnce(script);
    } catch (error) {
      if (attempt === maxAttempts || !isTransientServerStartError(error)) {
        throw error;
      }
      await Bun.sleep(Math.min(attempt * 25, 250));
    }
  }

  throw new Error("Failed to start external test server.");
}

async function startExternalServerOnce(script: string): Promise<StartedExternalServer> {
  const process = Bun.spawn({
    cmd: ["bun", "-e", script],
    stdout: "pipe",
    stderr: "pipe",
  });

  if (!process.stdout || typeof process.stdout === "number") {
    throw new Error("Failed to start test server: missing stdout.");
  }

  const reader = process.stdout.getReader();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    buffer += new TextDecoder().decode(value);
    const newlineIndex = buffer.indexOf("\n");
    if (newlineIndex >= 0) {
      buffer = buffer.slice(0, newlineIndex).trim();
      break;
    }
  }

  const port = Number(buffer.trim());
  if (!Number.isFinite(port) || port <= 0) {
    const stderr = await readExternalServerStderr(process);
    process.kill();
    await process.exited;
    throw new Error(`Failed to read server port. Output: ${buffer}\n${stderr}`);
  }

  try {
    await waitForExternalServerReady(port);
  } catch (error) {
    const stderr = await readExternalServerStderr(process);
    process.kill();
    await process.exited;
    throw new Error(`Failed to start test server on port ${port}: ${String(error)}\n${stderr}`);
  }

  const stop = async () => {
    process.kill();
    await process.exited;
  };

  return {
    port,
    stop,
    [Symbol.asyncDispose]: stop,
  };
}

async function readExternalServerStderr(process: ReturnType<typeof Bun.spawn>): Promise<string> {
  if (!process.stderr || typeof process.stderr === "number") {
    return "";
  }

  const errReader = process.stderr.getReader();
  const { value } = await errReader.read();
  if (!value) {
    return "";
  }
  return new TextDecoder().decode(value);
}

async function waitForExternalServerReady(port: number): Promise<void> {
  const maxAttempts = 50;
  const url = `http://127.0.0.1:${port}/`;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(500) });
      await response.arrayBuffer();
      return;
    } catch (error) {
      if (attempt === maxAttempts || !isTransientServerStartError(error)) {
        throw error;
      }
      await Bun.sleep(Math.min(attempt * 10, 100));
    }
  }
}

function isTransientServerStartError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.includes("Failed to start server") ||
    error.message.includes("Failed to read server port") ||
    error.message.includes("Failed to start test server on port") ||
    error.message.includes("Failed to listen at") ||
    error.message.includes("Was there a typo in the url or port?") ||
    error.message.includes("ECONNREFUSED") ||
    error.message.includes("EADDRINUSE") ||
    error.message.includes("EPERM") ||
    error.message.includes("EACCES")
  );
}

function countKeys(target: unknown): number {
  if (!target || typeof target !== "object") {
    return 0;
  }
  return Object.keys(target as Record<string, unknown>).length;
}

function arraysEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

function getNestedVal(data: unknown, path: string): unknown {
  const parts = path.split(".");
  let result: any = data;
  for (const part of parts) {
    if (result == null || (typeof result !== "object" && !Array.isArray(result))) {
      return null;
    }
    result = result[part];
  }
  return result ?? null;
}

function newUnbootstrappedTestApp(): TestApp {
  // Upstream bind tests usually bootstrap a full app, but count-only assertions here
  // don't depend on fixtures and are much less flaky on Windows without full bootstrap.
  return new TestApp({ dataDir: ".pb_test_unbootstrapped", encryptionEnv: "pb_test_env" });
}

describe("jsvm binds", () => {
  it("exports upper-camel bind aliases", () => {
    expect(BindCore).toBe(baseBinds);
    expect(BindDbx).toBe(dbxBinds);
    expect(BindSecurity).toBe(securityBinds);
    expect(BindOS).toBe(osBinds);
    expect(BindFilepath).toBe(filepathBinds);
    expect(BindHTTP).toBe(httpClientBinds);
    expect(BindFilesystem).toBe(filesystemBinds);
    expect(BindForms).toBe(formsBinds);
    expect(BindMails).toBe(mailsBinds);
    expect(BindApis).toBe(apisBinds);
  });

  it("base binds count", () => {
    const scope: BindScope = {};
    baseBinds(scope);
    expect(countKeys(scope)).toBe(45);
  });

  it("base binds sleep", () => {
    const scope: BindScope = {};
    baseBinds(scope);
    const start = Date.now();
    scope.sleep(100);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(100);
    expect(elapsed).toBeLessThanOrEqual(350);
  });

  it("base binds readerToString", () => {
    const scope: BindScope = {};
    baseBinds(scope);
    const reader = new TextEncoder().encode("test");
    const result = scope.readerToString(reader);
    expect(result).toBe("test");
  });

  it("base binds toString", () => {
    const scope: BindScope = {};
    baseBinds(scope);

    const structValue: Record<string, unknown> = { Name: "123" };
    Object.defineProperty(structValue, "private", { value: "456", enumerable: false });

    const scenarios: Array<{ name: string; value: unknown; expected: string }> = [
      { name: "null", value: null, expected: "" },
      { name: "string", value: "test", expected: "test" },
      { name: "number", value: -12.4, expected: "-12.4" },
      { name: "bool", value: true, expected: "true" },
      { name: "arr", value: [1, 2, 3], expected: "[1,2,3]" },
      { name: "obj", value: { test: 123 }, expected: '{"test":123}' },
      { name: "reader", value: new TextEncoder().encode("test"), expected: "test" },
      { name: "struct", value: structValue, expected: '{"Name":"123"}' },
    ];

    for (const scenario of scenarios) {
      const result = scope["toString"](scenario.value);
      expect(result).toBe(scenario.expected);
    }
  });

  it("base binds toBytes", () => {
    const scope: BindScope = {};
    baseBinds(scope);

    const structValue: Record<string, unknown> = { Name: "123" };
    Object.defineProperty(structValue, "private", { value: "456", enumerable: false });

    const scenarios: Array<{ name: string; value: unknown; expected: number[] }> = [
      { name: "null", value: null, expected: [] },
      { name: "string", value: "test", expected: Array.from(new TextEncoder().encode("test")) },
      { name: "number", value: -12.4, expected: Array.from(new TextEncoder().encode("-12.4")) },
      { name: "bool", value: true, expected: Array.from(new TextEncoder().encode("true")) },
      { name: "arr", value: [1, 2, 3], expected: [1, 2, 3] },
      { name: "jsonraw", value: JSONRaw.parse([1, 2, 3]), expected: [1, 2, 3] },
      { name: "reader", value: new TextEncoder().encode("test"), expected: Array.from(new TextEncoder().encode("test")) },
      { name: "obj", value: { test: 123 }, expected: Array.from(new TextEncoder().encode('{"test":123}')) },
      { name: "struct", value: structValue, expected: Array.from(new TextEncoder().encode('{"Name":"123"}')) },
    ];

    for (const scenario of scenarios) {
      const result = scope.toBytes(scenario.value);
      expect(Array.isArray(result)).toBe(true);
      expect(arraysEqual(result, scenario.expected)).toBe(true);
    }
  });

  it("base binds unmarshal", () => {
    const scope: BindScope = {};
    baseBinds(scope);
    const data: Record<string, unknown> = { a: 123 };
    scope.unmarshal({ b: 456 }, data);
    expect(data.a).toBe(123);
    expect(data.b).toBe(456);
  });

  it("base binds unmarshal follows upstream plain object merge semantics", () => {
    const scope: BindScope = {};
    baseBinds(scope);

    const data: Record<string, unknown> = {
      a: 123,
      nested: { subject: "keep", body: "old" },
      items: [1, 2, 3],
      nullable: "value",
    };

    scope.unmarshal(
      {
        b: 456,
        nested: { body: "changed" },
        items: [9],
        nullable: null,
        omitted: undefined,
      },
      data,
    );

    expect(data.a).toBe(123);
    expect(data.b).toBe(456);
    expect(data.nested).toEqual({ body: "changed" });
    expect(data.items).toEqual([9]);
    expect(data.nullable).toBeNull();
    expect(Object.prototype.hasOwnProperty.call(data, "omitted")).toBe(false);
  });

  it("base binds unmarshal delegates to target JSON unmarshal hooks", () => {
    const scope: BindScope = {};
    baseBinds(scope);
    const data = {
      nested: { subject: "keep", body: "old" },
      UnmarshalJSON(raw: string): Error | null {
        const parsed = JSON.parse(raw) as { nested?: { subject?: string; body?: string } };
        if (Object.prototype.hasOwnProperty.call(parsed.nested ?? {}, "subject")) {
          this.nested.subject = parsed.nested?.subject ?? "";
        }
        if (Object.prototype.hasOwnProperty.call(parsed.nested ?? {}, "body")) {
          this.nested.body = parsed.nested?.body ?? "";
        }
        return null;
      },
    };

    scope.unmarshal({ nested: { body: "changed" } }, data);

    expect(data.nested.subject).toBe("keep");
    expect(data.nested.body).toBe("changed");
  });

  it("base binds unmarshal propagates target JSON unmarshal errors", () => {
    const scope: BindScope = {};
    baseBinds(scope);
    const data = {
      UnmarshalJSON(): Error {
        return new Error("custom unmarshal failure");
      },
    };

    expect(() => scope.unmarshal({ a: 123 }, data)).toThrow("custom unmarshal failure");
  });

  it("base binds unmarshal applies collection JSON semantics", () => {
    const scope: BindScope = {};
    baseBinds(scope);

    const collection = new scope.Collection({
      type: "auth",
      name: "test_users",
      authRule: "@request.auth.id != ''",
      indexes: ["CREATE INDEX idx_old ON test_users (email)"],
      fields: [
        { id: "title_id", name: "title", type: "text" },
        { id: "score_id", name: "score", type: "number", min: 1, max: 10 },
      ],
      authAlert: {
        enabled: true,
        emailTemplate: {
          subject: "Original subject",
          body: "<p>Original body</p>",
        },
      },
      oauth2: {
        enabled: true,
        mappedFields: {
          id: "oauth_id",
          name: "display_name",
          username: "handle",
          avatarURL: "avatar",
        },
      },
      fileToken: {
        duration: 180,
      },
    });
    const originalFileTokenSecret = collection.fileToken.secret;

    scope.unmarshal(
      {
        authRule: null,
        indexes: ["CREATE INDEX idx_new ON test_users (score)"],
        fields: [{ id: "flag_id", name: "flag", type: "bool" }],
        authAlert: {
          emailTemplate: {
            body: "<p>Changed body</p>",
          },
        },
        oauth2: {
          mappedFields: {
            username: "new_handle",
          },
        },
        fileToken: {
          duration: 300,
        },
      },
      collection,
    );

    expect(collection.authRule).toBeNull();
    expect(collection.indexes).toEqual(["CREATE INDEX idx_new ON test_users (score)"]);
    expect(collection.fields.getByName("title")).toBeNull();
    expect(collection.fields.getByName("flag")).not.toBeNull();
    expect(collection.authAlert.enabled).toBe(true);
    expect(collection.authAlert.emailTemplate.subject).toBe("Original subject");
    expect(collection.authAlert.emailTemplate.body).toBe("<p>Changed body</p>");
    expect(collection.oauth2.enabled).toBe(true);
    expect(collection.oauth2.mappedFields.id).toBe("oauth_id");
    expect(collection.oauth2.mappedFields.name).toBe("display_name");
    expect(collection.oauth2.mappedFields.username).toBe("new_handle");
    expect(collection.oauth2.mappedFields.avatarURL).toBe("avatar");
    expect(collection.fileToken.secret).toBe(originalFileTokenSecret);
    expect(collection.fileToken.duration).toBe(300);
  });

  it("base binds unmarshal applies generated auth option diffs before saving", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const scope: BindScope = {};
      baseBinds(scope);
      appBinds(scope, app);

      const collection = scope.$app.findCollectionByNameOrId("_pb_users_auth_");
      const originalSubject = collection.authAlert.emailTemplate.subject;
      scope.unmarshal(
        {
          authAlert: {
            emailTemplate: {
              body: "<p>Generated auth alert body</p>",
            },
          },
        },
        collection,
      );

      const saveErr = scope.$app.save(collection);
      expect(saveErr).toBeNull();

      const row = app.db().query("select options from _collections where id = ?").get("_pb_users_auth_") as {
        options: string;
      };
      const options = JSON.parse(row.options) as {
        authAlert?: {
          enabled?: boolean;
          emailTemplate?: {
            subject?: string;
            body?: string;
          };
        };
      };

      expect(options.authAlert?.emailTemplate?.subject).toBe(originalSubject);
      expect(options.authAlert?.emailTemplate?.body).toBe("<p>Generated auth alert body</p>");
    } finally {
      await cleanup();
    }
  });

  it("base binds forMigrations keeps app save, delete, and import semantics", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const scope: BindScope = {};
      appBinds(scope, app);

      const migrationApp = scope.$app.forMigrations();
      const collection = migrationApp.findCollectionByNameOrId("_pb_users_auth_");
      collection.listRule = "@request.auth.id != ''";

      const result = migrationApp.save(collection);
      expect(result).toBeNull();

      const saved = app.FindCollectionByNameOrId("_pb_users_auth_");
      expect(saved.ListRule).toBe("@request.auth.id != ''");

      const importResult = migrationApp.importCollections(
        [
          {
            name: "jsvm_imported",
            type: "base",
            fields: [{ name: "title", type: "text" }],
          },
        ],
        false,
      );
      expect(importResult).toBeNull();

      const imported = app.FindCollectionByNameOrId("jsvm_imported");
      expect(imported.Fields.GetByName("title")).not.toBeNull();

      const deleteResult = migrationApp.delete(imported);
      expect(deleteResult).toBeNull();
      expect(() => app.FindCollectionByNameOrId("jsvm_imported")).toThrow();
    } finally {
      await cleanup();
    }
  });

  it("app binds wrap transaction callback app with JSVM names", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const scope: BindScope = {};
      appBinds(scope, app);

      const txErr = scope.$app.runInTransaction((txApp: BindScope) => {
        expect(typeof txApp.findCollectionByNameOrId).toBe("function");
        expect(typeof txApp.findRecordsByFilter).toBe("function");
        expect(typeof txApp.save).toBe("function");
        expect(typeof txApp.FindRecordsByFilter).toBe("function");

        const collection = txApp.findCollectionByNameOrId("demo1");
        expect(collection.name).toBe("demo1");

        const records = txApp.findRecordsByFilter("demo1", "id = '84nmscqy84lsi1t'", "", 1, 0);
        const upperRecords = txApp.FindRecordsByFilter("demo1", "id = '84nmscqy84lsi1t'", "", 1, 0);
        expect(records.length).toBe(1);
        expect(upperRecords.length).toBe(1);

        const record = records[0];
        expect(typeof record.getString).toBe("function");
        expect(typeof record.getDateTime).toBe("function");
        expect(typeof record.GetString).toBe("function");
        expect(record.getString("text")).toBe("test");
        expect(record.GetString("text")).toBe("test");

        const created = record.getDateTime("created");
        const updated = record.GetDateTime("updated");
        expect(typeof created.isZero).toBe("function");
        expect(typeof created.before).toBe("function");
        expect(typeof created.after).toBe("function");
        expect(typeof created.compare).toBe("function");
        expect(typeof created.IsZero).toBe("function");
        expect(created.isZero()).toBe(false);
        expect(created.compare(updated)).toBeLessThanOrEqual(0);

        expect(txApp.save(collection)).toBeNull();

        const nestedErr = txApp.runInTransaction((innerTxApp: BindScope) => {
          expect(typeof innerTxApp.findRecordsByFilter).toBe("function");
          return null;
        });
        expect(nestedErr).toBeNull();

        return null;
      });
      expect(txErr).toBeNull();
    } finally {
      await cleanup();
    }
  });

  it("base binds context", () => {
    const scope: BindScope = {};
    baseBinds(scope);

    const base = new scope.Context(null, "a", 123);
    const sub = new scope.Context(base, "b", 456);

    expect(sub.value("a")).toBe(123);
    expect(sub.value("b")).toBe(456);
  });

  it("base binds cookie", () => {
    const scope: BindScope = {};
    baseBinds(scope);

    const cookie = new scope.Cookie({
      name: "example_name",
      value: "example_value",
      path: "/example_path",
      domain: "example.com",
      maxAge: 10,
      secure: true,
      httpOnly: true,
      sameSite: 3,
    });

    const expected =
      "example_name=example_value; Path=/example_path; Domain=example.com; Max-Age=10; HttpOnly; Secure; SameSite=Strict";
    expect(cookie.string()).toBe(expected);
  });

  it("base binds subscription message", () => {
    const scope: BindScope = {};
    baseBinds(scope);

    const payload = {
      name: "test",
      data: '{"test":123}',
    };

    const result = new scope.SubscriptionMessage(payload);
    expect(result.name).toBe(payload.name);
    expect(new TextDecoder().decode(result.data)).toBe(payload.data);
  });

  it("base binds record", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      let collection: Collection | null = null;
      try {
        collection = app.FindCachedCollectionByNameOrId("users");
      } catch {
        collection = null;
      }
      if (!collection) {
        throw new Error("missing users collection");
      }

      const scope: BindScope = {};
      baseBinds(scope);

      const record1 = new scope.Record(collection);
      expect(record1).toBeInstanceOf(RecordModel);

      const record2 = new scope.Record(collection, { email: "test@example.com" });
      expect(record2).toBeInstanceOf(RecordModel);
      expect(record2.collection().Name).toBe("users");
      expect(record2.Email()).toBe("test@example.com");
      expect(record2.get("email")).toBe("test@example.com");
      expect(record2.getBool("emailVisibility")).toBe(false);
      expect(record2.getString("email")).toBe("test@example.com");
      expect(record2.getInt("emailVisibility")).toBe(0);
      expect(record2.getFloat("emailVisibility")).toBe(0);
      expect(record2.getDateTime("missing").isZero()).toBe(true);
      expect(record2.GetString("email")).toBe("test@example.com");

      const record3 = new scope.Record(collection, { password: "secret123" });
      const password = record3.GetRaw("password");
      expect(password).toBeInstanceOf(PasswordFieldValue);
      expect((password as PasswordFieldValue).Hash.startsWith("$2")).toBeTrue();
    } finally {
      await cleanup();
    }
  });

  it("base binds collection", () => {
    const scope: BindScope = {};
    baseBinds(scope);

    const collection = new scope.Collection({
      name: "test",
      createRule: "@request.auth.id != ''",
      fields: [{ name: "title", type: "text" }],
    });

    expect(collection).toBeInstanceOf(Collection);
    expect(collection.type).toBe("base");
    expect(collection.id.startsWith("pbc_")).toBe(true);
    expect(collection.name).toBe("test");
    expect(collection.createRule).toBe("@request.auth.id != ''");
    expect(collection.Fields.GetByName("title")).not.toBeNull();

    const empty = new scope.Collection();
    expect(empty.type).toBe("");
    expect(empty.id).toBe("");
  });

  it("base binds collection helpers support jsvm-style lower-camel access", () => {
    const scope: BindScope = {};
    baseBinds(scope);

    const users = scope.newAuthCollection("users");
    users.Fields.add(new scope.TextField({ name: "name", required: true }));
    users.listRule = "@request.auth.id != ''";

    expect(users.type).toBe("auth");
    expect(users.Fields.getByName("name")).not.toBeNull();
    expect(users.listRule).toBe("@request.auth.id != ''");

    const posts = scope.newBaseCollection("posts");
    expect(posts.type).toBe("base");
    expect(posts.Fields.map((field: { GetName: () => string }) => field.GetName())).toEqual(["id"]);
  });

  it("base bind typings declare collection helper globals", async () => {
    const typesSource = await Bun.file(generatedTypesUrl).text();

    expect(typesSource).toContain("declare function newCollection(");
    expect(typesSource).toContain("declare function newBaseCollection(");
    expect(typesSource).toContain("declare function newViewCollection(");
    expect(typesSource).toContain("declare function newAuthCollection(");
  });

  it("forMigrations does not namespace collection helper globals", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const scope: BindScope = {};
      baseBinds(scope);
      appBinds(scope, app);

      const migrationApp = scope.$app.forMigrations();
      expect(typeof scope.newBaseCollection).toBe("function");
      expect(migrationApp.newBaseCollection).toBeUndefined();
    } finally {
      await cleanup();
    }
  });

  it("base binds fields list", () => {
    const scope: BindScope = {};
    baseBinds(scope);

    const list = new scope.FieldsList([{ name: "title", type: "text" }]);
    expect(list).toBeInstanceOf(FieldsList);
    expect(list.GetByName("title")).not.toBeNull();
  });

  it("base binds field", () => {
    const scope: BindScope = {};
    baseBinds(scope);

    const field = new scope.Field({ name: "test", type: "bool" });
    expect(field).toBeInstanceOf(BoolField);
    expect(field.Name).toBe("test");
  });

  it("base binds named fields", () => {
    const scope: BindScope = {};
    baseBinds(scope);

    const scenarios: Array<{ value: unknown; type: new (...args: any[]) => unknown }> = [
      { value: new scope.NumberField({ name: "test" }), type: NumberField },
      { value: new scope.BoolField({ name: "test" }), type: BoolField },
      { value: new scope.TextField({ name: "test" }), type: TextField },
      { value: new scope.URLField({ name: "test" }), type: URLField },
      { value: new scope.EmailField({ name: "test" }), type: EmailField },
      { value: new scope.EditorField({ name: "test" }), type: EditorField },
      { value: new scope.PasswordField({ name: "test" }), type: PasswordField },
      { value: new scope.DateField({ name: "test" }), type: DateField },
      { value: new scope.AutodateField({ name: "test" }), type: AutodateField },
      { value: new scope.JSONField({ name: "test" }), type: JSONField },
      { value: new scope.RelationField({ name: "test" }), type: RelationField },
      { value: new scope.SelectField({ name: "test" }), type: SelectField },
      { value: new scope.FileField({ name: "test" }), type: FileField },
      { value: new scope.GeoPointField({ name: "test" }), type: GeoPointField },
    ];

    for (const scenario of scenarios) {
      expect(scenario.value).toBeInstanceOf(scenario.type);
      const field = scenario.value as { GetName: () => string };
      expect(field.GetName()).toBe("test");
    }
  });

  it("base binds mailer message", () => {
    const scope: BindScope = {};
    baseBinds(scope);

    const message = new scope.MailerMessage({
      from: { name: "test_from", address: "test_from@example.com" },
      to: [
        { name: "test_to1", address: "test_to1@example.com" },
        { name: "test_to2", address: "test_to2@example.com" },
      ],
      bcc: [
        { name: "test_bcc1", address: "test_bcc1@example.com" },
        { name: "test_bcc2", address: "test_bcc2@example.com" },
      ],
      cc: [
        { name: "test_cc1", address: "test_cc1@example.com" },
        { name: "test_cc2", address: "test_cc2@example.com" },
      ],
      subject: "test_subject",
      html: "test_html",
      text: "test_text",
      headers: {
        header1: "a",
        header2: "b",
      },
    });

    const raw = JSON.stringify(message);
    const expected =
      '{"from":{"Name":"test_from","Address":"test_from@example.com"},"to":[{"Name":"test_to1","Address":"test_to1@example.com"},{"Name":"test_to2","Address":"test_to2@example.com"}],"bcc":[{"Name":"test_bcc1","Address":"test_bcc1@example.com"},{"Name":"test_bcc2","Address":"test_bcc2@example.com"}],"cc":[{"Name":"test_cc1","Address":"test_cc1@example.com"},{"Name":"test_cc2","Address":"test_cc2@example.com"}],"subject":"test_subject","html":"test_html","text":"test_text","headers":{"header1":"a","header2":"b"},"attachments":null,"inlineAttachments":null}';
    expect(raw).toBe(expected);
  });

  it("base binds command", () => {
    const scope: BindScope = {};
    baseBinds(scope);

    let runCalls = 0;
    const cmd = new scope.Command({
      use: "test",
      run: () => {
        runCalls += 1;
      },
    });

    cmd.run(null, []);
    expect(cmd.use).toBe("test");
    expect(runCalls).toBe(1);
  });

  it("base binds request info", () => {
    const scope: BindScope = {};
    baseBinds(scope);

    const info = new scope.RequestInfo({ body: { name: "test2" } });
    expect(info.body?.name).toBe("test2");
  });

  it("base binds middleware", () => {
    const scope: BindScope = {};
    baseBinds(scope);

    const middleware = new scope.Middleware(() => {}, 10, "test");
    expect(middleware).toBeTruthy();
    expect(middleware.func).toBeTypeOf("function");
    expect(middleware.priority).toBe(10);
    expect(middleware.id).toBe("test");
    expect(middleware.Func).toBe(middleware.func);
    expect(middleware.Priority).toBe(10);
    expect(middleware.Id).toBe("test");
  });

  it("base bind typings declare Bun-native middleware constructor", async () => {
    const typesSource = await Bun.file(generatedTypesUrl).text();
    expect(typesSource).toContain("constructor(func: (e: core.RequestEvent) => void, priority?: number, id?: string);");
    expect(typesSource).not.toContain("constructor(func: string | ((e: core.RequestEvent) => void)");
  });

  it("base binds timezone", () => {
    const scope: BindScope = {};
    baseBinds(scope);

    expect(new scope.Timezone().string()).toBe("UTC");
    expect(new scope.Timezone("invalid").string()).toBe("UTC");
    expect(new scope.Timezone("EET").string()).toBe("EET");
  });

  it("base binds datetime", () => {
    const scope: BindScope = {};
    baseBinds(scope);

    const now = new scope.DateTime();
    expect(now.isZero()).toBe(false);
    const nowPart = now.string().slice(0, 19);

    const scenarios = [
      { date: new scope.DateTime(""), expected: nowPart },
      { date: new scope.DateTime("", "Asia/Tokyo"), expected: nowPart },
      { date: new scope.DateTime("2023-01-01 00:00:00.000Z"), expected: "2023-01-01 00:00:00.000Z" },
      { date: new scope.DateTime("2025-10-26 03:00:00", "invalid"), expected: "2025-10-26 03:00:00.000Z" },
      { date: new scope.DateTime("2025-01-01 03:00:00", "EET"), expected: "2025-01-01 01:00:00.000Z" },
      { date: new scope.DateTime("2025-07-01 03:00:00", "EET"), expected: "2025-07-01 00:00:00.000Z" },
      { date: new scope.DateTime("2025-10-26 03:00:00", "Europe/Amsterdam"), expected: "2025-10-26 02:00:00.000Z" },
      { date: new scope.DateTime("2025-10-26 01:00:00", "Europe/Amsterdam"), expected: "2025-10-25 23:00:00.000Z" },
      { date: new scope.DateTime("2025-10-26 01:00:00 +0200", "Asia/Tokyo"), expected: "2025-10-25 23:00:00.000Z" },
    ];

    for (const [index, scenario] of scenarios.entries()) {
      expect(scenario.date.string()).toContain(scenario.expected);
      expect(scenario.date.string()).not.toBe("");
      if (!scenario.date.string().includes(scenario.expected)) {
        throw new Error(`(${index}) ${scenario.date.string()} does not contain expected ${scenario.expected}`);
      }
    }
  });

  it("base binds validation error", () => {
    const scope: BindScope = {};
    baseBinds(scope);

    const scenarios = [
      { value: new scope.ValidationError(), code: "", message: "" },
      { value: new scope.ValidationError("test_code"), code: "test_code", message: "" },
      { value: new scope.ValidationError("test_code", "test_message"), code: "test_code", message: "test_message" },
    ];

    for (const scenario of scenarios) {
      expect(scenario.value).toBeInstanceOf(ValidationError);
      expect(scenario.value.Code()).toBe(scenario.code);
      expect(scenario.value.Message()).toBe(scenario.message);
    }
  });

  it("dbx binds", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const scope: BindScope = {};
      baseBinds(scope);
      dbxBinds(scope);

      expect(countKeys(scope.$dbx)).toBe(15);

      const scenarios: Array<{ expr: any; expected: string }> = [
        { expr: scope.$dbx.exp("a = 1"), expected: "a = 1" },
        {
          expr: scope.$dbx.hashExp({
            a: 1,
            b: null,
            c: [1, 2, 3],
          }),
          expected: "`a`={:p0} AND `b` IS NULL AND `c` IN ({:p1}, {:p2}, {:p3})",
        },
        { expr: scope.$dbx.not(scope.$dbx.exp("a = 1")), expected: "NOT (a = 1)" },
        { expr: scope.$dbx.and(scope.$dbx.exp("a = 1"), scope.$dbx.exp("b = 2")), expected: "(a = 1) AND (b = 2)" },
        { expr: scope.$dbx.or(scope.$dbx.exp("a = 1"), scope.$dbx.exp("b = 2")), expected: "(a = 1) OR (b = 2)" },
        { expr: scope.$dbx.in("a", 1, 2, 3), expected: "`a` IN ({:p0}, {:p1}, {:p2})" },
        { expr: scope.$dbx.notIn("a", 1, 2, 3), expected: "`a` NOT IN ({:p0}, {:p1}, {:p2})" },
        {
          expr: scope.$dbx.like("a", "test1", "test2").match(true, false),
          expected: "`a` LIKE {:p0} AND `a` LIKE {:p1}",
        },
        {
          expr: scope.$dbx.orLike("a", "test1", "test2").match(false, true),
          expected: "`a` LIKE {:p0} OR `a` LIKE {:p1}",
        },
        {
          expr: scope.$dbx.notLike("a", "test1", "test2").match(true, false),
          expected: "`a` NOT LIKE {:p0} AND `a` NOT LIKE {:p1}",
        },
        {
          expr: scope.$dbx.orNotLike("a", "test1", "test2").match(false, false),
          expected: "`a` NOT LIKE {:p0} OR `a` NOT LIKE {:p1}",
        },
        { expr: scope.$dbx.exists(scope.$dbx.exp("a = 1")), expected: "EXISTS (a = 1)" },
        { expr: scope.$dbx.notExists(scope.$dbx.exp("a = 1")), expected: "NOT EXISTS (a = 1)" },
        { expr: scope.$dbx.between("a", 1, 2), expected: "`a` BETWEEN {:p0} AND {:p1}" },
        { expr: scope.$dbx.notBetween("a", 1, 2), expected: "`a` NOT BETWEEN {:p0} AND {:p1}" },
      ];

      for (const scenario of scenarios) {
        const params: Record<string, unknown> = {};
        const result = scenario.expr.build(app.db(), params);
        expect(result).toBe(scenario.expected);
      }

      const likeDefaultsParams: Record<string, unknown> = {};
      const likeDefaultsSql = scope.$dbx.like("a", "test").build(app.db(), likeDefaultsParams);
      expect(likeDefaultsSql).toBe("`a` LIKE {:p0}");
      expect(likeDefaultsParams.p0).toBe("%test%");

      const escapedLikeParams: Record<string, unknown> = {};
      const escapedLikeSql = scope.$dbx
        .like("a", "50%_\\")
        .escape("\\", "\\\\", "%", "\\%", "_", "\\_")
        .build(app.db(), escapedLikeParams);
      expect(escapedLikeSql).toBe("`a` LIKE {:p0}");
      expect(escapedLikeParams.p0).toBe("%50\\%\\_\\\\%");
    } finally {
      await cleanup();
    }
  });

  it("mails binds count", () => {
    const scope: BindScope = {};
    mailsBinds(scope);
    expect(countKeys(scope.$mails)).toBe(5);
  });

  it("mails binds", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const record = app.FindAuthRecordByEmail("users", "test@example.com");

      const scope: BindScope = {};
      baseBinds(scope);
      mailsBinds(scope);

      scope.$mails.sendRecordPasswordReset(app, record);
      expect((app.testMailer.lastMessage() as any).html).toContain("/_/#/auth/confirm-password-reset/");

      scope.$mails.sendRecordVerification(app, record);
      expect((app.testMailer.lastMessage() as any).html).toContain("/_/#/auth/confirm-verification/");

      scope.$mails.sendRecordChangeEmail(app, record, "new@example.com");
      expect((app.testMailer.lastMessage() as any).html).toContain("/_/#/auth/confirm-email-change/");

      scope.$mails.sendRecordOTP(app, record, "test_otp_id", "test_otp_pass");
      expect((app.testMailer.lastMessage() as any).html).toContain("test_otp_pass");

      scope.$mails.sendRecordAuthAlert(app, record, "test_alert_info");
      expect((app.testMailer.lastMessage() as any).html).toContain("test_alert_info");
    } finally {
      await cleanup();
    }
  }, 15000);

  it("security binds count", () => {
    const scope: BindScope = {};
    securityBinds(scope);
    expect(countKeys(scope.$security)).toBe(16);
  });

  it("security crypto binds", () => {
    const scope: BindScope = {};
    baseBinds(scope);
    securityBinds(scope);

    const scenarios = [
      { value: scope.$security.md5("123"), expected: "202cb962ac59075b964b07152d234b70" },
      {
        value: scope.$security.sha256("123"),
        expected: "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3",
      },
      {
        value: scope.$security.sha512("123"),
        expected:
          "3c9909afec25354d551dae21590bb26e38d53f2173b8d3dc3eee4c047e7ab1c1eb8b85103e3be7ba613b31bb5c9c36214dc9f14a42fd7a2fdb84856bca5c44c2",
      },
      {
        value: scope.$security.hs256("hello", "test"),
        expected: "f151ea24bda91a18e89b8bb5793ef324b2a02133cce15a28a719acbd2e58a986",
      },
      {
        value: scope.$security.hs512("hello", "test"),
        expected:
          "44f280e11103e295c26cd61dd1cdd8178b531b860466867c13b1c37a26b6389f8af110efbe0bb0717b9d9c87f6fe1c97b3b1690936578890e5669abf279fe7fd",
      },
      { value: String(scope.$security.equal("abc", "abc")), expected: "true" },
      { value: String(scope.$security.equal("abc", "abcd")), expected: "false" },
    ];

    for (const scenario of scenarios) {
      expect(String(scenario.value)).toBe(scenario.expected);
    }
  });

  it("security random string binds", () => {
    const scope: BindScope = {};
    baseBinds(scope);
    securityBinds(scope);

    const scenarios = [
      { value: scope.$security.randomString(6), length: 6 },
      { value: scope.$security.randomStringWithAlphabet(7, "abc"), length: 7 },
      { value: scope.$security.pseudorandomString(8), length: 8 },
      { value: scope.$security.pseudorandomStringWithAlphabet(9, "abc"), length: 9 },
      { value: scope.$security.randomStringByRegex("abc"), length: 3 },
    ];

    for (const scenario of scenarios) {
      expect(String(scenario.value).length).toBe(scenario.length);
    }
  });

  it("security jwt binds", () => {
    const scope: BindScope = {};
    baseBinds(scope);
    securityBinds(scope);

    const result1 = scope.$security.parseUnverifiedJWT(
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0.aXzC7q7z1lX_hxk5P0R368xEU7H1xRwnBQQcLAmG0EY",
    );
    expect(result1.name).toBe("John Doe");
    expect(result1.sub).toBe("1234567890");

    const result2 = scope.$security.parseJWT(
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0.aXzC7q7z1lX_hxk5P0R368xEU7H1xRwnBQQcLAmG0EY",
      "test",
    );
    expect(result2.name).toBe("John Doe");
    expect(result2.sub).toBe("1234567890");

    const token = scope.$security.createJWT({ exp: 123 }, "test", 0);
    const expected = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjEyM30.7gbv7w672gApdBRASI6OniCtKwkKjhieSxsr6vxSrtw";
    expect(token).toBe(expected);
  });

  it("security encrypt and decrypt binds", () => {
    const scope: BindScope = {};
    baseBinds(scope);
    securityBinds(scope);

    const key = "abcdabcdabcdabcdabcdabcdabcdabcd";
    const encrypted = scope.$security.encrypt("123", key);
    const decrypted = scope.$security.decrypt(encrypted, key);
    expect(decrypted).toBe("123");
  });

  it("filesystem binds", async () => {
    await using testApp = await newTestApp();
    const { app } = testApp;
    await using localDir = await newTempDir("pocketbun-jsvm-filesystem-");
    await using server = await startExternalServer(`const server = Bun.serve({
  port: 0,
  fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/error") {
      return new Response("error", { status: 500 });
    }
    return new Response("test");
  },
});
console.log(new URL(server.url).port);`);

    const scope: BindScope = {};
    filesystemBinds(scope);

    expect(countKeys(scope.$filesystem)).toBe(8);

    await using s3Filesystem = scope.$filesystem.s3(
      "bucketName",
      "region",
      "endpoint",
      "accessKey",
      "secretKey",
      true,
    ) as System;
    expect(s3Filesystem).toBeInstanceOf(System);

    await using localFilesystem = scope.$filesystem.local(localDir.path) as System;
    expect(localFilesystem).toBeInstanceOf(System);

    const testFile = join(app.DataDir(), "data.db");

    const fileFromPath = scope.$filesystem.fileFromPath(testFile) as File;
    expect(fileFromPath.OriginalName).toBe("data.db");
    const fileFromPathAsync = (await scope.$filesystem.fileFromPathAsync(testFile)) as File;
    expect(fileFromPathAsync.OriginalName).toBe("data.db");

    const fileFromBytes = scope.$filesystem.fileFromBytes([1, 2, 3], "test") as File;
    expect(fileFromBytes.OriginalName).toBe("test");

    const multipartHeader = {
      filename: "test",
      size: 4,
      buffer: new TextEncoder().encode("test"),
    };
    const fileFromMultipart = scope.$filesystem.fileFromMultipart(multipartHeader) as File;
    expect(fileFromMultipart.OriginalName).toBe("test");

    const fileFromURL = scope.$filesystem.fileFromURL(`http://127.0.0.1:${server.port}/test`) as File;
    expect(fileFromURL.OriginalName).toBe("test");
    const fileFromURLAsync = (await scope.$filesystem.fileFromURLAsync(`http://127.0.0.1:${server.port}/test`)) as File;
    expect(fileFromURLAsync.OriginalName).toBe("test");

    let urlErr: Error | null = null;
    try {
      scope.$filesystem.fileFromURL(`http://127.0.0.1:${server.port}/error`);
    } catch (err) {
      urlErr = err as Error;
    }
    expect(urlErr).not.toBeNull();

    let asyncUrlErr: Error | null = null;
    try {
      await scope.$filesystem.fileFromURLAsync(`http://127.0.0.1:${server.port}/error`);
    } catch (err) {
      asyncUrlErr = err as Error;
    }
    expect(asyncUrlErr).not.toBeNull();
  }, 30000);

  it("forms binds", () => {
    const scope: BindScope = {};
    formsBinds(scope);
    expect(countKeys(scope)).toBe(4);
  });

  it("apis binds count", () => {
    const scope: BindScope = {};
    apisBinds(scope);
    expect(countKeys(scope)).toBe(8);
    expect(countKeys(scope.$apis)).toBe(11);
  });

  it("apis middleware helpers expose lowercase handler fields", () => {
    const scope: BindScope = {};
    apisBinds(scope);

    const authMiddleware = scope.$apis.requireAuth();
    expect(authMiddleware.func).toBeTypeOf("function");
    expect(authMiddleware.id).toBe("pbRequireAuth");
    expect(authMiddleware.Func).toBe(authMiddleware.func);
    expect(authMiddleware.Id).toBe("pbRequireAuth");

    const gzipMiddleware = scope.$apis.gzip();
    expect(gzipMiddleware.func).toBeTypeOf("function");
    expect(gzipMiddleware.id).toBe("pbGzip");
    expect(gzipMiddleware.Func).toBe(gzipMiddleware.func);
    expect(gzipMiddleware.Id).toBe("pbGzip");
  });

  it("apis binds api error", () => {
    const scope: BindScope = {};
    apisBinds(scope);

    const scenarios: Array<{
      value: ApiError;
      status: number;
      message: string;
      data: string;
    }> = [
      { value: new scope.ApiError(), status: 0, message: "", data: "null" },
      { value: new scope.ApiError(100, "test", { test: 1 }), status: 100, message: "Test.", data: '{"test":1}' },
      {
        value: new scope.NotFoundError(),
        status: 404,
        message: "The requested resource wasn't found.",
        data: "null",
      },
      { value: new scope.NotFoundError("test", { test: 1 }), status: 404, message: "Test.", data: '{"test":1}' },
      {
        value: new scope.BadRequestError(),
        status: 400,
        message: "Something went wrong while processing your request.",
        data: "null",
      },
      { value: new scope.BadRequestError("test", { test: 1 }), status: 400, message: "Test.", data: '{"test":1}' },
      {
        value: new scope.ForbiddenError(),
        status: 403,
        message: "You are not allowed to perform this request.",
        data: "null",
      },
      { value: new scope.ForbiddenError("test", { test: 1 }), status: 403, message: "Test.", data: '{"test":1}' },
      {
        value: new scope.UnauthorizedError(),
        status: 401,
        message: "Missing or invalid authentication.",
        data: "null",
      },
      {
        value: new scope.UnauthorizedError("test", { test: 1 }),
        status: 401,
        message: "Test.",
        data: '{"test":1}',
      },
      { value: new scope.TooManyRequestsError(), status: 429, message: "Too Many Requests.", data: "null" },
      {
        value: new scope.TooManyRequestsError("test", { test: 1 }),
        status: 429,
        message: "Test.",
        data: '{"test":1}',
      },
      {
        value: new scope.InternalServerError(),
        status: 500,
        message: "Something went wrong while processing your request.",
        data: "null",
      },
      {
        value: new scope.InternalServerError("test", { test: 1 }),
        status: 500,
        message: "Test.",
        data: '{"test":1}',
      },
    ];

    for (const scenario of scenarios) {
      expect(scenario.value.Status).toBe(scenario.status);
      expect(scenario.value.Message).toBe(scenario.message);
      expect(JSON.stringify(scenario.value.RawData())).toBe(scenario.data);
    }
  });

  it("apis binds static accepts fs-like roots", () => {
    const scope: BindScope = {};
    apisBinds(scope);

    expect(typeof scope.$apis.static("/tmp", false)).toBe("function");
    expect(typeof scope.$apis.static({ root: "/tmp" }, false)).toBe("function");
    expect(() => scope.$apis.static(123, false)).toThrow(
      "$apis.static expects the first argument to be either a plain string path or fs.FS value",
    );
  });

  it("loading dynamic model", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const scope: BindScope = {};
      baseBinds(scope);
      dbxBinds(scope);
      appBinds(scope, app);

      const result = new scope.DynamicModel({
        string: "",
        nullString: scope.nullString(),
        nullStringEmpty: scope.nullString(),
        bool: false,
        nullBool: scope.nullBool(),
        nullBoolEmpty: scope.nullBool(),
        int: 0,
        nullInt: scope.nullInt(),
        nullIntEmpty: scope.nullInt(),
        float: -0,
        nullFloat: scope.nullFloat(),
        nullFloatEmpty: scope.nullFloat(),
        array: [],
        nullArray: scope.nullArray(),
        nullArrayEmpty: scope.nullArray(),
        object: {},
        nullObject: scope.nullObject(),
        nullObjectEmpty: scope.nullObject(),
      });

      const expectations: Record<string, unknown> = {
        string: "a",
        nullString: "b",
        nullStringEmpty: null,
        bool: false,
        nullBool: true,
        nullBoolEmpty: null,
        int: 1,
        nullInt: 2,
        nullIntEmpty: null,
        float: 1.1,
        nullFloat: 1.2,
        nullFloatEmpty: null,
        array: [1, 2],
        nullArray: [3, 4],
        nullArrayEmpty: null,
        object: { a: 1 },
        nullObject: { a: 2 },
        nullObjectEmpty: null,
      };

      const selectColumns: string[] = [];
      for (const [col, val] of Object.entries(expectations)) {
        if (val === null) {
          selectColumns.push(`null as [[${col}]]`);
          continue;
        }
        if (typeof val === "string") {
          selectColumns.push(`'${val}' as [[${col}]]`);
          continue;
        }
        if (typeof val === "object") {
          selectColumns.push(`'${JSON.stringify(val)}' as [[${col}]]`);
          continue;
        }
        selectColumns.push(`${String(val as string | number | boolean | bigint)} as [[${col}]]`);
      }

      scope.$app
        .db()
        .newQuery(`SELECT ${selectColumns.join(", ")}`)
        .one(result);

      for (const [col, expected] of Object.entries(expectations)) {
        let resultValue = result[col];
        let expectedValue = expected;

        if (expectedValue !== null && typeof expectedValue === "object") {
          expectedValue = JSON.stringify(expectedValue);
          resultValue = JSON.stringify(resultValue);
        }

        expect(resultValue).toBe(expectedValue);
      }
    } finally {
      await cleanup();
    }
  });

  it("newQuery execute supports bind params", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const scope: BindScope = {};
      baseBinds(scope);
      dbxBinds(scope);
      appBinds(scope, app);

      app.db().run("create table if not exists _pb_dbx_bind_execute_test (token text)");
      app.db().run("delete from _pb_dbx_bind_execute_test");
      app.db().run("insert into _pb_dbx_bind_execute_test (token) values (?)", ["test-token"]);

      const result = scope.$app
        .db()
        .newQuery("DELETE FROM _pb_dbx_bind_execute_test WHERE token = {:token}")
        .bind({ token: "test-token" })
        .execute();

      expect(result?.changes).toBe(1);

      const row = app.db().query("select count(*) as total from _pb_dbx_bind_execute_test where token = ?").get("test-token") as
        | {
            total?: number;
          }
        | undefined;
      expect(row?.total).toBe(0);
    } finally {
      await cleanup();
    }
  });

  it("newQuery exposes documented query methods", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const scope: BindScope = {};
      baseBinds(scope);
      dbxBinds(scope);
      appBinds(scope, app);

      const query = scope.$app.db().newQuery("SELECT 1");
      const typesSource = await Bun.file(generatedTypesUrl).text();
      const dbxNamespace = extractNamespace(typesSource, "dbx");
      const sqlNamespace = extractNamespace(typesSource, "sql");
      const documentedQueryMethods = extractInterfaceMethodNames(dbxNamespace, "Query");
      const documentedQueryProperties = extractInterfacePropertyNames(dbxNamespace, "Query");
      const documentedSelectMethods = extractInterfaceMethodNames(dbxNamespace, "SelectQuery");
      const documentedSelectProperties = extractInterfacePropertyNames(dbxNamespace, "SelectQuery");
      const documentedDbxRowsMethods = extractInterfaceMethodNames(dbxNamespace, "Rows");
      const documentedSqlRowsMethods = extractInterfaceMethodNames(sqlNamespace, "Rows");
      const documentedRowsMethods = [...new Set([...documentedDbxRowsMethods, ...documentedSqlRowsMethods])];
      const queryRecord = query as unknown as Record<string, unknown>;

      for (const methodName of documentedQueryMethods) {
        expect(typeof queryRecord[methodName]).toBe("function");
      }
      for (const propertyName of documentedQueryProperties) {
        expect(propertyName in queryRecord).toBe(true);
      }
      expect(typeof query.Bind).toBe("function");

      const rows = query.rows();
      const rowsRecord = rows as unknown as Record<string, unknown>;
      for (const methodName of documentedRowsMethods) {
        expect(typeof rowsRecord[methodName]).toBe("function");
      }
      rows.close();

      const queryCtx = { traceId: "query-methods" };
      query.withContext(queryCtx);
      expect(query.context()).toEqual(queryCtx);

      const select = scope.$app.db().select("id").from("demo1");
      const selectRecord = select as unknown as Record<string, unknown>;
      for (const methodName of documentedSelectMethods) {
        expect(typeof selectRecord[methodName]).toBe("function");
      }
      for (const propertyName of documentedSelectProperties) {
        expect(propertyName in selectRecord).toBe(true);
      }

      const selectCtx = { traceId: "select-methods" };
      select.withContext(selectCtx);
      expect(select.context()).toEqual(selectCtx);
    } finally {
      await cleanup();
    }
  });

  it("newQuery bind with {:token} placeholders matches docs behavior", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const scope: BindScope = {};
      baseBinds(scope);
      dbxBinds(scope);
      appBinds(scope, app);

      app.db().run("create table if not exists _pb_dbx_bind_docs_test (name text, created text)");
      app.db().run("delete from _pb_dbx_bind_docs_test");
      app
        .db()
        .run("insert into _pb_dbx_bind_docs_test (name, created) values (?, ?)", ["too-early", "2023-06-24 23:59:59.999Z"]);
      app
        .db()
        .run("insert into _pb_dbx_bind_docs_test (name, created) values (?, ?)", ["in-range-a", "2023-06-25 00:00:00.000Z"]);
      app
        .db()
        .run("insert into _pb_dbx_bind_docs_test (name, created) values (?, ?)", ["in-range-b", "2023-06-28 23:59:59.999Z"]);
      app
        .db()
        .run("insert into _pb_dbx_bind_docs_test (name, created) values (?, ?)", ["too-late", "2023-06-29 00:00:00.000Z"]);

      const result = scope.arrayOf(
        new scope.DynamicModel({
          name: "",
          created: "",
        }),
      );

      scope.$app
        .db()
        .newQuery(
          "SELECT name, created FROM _pb_dbx_bind_docs_test WHERE created >= {:from} and created <= {:to} ORDER BY created ASC",
        )
        .bind({
          from: "2023-06-25 00:00:00.000Z",
          to: "2023-06-28 23:59:59.999Z",
        })
        .all(result);

      expect(result.map((item: { name: string }) => item.name)).toEqual(["in-range-a", "in-range-b"]);
    } finally {
      await cleanup();
    }
  });

  it("newQuery one throws sql.ErrNoRows-compatible error when no row matches", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const scope: BindScope = {};
      baseBinds(scope);
      dbxBinds(scope);
      appBinds(scope, app);

      app.db().run("create table if not exists _pb_dbx_bind_no_rows_test (name text)");
      app.db().run("delete from _pb_dbx_bind_no_rows_test");
      app.db().run("insert into _pb_dbx_bind_no_rows_test (name) values (?)", ["present"]);

      const result = new scope.DynamicModel({
        name: "",
      });

      expect(() => {
        scope.$app
          .db()
          .newQuery("SELECT name FROM _pb_dbx_bind_no_rows_test WHERE name = {:name}")
          .bind({ name: "missing" })
          .one(result);
      }).toThrow("sql: no rows in result set");
    } finally {
      await cleanup();
    }
  });

  it("newQuery rows cursor supports next/scan helpers", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const scope: BindScope = {};
      baseBinds(scope);
      dbxBinds(scope);
      appBinds(scope, app);

      app.db().run("create table if not exists _pb_dbx_rows_cursor_test (name text, rank integer)");
      app.db().run("delete from _pb_dbx_rows_cursor_test");
      app.db().run("insert into _pb_dbx_rows_cursor_test (name, rank) values (?, ?)", ["a", 1]);
      app.db().run("insert into _pb_dbx_rows_cursor_test (name, rank) values (?, ?)", ["b", 2]);

      const rows = scope.$app.db().newQuery("SELECT name, rank FROM _pb_dbx_rows_cursor_test ORDER BY name ASC").rows();
      expect(typeof rows.next).toBe("function");
      expect(typeof rows.scanMap).toBe("function");
      expect(typeof rows.scanStruct).toBe("function");
      expect(typeof rows.scan).toBe("function");
      expect(typeof rows.columns).toBe("function");
      expect(typeof rows.close).toBe("function");
      expect(rows.columns()).toEqual(["name", "rank"]);
      expect(rows.err()).toBeNull();
      expect(rows.nextResultSet()).toBe(false);

      expect(rows.next()).toBe(true);
      const firstMap: Record<string, unknown> = {};
      rows.scanMap(firstMap);
      expect(firstMap).toEqual({ name: "a", rank: 1 });

      expect(rows.next()).toBe(true);
      const model = new scope.DynamicModel({ name: "", rank: 0 });
      rows.scanStruct(model);
      expect(model.name).toBe("b");
      expect(model.rank).toBe(2);
      expect(rows.next()).toBe(false);

      const rowsForScan = scope.$app
        .db()
        .newQuery("SELECT name, rank FROM _pb_dbx_rows_cursor_test WHERE name = {:name}")
        .bind({ name: "a" })
        .rows();
      expect(rowsForScan.next()).toBe(true);
      const nameTarget = { value: "" };
      const rankTarget = { value: 0 };
      rowsForScan.scan(nameTarget, rankTarget);
      expect(nameTarget.value).toBe("a");
      expect(rankTarget.value).toBe(1);
      rowsForScan.close();
      expect(rowsForScan.next()).toBe(false);
    } finally {
      await cleanup();
    }
  });

  it("newQuery withExecHook wraps execute/one/all/row/column", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const scope: BindScope = {};
      baseBinds(scope);
      dbxBinds(scope);
      appBinds(scope, app);

      app.db().run("create table if not exists _pb_dbx_exec_hook_test (name text)");
      app.db().run("delete from _pb_dbx_exec_hook_test");
      app.db().run("insert into _pb_dbx_exec_hook_test (name) values (?)", ["x"]);
      app.db().run("insert into _pb_dbx_exec_hook_test (name) values (?)", ["y"]);

      const query = scope.$app.db().newQuery("SELECT name FROM _pb_dbx_exec_hook_test WHERE name = {:name}");
      let execHookCalls = 0;
      query.withExecHook((_q: unknown, op: () => unknown) => {
        execHookCalls += 1;
        return op();
      });

      const oneTarget = new scope.DynamicModel({ name: "" });
      query.bind({ name: "x" }).one(oneTarget);
      expect(oneTarget.name).toBe("x");

      const allTarget = scope.arrayOf(new scope.DynamicModel({ name: "" }));
      query.bind({ name: "x" }).all(allTarget);
      expect(allTarget.map((item: { name: string }) => item.name)).toEqual(["x"]);

      const rowTarget: unknown[] = [];
      query.bind({ name: "x" }).row(rowTarget);
      expect(rowTarget).toEqual(["x"]);

      const columnTarget: unknown[] = [];
      query.bind({ name: "x" }).column(columnTarget);
      expect(columnTarget).toEqual(["x"]);

      query.bind({ name: "y" }).execute();
      expect(execHookCalls).toBe(5);
    } finally {
      await cleanup();
    }
  });

  it("select query builder supports documented chaining methods", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const scope: BindScope = {};
      baseBinds(scope);
      dbxBinds(scope);
      appBinds(scope, app);

      app.db().run("create table if not exists _pb_dbx_select_docs_users (id text, email text, created text)");
      app.db().run("delete from _pb_dbx_select_docs_users");
      app
        .db()
        .run("insert into _pb_dbx_select_docs_users (id, email, created) values (?, ?, ?)", [
          "u1",
          "alice@example.com",
          "2023-06-25 00:00:00.000Z",
        ]);
      app
        .db()
        .run("insert into _pb_dbx_select_docs_users (id, email, created) values (?, ?, ?)", [
          "u2",
          "bob@test.dev",
          "2023-06-26 00:00:00.000Z",
        ]);

      const result = scope.arrayOf(
        new scope.DynamicModel({
          id: "",
          email: "",
          created: "",
        }),
      );

      scope.$app
        .db()
        .select("id", "email")
        .andSelect("created")
        .distinct(true)
        .from("_pb_dbx_select_docs_users")
        .andWhere(scope.$dbx.like("email", "example.com").match(true, true))
        .limit(100)
        .orderBy("created ASC")
        .andOrderBy("id ASC")
        .all(result);

      expect(result.map((item: { id: string }) => item.id)).toEqual(["u1"]);
    } finally {
      await cleanup();
    }
  });

  it("select query builder supports join/groupBy/having helpers", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const scope: BindScope = {};
      baseBinds(scope);
      dbxBinds(scope);
      appBinds(scope, app);

      app.db().run("create table if not exists _pb_dbx_select_docs_users (id text, email text)");
      app.db().run("create table if not exists _pb_dbx_select_docs_profiles (id text, user_id text)");
      app.db().run("delete from _pb_dbx_select_docs_users");
      app.db().run("delete from _pb_dbx_select_docs_profiles");

      app.db().run("insert into _pb_dbx_select_docs_users (id, email) values (?, ?)", ["u1", "alice@example.com"]);
      app.db().run("insert into _pb_dbx_select_docs_users (id, email) values (?, ?)", ["u2", "bob@example.com"]);
      app.db().run("insert into _pb_dbx_select_docs_profiles (id, user_id) values (?, ?)", ["p1", "u1"]);
      app.db().run("insert into _pb_dbx_select_docs_profiles (id, user_id) values (?, ?)", ["p2", "u1"]);

      const result = scope.arrayOf(
        new scope.DynamicModel({
          id: "",
          total: 0,
        }),
      );

      scope.$app
        .db()
        .select("[[_pb_dbx_select_docs_users.id]] as [[id]]", "count([[_pb_dbx_select_docs_profiles.id]]) as [[total]]")
        .from("_pb_dbx_select_docs_users")
        .innerJoin(
          "_pb_dbx_select_docs_profiles",
          scope.$dbx.exp("[[_pb_dbx_select_docs_profiles.user_id]] = [[_pb_dbx_select_docs_users.id]]"),
        )
        .groupBy("[[_pb_dbx_select_docs_users.id]]")
        .having(scope.$dbx.exp("count([[_pb_dbx_select_docs_profiles.id]]) > {:min}", { min: 1 }))
        .all(result);

      expect(result.length).toBe(1);
      expect(result[0].id).toBe("u1");
      expect(result[0].total).toBe(2);
    } finally {
      await cleanup();
    }
  });

  it("dynamic model map field caching", () => {
    const scope: BindScope = {};
    baseBinds(scope);

    const m1 = new scope.DynamicModel({
      int: 0,
      float: -0,
      text: "",
      bool: false,
      obj: {},
      arr: [],
    });

    const m2 = new scope.DynamicModel({
      int: 0,
      float: -0,
      text: "",
      bool: false,
      obj: {},
      arr: [],
    });

    m1.int = 1;
    m1.float = 1.5;
    m1.text = "a";
    m1.bool = true;
    m1.obj.set("a", 1);
    m1.arr.push(1);

    m2.int = 2;
    m2.float = 2.5;
    m2.text = "b";
    m2.bool = false;
    m2.obj.set("b", 1);
    m2.arr.push(2);

    const m1Expected = '{"arr":[1],"bool":true,"float":1.5,"int":1,"obj":{"a":1},"text":"a"}';
    expect(JSON.stringify(m1)).toBe(m1Expected);

    const m2Expected = '{"arr":[2],"bool":false,"float":2.5,"int":2,"obj":{"b":1},"text":"b"}';
    expect(JSON.stringify(m2)).toBe(m2Expected);
  });

  it("loading arrayOf", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const scope: BindScope = {};
      baseBinds(scope);
      dbxBinds(scope);
      appBinds(scope, app);

      const result = scope.arrayOf(
        new scope.DynamicModel({
          id: "",
          text: "",
        }),
      );

      scope.$app
        .db()
        .select("id", "text")
        .from("demo1")
        .where(scope.$dbx.exp("id='84nmscqy84lsi1t' OR id='al1h9ijdeojtsjy'"))
        .limit(2)
        .orderBy("text ASC")
        .all(result);

      expect(result.length).toBe(2);
      expect(result[0].id).toBe("84nmscqy84lsi1t");
      expect(result[0].text).toBe("test");
      expect(result[1].id).toBe("al1h9ijdeojtsjy");
      expect(result[1].text).toBe("test2");
    } finally {
      await cleanup();
    }
  });

  it("app binds save supports records with async field interceptors", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const scope: BindScope = {};
      baseBinds(scope);
      appBinds(scope, app);

      const record = scope.$app.findFirstRecordByFilter("demo1", "1=1");
      record.set("text", "updated by jsvm app bind");

      const saveErr = await scope.$app.save(record);
      expect(saveErr).toBeNull();

      const reloaded = app.FindRecordById("demo1", record.id);
      expect(reloaded).not.toBeNull();
      expect(reloaded?.GetString("text")).toBe("updated by jsvm app bind");
    } finally {
      await cleanup();
    }
  });

  it("http client binds count", () => {
    const scope: BindScope = {};
    httpClientBinds(scope);
    expect(countKeys(scope)).toBe(2);
    expect(countKeys(scope.$http)).toBe(2);
  });

  it.serial(
    "http client binds send",
    async () => {
      await using server = await startExternalServer(`const http = require("node:http");

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  if (url.searchParams.get("testError")) {
    res.statusCode = 400;
    res.end("");
    return;
  }

  const timeout = Number(url.searchParams.get("testTimeout") ?? "0");
  const handle = async () => {
    if (timeout > 0) {
      await new Promise((resolve) => setTimeout(resolve, timeout * 1000));
    }

    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const body = Buffer.concat(chunks).toString();
      const headers = {};
      for (const [key, value] of Object.entries(req.headers)) {
        if (value == null) {
          continue;
        }
        const normalized = key.toLowerCase().replace(/-/g, "_");
        headers[normalized] = Array.isArray(value) ? value.join(",") : String(value);
      }

      const info = {
        method: req.method,
        headers,
        body,
      };

      res.setHeader("X-Custom", "custom_header");
      res.setHeader("Set-Cookie", "sessionId=123456");
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(info));
    });
  };

  void handle();
});

server.listen(0, "127.0.0.1", () => {
  console.log(server.address().port);
});`);

      const scope: BindScope = {};
      baseBinds(scope);
      httpClientBinds(scope);

      let timeoutErr: Error | null = null;
      try {
        scope.$http.send({ url: `http://127.0.0.1:${server.port}/?testTimeout=3`, timeout: 1 });
      } catch (err) {
        timeoutErr = err as Error;
      }
      expect(timeoutErr).not.toBeNull();

      let timeoutAsyncErr: Error | null = null;
      try {
        await scope.$http.sendAsync({ url: `http://127.0.0.1:${server.port}/?testTimeout=3`, timeout: 1 });
      } catch (err) {
        timeoutAsyncErr = err as Error;
      }
      expect(timeoutAsyncErr).not.toBeNull();

      const test0 = scope.$http.send({ url: `http://127.0.0.1:${server.port}/?testError=1` });
      const test1 = scope.$http.send({
        method: "post",
        url: `http://127.0.0.1:${server.port}/`,
        headers: { header1: "123", header2: "456" },
        body: "789",
      });
      const test2 = scope.$http.send({
        url: `http://127.0.0.1:${server.port}/`,
        headers: { "content-type": "text/plain" },
      });
      const formData = new scope.FormData();
      formData.append("title", "123");
      const test3 = scope.$http.send({
        url: `http://127.0.0.1:${server.port}/`,
        body: formData,
        headers: { "content-type": "text/plain" },
      });
      const test4 = scope.$http.send({
        method: "post",
        url: `http://127.0.0.1:${server.port}/`,
        body: "test",
      });
      const test5 = await scope.$http.sendAsync({
        method: "post",
        url: `http://127.0.0.1:${server.port}/`,
        body: "test-async",
      });
      const test4Payload = JSON.parse(new TextDecoder().decode(test4.body));
      expect(test4Payload.body).toBe("test");
      expect(test4Payload.method).toBe("POST");
      expect(test4Payload.headers.accept_encoding).toBe("gzip");
      expect(test4Payload.headers.content_length).toBe("4");
      expect(test4Payload.headers.user_agent).toBe("Go-http-client/1.1");

      const test5Payload = JSON.parse(new TextDecoder().decode(test5.body));
      expect(test5Payload.body).toBe("test-async");
      expect(test5Payload.method).toBe("POST");
      expect(test5Payload.headers.accept_encoding).toBe("gzip");
      expect(test5Payload.headers.content_length).toBe("10");
      expect(test5Payload.headers.user_agent).toBe("Go-http-client/1.1");

      const scenarios: Array<[any, Record<string, unknown>]> = [
        [test0, { statusCode: "400" }],
        [
          test1,
          {
            statusCode: "200",
            "headers.X-Custom.0": "custom_header",
            "cookies.sessionId.value": "123456",
            "json.method": "POST",
            "json.headers.header1": "123",
            "json.headers.header2": "456",
            "json.body": "789",
          },
        ],
        [
          test2,
          {
            statusCode: "200",
            "headers.X-Custom.0": "custom_header",
            "cookies.sessionId.value": "123456",
            "json.method": "GET",
            "json.headers.content_type": "text/plain",
          },
        ],
        [
          test3,
          {
            statusCode: "200",
            "headers.X-Custom.0": "custom_header",
            "cookies.sessionId.value": "123456",
            "json.method": "GET",
            "json.body": ['\r\nContent-Disposition: form-data; name="title"\r\n\r\n123\r\n--'],
            "json.headers.content_type": ["multipart/form-data; boundary="],
          },
        ],
        [
          test4,
          {
            statusCode: "200",
            "headers.X-Custom.0": "custom_header",
            "cookies.sessionId.value": "123456",
          },
        ],
        [
          test5,
          {
            statusCode: "200",
            "headers.X-Custom.0": "custom_header",
            "cookies.sessionId.value": "123456",
          },
        ],
      ];

      for (const [result, expectations] of scenarios) {
        for (const [key, expectation] of Object.entries(expectations)) {
          const value = getNestedVal(result, key);
          if (Array.isArray(expectation)) {
            for (const exp of expectation) {
              expect(value).toContain(exp);
            }
            continue;
          }
          expect(String(value)).toBe(String(expectation));
        }
      }
    },
    30000,
  );

  it("cron binds count", () => {
    const scope: BindScope = {};
    // bind-count assertion only; avoid full test app bootstrap in this hot test file.
    cronBinds({} as any, scope);
    expect(countKeys(scope)).toBe(2);
  });

  it("hooks binds count", () => {
    const app = newUnbootstrappedTestApp();
    const scope: BindScope = {};
    hooksBinds(app, scope);
    expect(countKeys(scope)).toBe(82);
    expect(scope.onRecordRequestOTPRequest).toBeTypeOf("function");
    expect(scope.onRecordCreateOTPRequest).toBeUndefined();
  });

  it("hooks binds", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const result = { called: 0 };
      const scope: BindScope = {};
      baseBinds(scope);
      appBinds(scope, app);
      hooksBinds(app, scope);

      scope.onModelUpdate((e: any) => {
        result.called += 1;
        e.next();
      }, "demo1");

      scope.onModelUpdate(() => {
        throw new Error("example");
      }, "demo1");

      scope.onModelUpdate((e: any) => {
        result.called += 1;
        e.next();
      }, "demo2");

      scope.onModelUpdate((e: any) => {
        result.called += 1;
        e.next();
      }, "demo2");

      scope.onModelUpdate(() => {}, "demo2");

      scope.onModelUpdate((e: any) => {
        result.called += 1;
        e.next();
      }, "demo2");

      scope.onBootstrap(async (e: any) => {
        await e.next();

        const recordA = scope.$app.findFirstRecordByFilter("demo2", "1=1");
        recordA.set("title", "update");
        await scope.$app.save(recordA);
        if (result.called !== 2) {
          throw new Error(`Expected result.called to be 2, got ${result.called}`);
        }

        result.called = 0;

        let hasErr = false;
        try {
          const recordB = scope.$app.findFirstRecordByFilter("demo1", "1=1");
          recordB.set("text", "update");
          await scope.$app.save(recordB);
        } catch {
          hasErr = true;
        }
        if (!hasErr) {
          throw new Error("Expected an error to be thrown");
        }
        if (result.called !== 1) {
          throw new Error(`Expected result.called to be 1, got ${result.called}`);
        }
      });

      await app.bootstrapAsync();
    } finally {
      await cleanup();
    }
  });

  it("hooks exception unwrapping", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const scope: BindScope = {};
      baseBinds(scope);
      appBinds(scope, app);
      hooksBinds(app, scope);

      const goErr = new Error("test");
      scope.onModelUpdate(() => {
        throw goErr;
      }, "demo1");

      const record = app.FindFirstRecordByFilter("demo1", "1=1");
      record.Set("text", "update");
      const err = await app.Save(record);
      expect(err).toBe(goErr);
    } finally {
      await cleanup();
    }
  });

  it("router binds count", () => {
    const app = newUnbootstrappedTestApp();
    const scope: BindScope = {};
    routerBinds(app, scope);
    expect(countKeys(scope)).toBe(2);
  });

  it("router bind typings accept native hook handlers", async () => {
    const typesSource = await Bun.file(generatedTypesUrl).text();
    expect(typesSource).toContain(
      "((e: core.RequestEvent) => void) | Middleware | hook.Handler<core.RequestEvent | undefined>",
    );
    expect(typesSource).not.toContain("Array<string | ((e: core.RequestEvent) => void)");
  });

  it("router binds", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const result = {
        routeMiddlewareCalls: 0,
        globalMiddlewareCalls: 0,
      };

      const scope: BindScope = {};
      baseBinds(scope);
      apisBinds(scope);
      routerBinds(app, scope);

      scope.routerAdd(
        "GET",
        "/test",
        () => {
          result.routeMiddlewareCalls += 1;
        },
        (e: any) => {
          result.routeMiddlewareCalls += 1;
          return e.next();
        },
      );

      scope.routerAdd("GET", "/error", async () => {
        throw new ApiError(456, "test", null);
      });

      scope.routerUse((e: any) => {
        result.globalMiddlewareCalls += 1;
        return e.next();
      });

      const handler = buildServeHandler(app);

      const scenarios = [
        { method: "GET", path: "/test", routeCalls: 2, globalCalls: 1, code: 200 },
        { method: "GET", path: "/error", routeCalls: 0, globalCalls: 1, code: 456 },
      ];

      for (const scenario of scenarios) {
        result.routeMiddlewareCalls = 0;
        result.globalMiddlewareCalls = 0;

        const response = await handler(new Request(`http://127.0.0.1${scenario.path}`, { method: scenario.method }));
        expect(result.routeMiddlewareCalls).toBe(scenario.routeCalls);
        expect(result.globalMiddlewareCalls).toBe(scenario.globalCalls);
        expect(response.status).toBe(scenario.code);
      }
    } finally {
      await cleanup();
    }
  });

  it("router binds accept lowercase hook handler middleware", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const calls: string[] = [];

      const scope: BindScope = {};
      baseBinds(scope);
      routerBinds(app, scope);

      scope.routerUse({
        id: "global",
        priority: -1,
        func: (e: any) => {
          calls.push("global");
          return e.next();
        },
      });

      scope.routerAdd(
        "GET",
        "/lowercase-middleware",
        (e: any) => {
          calls.push("handler");
          return e.json(200, { ok: true });
        },
        {
          id: "route",
          priority: -2,
          func: (e: any) => {
            calls.push("route");
            return e.next();
          },
        },
      );

      const handler = buildServeHandler(app);
      const response = await handler(new Request("http://127.0.0.1/lowercase-middleware"));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ ok: true });
      expect(calls).toEqual(["route", "global", "handler"]);
    } finally {
      await cleanup();
    }
  });

  it("router binds accept $apis requireAuth middleware", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const scope: BindScope = {};
      baseBinds(scope);
      apisBinds(scope);
      routerBinds(app, scope);

      scope.routerAdd(
        "GET",
        "/protected",
        (e: any) => {
          return e.json(200, { ok: true });
        },
        scope.$apis.requireAuth(),
      );

      const handler = buildServeHandler(app);
      const guestResponse = await handler(new Request("http://127.0.0.1/protected"));
      expect(guestResponse.status).toBe(401);

      const authRecord = app.FindAuthRecordByEmail("users", "test@example.com");
      const authResponse = await handler(
        new Request("http://127.0.0.1/protected", {
          headers: { Authorization: authRecord.NewAuthToken() },
        }),
      );
      expect(authResponse.status).toBe(200);
      expect(await authResponse.json()).toEqual({ ok: true });
    } finally {
      await cleanup();
    }
  });

  it("filepath binds count", () => {
    const scope: BindScope = {};
    filepathBinds(scope);
    expect(countKeys(scope.$filepath)).toBe(15);
  });

  it("filepath binds glob, match, walk, and walkDir", async () => {
    const testDir = await mkdtemp(join(tmpdir(), "pocketbun-jsvm-filepath-"));
    try {
      await mkdir(join(testDir, "alpha", "nested"), { recursive: true });
      await writeFile(join(testDir, "root.txt"), "root");
      await writeFile(join(testDir, "alpha", "a.txt"), "a");
      await writeFile(join(testDir, "alpha", "nested", "n.txt"), "n");

      const scope: BindScope = {};
      filepathBinds(scope);

      const globMatches = scope.$filepath.glob(join(testDir, "**", "*.txt")).map((path: string) => relative(testDir, path));
      expect(globMatches).toEqual(["root.txt", join("alpha", "a.txt"), join("alpha", "nested", "n.txt")]);

      expect(scope.$filepath.match(join(testDir, "*.txt"), join(testDir, "root.txt"))).toBe(true);
      expect(scope.$filepath.match(join(testDir, "*.txt"), join(testDir, "alpha", "a.txt"))).toBe(false);

      const walked: string[] = [];
      scope.$filepath.walk(testDir, (path: string, info: { isDirectory: () => boolean } | null, err: Error | null) => {
        expect(err).toBeNull();
        walked.push(`${relative(testDir, path) || "."}:${info?.isDirectory() ? "dir" : "file"}`);
      });
      expect(walked).toEqual([
        ".:dir",
        `alpha:dir`,
        `${join("alpha", "a.txt")}:file`,
        `${join("alpha", "nested")}:dir`,
        `${join("alpha", "nested", "n.txt")}:file`,
        "root.txt:file",
      ]);

      const walkedDirs: string[] = [];
      scope.$filepath.walkDir(testDir, (path: string, entry: { isDirectory: () => boolean } | null, err: Error | null) => {
        expect(err).toBeNull();
        walkedDirs.push(`${relative(testDir, path) || "."}:${entry?.isDirectory() ? "dir" : "file"}`);
      });
      expect(walkedDirs).toEqual([
        ".:dir",
        `alpha:dir`,
        `${join("alpha", "a.txt")}:file`,
        `${join("alpha", "nested")}:dir`,
        `${join("alpha", "nested", "n.txt")}:file`,
        "root.txt:file",
      ]);
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  it("os binds count", () => {
    const scope: BindScope = {};
    osBinds(scope);
    expect(countKeys(scope.$os)).toBe(30);
  });

  it.serial(
    "os async binds",
    async () => {
      const testDir = await mkdtemp(join(tmpdir(), "pocketbun-jsvm-os-"));
      try {
        const scope: BindScope = {};
        osBinds(scope);

        const asyncDir = join(testDir, "os_async_dir");
        const asyncFile = join(asyncDir, "tmp.txt");
        const asyncFileRenamed = join(asyncDir, "tmp2.txt");

        await scope.$os.mkdirAllAsync(asyncDir);
        const dirInfo = await scope.$os.statAsync(asyncDir);
        expect(dirInfo.isDirectory()).toBe(true);

        await scope.$os.writeFileAsync(asyncFile, "abcd");
        const fileData = await scope.$os.readFileAsync(asyncFile);
        expect(new TextDecoder().decode(fileData)).toBe("abcd");

        const entries = await scope.$os.readDirAsync(asyncDir);
        const names = entries.map((entry: any) => (typeof entry === "string" ? entry : entry.name));
        expect(names).toContain("tmp.txt");

        await scope.$os.renameAsync(asyncFile, asyncFileRenamed);
        await scope.$os.truncateAsync(asyncFileRenamed, 1);

        const truncated = await scope.$os.readFileAsync(asyncFileRenamed);
        expect(new TextDecoder().decode(truncated)).toBe("a");

        await scope.$os.removeAsync(asyncFileRenamed);
        await scope.$os.removeAllAsync(asyncDir);
      } finally {
        await rm(testDir, { recursive: true, force: true });
      }
    },
    15000,
  );
});
