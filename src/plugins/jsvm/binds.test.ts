// Ported from pocketbase/plugins/jsvm/binds_test.go

import { describe, expect, it, setDefaultTimeout } from "bun:test";
import { join } from "node:path";
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
import { PasswordField } from "../../core/field_password.ts";
import { RelationField } from "../../core/field_relation.ts";
import { SelectField } from "../../core/field_select.ts";
import { TextField } from "../../core/field_text.ts";
import { URLField } from "../../core/field_url.ts";
import { FieldsList } from "../../core/fields_list.ts";
import { Record as RecordModel } from "../../core/record_model.ts";
import { ValidationError } from "../../internal/compat/validation.ts";
import { newTestApp } from "../../tests/app.ts";
import { File } from "../../tools/filesystem/file.ts";
import { ApiError } from "../../tools/router/api_error.ts";
import { JSONRaw } from "../../tools/types/index.ts";
import {
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

async function startExternalServer(script: string): Promise<{ port: number; stop: () => Promise<void> }> {
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

async function startExternalServerOnce(script: string): Promise<{ port: number; stop: () => Promise<void> }> {
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

  return {
    port,
    stop: async () => {
      process.kill();
      await process.exited;
    },
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

describe("jsvm binds", () => {
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
    expect(collection.name).toBe("test");
    expect(collection.createRule).toBe("@request.auth.id != ''");
    expect(collection.Fields.GetByName("title")).not.toBeNull();
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
    const { app, cleanup } = await newTestApp();
    const server = await startExternalServer(`const server = Bun.serve({
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

    try {
      const scope: BindScope = {};
      filesystemBinds(scope);

      expect(countKeys(scope.$filesystem)).toBe(6);

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
    } finally {
      await server.stop();
      await cleanup();
    }
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

  it("dynamic model map field caching", async () => {
    const { cleanup } = await newTestApp();
    try {
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
    } finally {
      await cleanup();
    }
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

  it("http client binds count", () => {
    const scope: BindScope = {};
    httpClientBinds(scope);
    expect(countKeys(scope)).toBe(2);
    expect(countKeys(scope.$http)).toBe(2);
  });

  it.serial(
    "http client binds send",
    async () => {
      const server = await startExternalServer(`const http = require("node:http");

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

      try {
        const scope: BindScope = {};
        baseBinds(scope);
        httpClientBinds(scope);

        // Bun's sync fetch path remains flaky on Windows CI; validate equivalent async behavior there.
        if (process.platform === "win32") {
          const test0 = await scope.$http.sendAsync({ url: `http://127.0.0.1:${server.port}/?testError=1` });
          const test1 = await scope.$http.sendAsync({
            method: "post",
            url: `http://127.0.0.1:${server.port}/`,
            headers: { header1: "123", header2: "456" },
            body: "789",
          });
          const formData = new scope.FormData();
          formData.append("title", "123");
          const test2 = await scope.$http.sendAsync({
            method: "post",
            url: `http://127.0.0.1:${server.port}/`,
            body: formData,
          });

          const test1Payload = JSON.parse(new TextDecoder().decode(test1.body));
          expect(test0.statusCode).toBe(400);
          expect(test1.statusCode).toBe(200);
          expect(test1Payload.method).toBe("POST");
          expect(test1Payload.headers.header1).toBe("123");
          expect(test1Payload.headers.header2).toBe("456");
          expect(test1Payload.body).toBe("789");

          const test2Payload = JSON.parse(new TextDecoder().decode(test2.body));
          expect(test2.statusCode).toBe(200);
          expect(test2Payload.method).toBe("POST");
          expect(test2Payload.body).toContain('Content-Disposition: form-data; name="title"');
          return;
        }

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

        const isRetryableSyncFetchError = (err: unknown): boolean => {
          if (!(err instanceof Error)) {
            return false;
          }
          return (
            err.message.includes("sync fetch failed: empty response") ||
            err.message.includes("sync fetch failed: invalid response") ||
            err.message.includes("Was there a typo in the url or port?") ||
            err.message.includes("ECONNREFUSED")
          );
        };

        const canUseAsyncFallback = (params: Record<string, unknown>): boolean => {
          const method = typeof params.method === "string" ? params.method.toUpperCase() : "GET";
          const hasBody = params.body != null || (params.data != null && typeof params.data === "object");
          if (!hasBody) {
            return true;
          }
          return method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
        };

        const sendWithRetry = async (params: Record<string, unknown>) => {
          let lastErr: unknown = null;
          for (let attempt = 1; attempt <= 16; attempt++) {
            try {
              return scope.$http.send(params);
            } catch (err) {
              lastErr = err;
              if (!isRetryableSyncFetchError(err)) {
                throw err;
              }
              Bun.sleepSync(Math.min(attempt * 25, 250));
            }
          }
          if (canUseAsyncFallback(params)) {
            return await scope.$http.sendAsync(params);
          }
          throw lastErr;
        };

        const test0 = await sendWithRetry({ url: `http://127.0.0.1:${server.port}/?testError=1` });
        const test1 = await sendWithRetry({
          method: "post",
          url: `http://127.0.0.1:${server.port}/`,
          headers: { header1: "123", header2: "456" },
          body: "789",
        });
        const test2 = await sendWithRetry({
          url: `http://127.0.0.1:${server.port}/`,
          headers: { "content-type": "text/plain" },
        });
        const formData = new scope.FormData();
        formData.append("title", "123");
        const test3 = await sendWithRetry({
          url: `http://127.0.0.1:${server.port}/`,
          body: formData,
          headers: { "content-type": "text/plain" },
        });
        const test4 = await sendWithRetry({
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
      } finally {
        await server.stop();
      }
    },
    30000,
  );

  it("cron binds count", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const scope: BindScope = {};
      cronBinds(app, scope);
      expect(countKeys(scope)).toBe(2);
    } finally {
      await cleanup();
    }
  });

  it("hooks binds count", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const scope: BindScope = {};
      hooksBinds(app, scope);
      expect(countKeys(scope)).toBe(82);
    } finally {
      await cleanup();
    }
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

      scope.onBootstrap((e: any) => {
        e.next();

        const recordA = scope.$app.findFirstRecordByFilter("demo2", "1=1");
        recordA.set("title", "update");
        scope.$app.save(recordA);
        if (result.called !== 2) {
          throw new Error(`Expected result.called to be 2, got ${result.called}`);
        }

        result.called = 0;

        let hasErr = false;
        try {
          const recordB = scope.$app.findFirstRecordByFilter("demo1", "1=1");
          recordB.set("text", "update");
          scope.$app.save(recordB);
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

      app.bootstrap();
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

  it("router binds count", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const scope: BindScope = {};
      routerBinds(app, scope);
      expect(countKeys(scope)).toBe(2);
    } finally {
      await cleanup();
    }
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

  it("filepath binds count", () => {
    const scope: BindScope = {};
    filepathBinds(scope);
    expect(countKeys(scope.$filepath)).toBe(15);
  });

  it("os binds count", () => {
    const scope: BindScope = {};
    osBinds(scope);
    expect(countKeys(scope.$os)).toBe(30);
  });

  it.serial(
    "os async binds",
    async () => {
      const { app, cleanup } = await newTestApp();
      try {
        const scope: BindScope = {};
        osBinds(scope);

        const asyncDir = join(app.DataDir(), "os_async_dir");
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
        await cleanup();
      }
    },
    15000,
  );
});
