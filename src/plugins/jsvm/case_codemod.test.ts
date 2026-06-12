// PocketBun-only: regression tests for the JSVM uppercase-to-lowercase migration helper.

import { describe, expect, it } from "bun:test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { newTempDir } from "../../tests/fs.ts";
import { rewriteJSVMCase, runJSVMCaseCodemod } from "./case_codemod.ts";

describe("JSVM case codemod", () => {
  it("rewrites legacy uppercase member access without touching strings or comments", () => {
    const source = `// keep comment text e.Record.GetString
const text = "keep string text e.Record.GetString";
onRecordAfterCreateSuccess((e) => {
  const { Record } = e;
  const email = e.Record.GetString("email");
  return e.Next();
});
`;

    const result = rewriteJSVMCase(source);

    expect(result.changed).toBeTrue();
    expect(result.replacements).toBe(4);
    expect(result.code).toContain("// keep comment text e.Record.GetString");
    expect(result.code).toContain(`"keep string text e.Record.GetString"`);
    expect(result.code).toContain("const { record: Record } = e;");
    expect(result.code).toContain(`const email = e.record.getString("email");`);
    expect(result.code).toContain("return e.next();");
  });

  it("rewrites hook handler object keys and collection helper chains", () => {
    const source = `$app.OnServe().Bind({
  Func(e) {
    collection.Fields.Add(new TextField({ Name: "title" }));
    return e.Next();
  },
  Id: "route",
  Priority: 10,
});
`;

    const result = rewriteJSVMCase(source);

    expect(result.changed).toBeTrue();
    expect(result.code).toContain("$app.onServe().bind({");
    expect(result.code).toContain("func(e) {");
    expect(result.code).toContain(`collection.fields.add(new TextField({ name: "title" }));`);
    expect(result.code).toContain(`id: "route"`);
    expect(result.code).toContain("priority: 10");
    expect(result.code).toContain("return e.next();");
  });

  it("rewrites string-literal element access", () => {
    const source = `const value = e['Record']["GetString"]("email");\n`;

    const result = rewriteJSVMCase(source);

    expect(result.changed).toBeTrue();
    expect(result.code).toContain(`e['record']["getString"]("email")`);
  });

  it("preserves existing indentation and blank lines", () => {
    const source = `onRecordAfterCreateSuccess((e) => {

\tif (e.Record) {
\t\treturn e.Record.GetString("email");
\t}

\tconst {  Record  } = e;
\treturn Record.GetString("email");
});
`;

    const result = rewriteJSVMCase(source);

    expect(result.changed).toBeTrue();
    expect(result.code).toBe(`onRecordAfterCreateSuccess((e) => {

\tif (e.record) {
\t\treturn e.record.getString("email");
\t}

\tconst {  record: Record  } = e;
\treturn Record.getString("email");
});
`);
  });

  it("rewrites released PocketBun server-side JavaScript aliases", () => {
    const source = `import {
  type JSVMConfig,
  MustRegisterHooksPluginAsync,
  RegisterHooksPlugin,
  RegisterJSVM as registerJSVM,
  TemplateLangGo,
} from "pocketbun";

const config: JSVMConfig = { TemplateLang: TemplateLangGo };
RegisterHooksPlugin(app, config);
registerJSVM(app, { TemplateLang: TemplateLangGo });
await MustRegisterHooksPluginAsync(app, config);
`;

    const result = rewriteJSVMCase(source);

    expect(result.changed).toBeTrue();
    expect(result.code).toBe(`import {
  type ServerJSConfig,
  MustRegisterServerJSAsync,
  RegisterServerJS,
  RegisterServerJS as registerJSVM,
  TemplateLangJS,
} from "pocketbun";

const config: ServerJSConfig = { TemplateLang: TemplateLangJS };
RegisterServerJS(app, config);
registerJSVM(app, { TemplateLang: TemplateLangJS });
await MustRegisterServerJSAsync(app, config);
`);
  });

  it("updates old generated collection migrations to use the migration app view", () => {
    const source = `migrate((app) => {
  const collection = new Collection({ id: "posts" });

  return app.Save(collection);
}, (app) => {
  const collection = app.FindCollectionByNameOrId("posts");

  return app.Delete(collection);
});

migrate((app) => {
  const snapshot = [];

  return app.ImportCollections(snapshot, false);
}, (app) => {
  return null;
});
`;

    const result = rewriteJSVMCase(source);

    expect(result.changed).toBeTrue();
    expect(result.code).toBe(`migrate((app) => {
  const migrationApp = app.forMigrations();
  const collection = new Collection({ id: "posts" });

  return migrationApp.save(collection);
}, (app) => {
  const migrationApp = app.forMigrations();
  const collection = migrationApp.findCollectionByNameOrId("posts");

  return migrationApp.delete(collection);
});

migrate((app) => {
  const migrationApp = app.forMigrations();
  const snapshot = [];

  return migrationApp.importCollections(snapshot, false);
}, (app) => {
  return null;
});
`);
  });

  it("does not route ordinary data migrations through forMigrations", () => {
    const source = `migrate((app) => {
  const record = app.FindRecordById("posts", "abc");

  return app.Save(record);
});
`;

    const result = rewriteJSVMCase(source);

    expect(result.changed).toBeTrue();
    expect(result.code).toBe(`migrate((app) => {
  const record = app.findRecordById("posts", "abc");

  return app.save(record);
});
`);
  });

  it("checks and writes default pb_hooks and pb_migrations paths", async () => {
    await using dir = await newTempDir("pocketbun-jsvm-case-codemod-");
    const hooksDir = join(dir.path, "pb_hooks");
    const migrationsDir = join(dir.path, "pb_migrations");
    await mkdir(hooksDir, { recursive: true });
    await mkdir(migrationsDir, { recursive: true });
    await writeFile(join(hooksDir, "main.pb.js"), `onBootstrap((e) => e.Next());\n`);
    await writeFile(join(migrationsDir, "001_init.js"), `migrate((app) => app.FindCollectionByNameOrId("posts"));\n`);

    const check = await runJSVMCaseCodemod([], { cwd: dir.path, check: true });
    expect(check.scanned).toBe(2);
    expect(check.changed).toBe(2);
    expect(check.files.every((file) => !file.written)).toBeTrue();
    expect(await readFile(join(hooksDir, "main.pb.js"), "utf8")).toContain("e.Next()");

    const write = await runJSVMCaseCodemod([], { cwd: dir.path });
    expect(write.scanned).toBe(2);
    expect(write.changed).toBe(2);
    expect(write.files.every((file) => file.written)).toBeTrue();
    expect(await readFile(join(hooksDir, "main.pb.js"), "utf8")).toContain("e.next()");
    expect(await readFile(join(migrationsDir, "001_init.js"), "utf8")).toContain("app.findCollectionByNameOrId");
  });
});
