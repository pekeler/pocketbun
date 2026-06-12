// PocketBun-only: regression tests for the JSVM deprecated-uppercase-to-lowercase migration helper.

import { describe, expect, it } from "bun:test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { newTempDir } from "../../tests/fs.ts";
import { rewriteJSVMCase, runJSVMCaseCodemod } from "./case_codemod.ts";

describe("JSVM case codemod", () => {
  it("rewrites deprecated uppercase member access without touching strings or comments", () => {
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
    if (!e.Router.HasRoute("GET", "/")) {
      e.Router.GET("/", (requestEvent) => requestEvent.JSON(200, {})).BindFunc(() => null);
    }
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
    expect(result.code).toContain(`if (!e.router.hasRoute("GET", "/")) {`);
    expect(result.code).toContain(`e.router.get("/", (requestEvent) => requestEvent.json(200, {})).bindFunc(() => null);`);
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
  New,
  RegisterMigrateCmd,
  RequireGuestOnly,
  MustRegisterHooksPluginAsync,
  RegisterHooksPlugin,
  RegisterJSVM as registerJSVM,
  TemplateLangGo,
  TemplateLangJS,
} from "pocketbun";

const config: JSVMConfig = { TemplateLang: TemplateLangGo, HooksDir: "pb_hooks" };
RegisterHooksPlugin(app, config);
registerJSVM(app, { TemplateLang: TemplateLangGo });
await MustRegisterHooksPluginAsync(app, config);
RegisterMigrateCmd(app, app.RootCmd, { TemplateLang: TemplateLangJS, Automigrate: true, Dir: "pb_migrations" });
New().RootCmd.AddCommand(new Command({ Use: "hello", RunE: () => null }));
RequireGuestOnly();
`;

    const result = rewriteJSVMCase(source);

    expect(result.changed).toBeTrue();
    expect(result.code).toBe(`import {
  type ServerJSConfig,
  newPocketBase,
  registerMigrateCmd,
  requireGuestOnly,
  mustRegisterServerJSAsync,
  registerServerJS,
  registerServerJS as registerJSVM,
  templateLangJS,
  templateLangJS,
} from "pocketbun";

const config: ServerJSConfig = { templateLang: templateLangJS, hooksDir: "pb_hooks" };
registerServerJS(app, config);
registerJSVM(app, { templateLang: templateLangJS });
await mustRegisterServerJSAsync(app, config);
registerMigrateCmd(app, app.rootCmd, { templateLang: templateLangJS, automigrate: true, dir: "pb_migrations" });
newPocketBase().rootCmd.addCommand(new Command({ use: "hello", runE: () => null }));
requireGuestOnly();
`);
  });

  it("rewrites deprecated runtime names from generated server-side JavaScript types", () => {
    const source = `migrate((app) => {
  return app.RunInTransaction((txApp) => {
    txApp.RunInTransaction(() => null);

    const record = app.FindFirstRecordByFilter("posts", "1=1");
    app.FindRecordsByFilter("posts", "title = {:title}", "-created", 10, 0, {});
    app.Save(record);
    app.CreateBackup(null, "backup.zip");
    app.Restart();
    app.RecordQuery("posts");
    app.SyncRecordTableSchema(record.Collection(), null);
    record.GetString("title");
    record.GetUnsavedFiles("docs");
    record.GetUploadedFiles("docs");
    record.UnmarshalJSONField("meta", {});
    record.ExpandedOne("author");
    record.ExpandedAll("tags");
    record.IgnoreUnchangedFields(true);
    record.MarshalJSON();
    record.UnmarshalJSON("{}");

    const created = record.GetDateTime("created");
    created.IsZero();
    created.Before(new DateTime());
    created.After(new DateTime());
    created.Compare(new DateTime());
    created.MarshalJSON();
    created.UnmarshalJSON('"2024-01-01 00:00:00.000Z"');
    created.Value();

    const form = new RecordUpsertForm(app, record);
    form.SetContext(null);
    form.SetApp(app);
    form.SetRecord(record);
    form.ResetAccess();
    form.GrantManagerAccess();
    form.GrantSuperuserAccess();
    form.HasManageAccess();
    form.Load({});
    form.DrySubmit(() => null);
    form.Submit();

    const apple = new AppleClientSecretCreateForm(app);
    apple.ClientId = "client";
    apple.TeamId = "team";
    apple.KeyId = "key";
    apple.PrivateKey = "private";
    apple.Duration = 60;
    apple.Validate();
    apple.Submit();

    const email = new TestEmailSendForm(app);
    email.Email = "test@example.com";
    email.Template = "verification";
    email.Collection = "users";
    email.Validate();
    email.Submit();

    const s3 = new TestS3FilesystemForm(app);
    s3.Filesystem = "storage";
    s3.Validate();
    s3.Submit();

    const apiErr = new ApiError(400, "bad");
    apiErr.Error();
    apiErr.RawData();
    apiErr.Is(new Error("bad"));
    apiErr.Status;
    apiErr.Message;
    apiErr.Data;

    const validationErr = new ValidationError("code", "message");
    validationErr.Error();
    validationErr.Code();
    validationErr.Message();
    validationErr.SetMessage("next");
    validationErr.Params();
    validationErr.SetParams({});
  });
});
`;

    const result = rewriteJSVMCase(source);

    expect(result.changed).toBeTrue();
    expect(result.code).toContain("app.runInTransaction((txApp) => {");
    expect(result.code).toContain("txApp.runInTransaction(() => null);");
    expect(result.code).toContain('app.findRecordsByFilter("posts", "title = {:title}", "-created", 10, 0, {});');
    expect(result.code).toContain("app.save(record);");
    expect(result.code).toContain('app.createBackup(null, "backup.zip");');
    expect(result.code).toContain("app.restart();");
    expect(result.code).toContain('app.recordQuery("posts");');
    expect(result.code).toContain("app.syncRecordTableSchema(record.collection(), null);");
    expect(result.code).toContain('record.getString("title");');
    expect(result.code).toContain('record.getUnsavedFiles("docs");');
    expect(result.code).toContain('record.unmarshalJSONField("meta", {});');
    expect(result.code).toContain("record.ignoreUnchangedFields(true);");
    expect(result.code).toContain("created.isZero();");
    expect(result.code).toContain("created.before(new DateTime());");
    expect(result.code).toContain("created.after(new DateTime());");
    expect(result.code).toContain("created.compare(new DateTime());");
    expect(result.code).toContain("created.marshalJSON();");
    expect(result.code).toContain("form.grantSuperuserAccess();");
    expect(result.code).toContain("form.hasManageAccess();");
    expect(result.code).toContain('apple.clientId = "client";');
    expect(result.code).toContain('apple.privateKey = "private";');
    expect(result.code).toContain('email.collection = "users";');
    expect(result.code).toContain('s3.filesystem = "storage";');
    expect(result.code).toContain("apiErr.rawData();");
    expect(result.code).toContain("apiErr.status;");
    expect(result.code).toContain('validationErr.setMessage("next");');
    expect(result.code).toContain("validationErr.setParams({});");
  });

  it("rewrites latest audited runtime and option names", () => {
    const source = `onBootstrap((e) => {
  const requestInfo = new RequestInfo({
    Auth: e.Auth,
    Body: {},
    Headers: {},
    Context: new Context(),
  });
  requestInfo.HasSuperuserAuth();
  requestInfo.Clone();

  const cookie = new Cookie({
    Name: "sid",
    Value: "abc",
    Quoted: true,
    Expires: new DateTime(),
    RawExpires: "soon",
    Partitioned: true,
    Raw: "raw",
    Unparsed: ["x"],
  });
  cookie.String();
  cookie.Valid();

  const command = new Command({
    Use: "serve",
    Short: "Serve",
    Long: "Serve app",
    Version: "1",
    SilenceUsage: true,
    ValidArgs: ["serve"],
    RunE: () => null,
    Hidden: false,
    FParseErrWhitelist: { UnknownFlags: true },
    CompletionOptions: { DisableDefaultCmd: true },
  });
  $app.RootCmd.AddCommand(command);
  command.AddCommand(new Command({ Use: "child" }));
  command.SetOut({ Write: () => null });
  command.SetErr({ Write: () => null });
  command.SetHelpCommand(new Command());
  command.PersistentFlags();
  command.Flags();
  command.ParseFlags([]);
  command.Find([]);
  command.Execute();
  command.Name();

  const message = new SubscriptionMessage({ Name: "update", Data: [] });
  message.WriteSSE({ Write: () => null }, "event-id");

  const ctx = new Context();
  ctx.Deadline();
  ctx.Done();
  ctx.Err();
  ctx.Value("key");

  const provider = { Logo: () => "", Order: () => 0 };
  provider.Logo();
  provider.Order();

  const field = new TextField({ Name: "title", Help: "shown" });
  field.Help = "updated";
});
`;

    const result = rewriteJSVMCase(source);

    expect(result.changed).toBeTrue();
    expect(result.code).toContain("new RequestInfo({");
    expect(result.code).toContain("auth: e.auth");
    expect(result.code).toContain("body: {}");
    expect(result.code).toContain("headers: {}");
    expect(result.code).toContain("context: new Context()");
    expect(result.code).toContain("requestInfo.hasSuperuserAuth();");
    expect(result.code).toContain("requestInfo.clone();");
    expect(result.code).toContain('name: "sid"');
    expect(result.code).toContain('value: "abc"');
    expect(result.code).toContain("quoted: true");
    expect(result.code).toContain("expires: new DateTime()");
    expect(result.code).toContain('rawExpires: "soon"');
    expect(result.code).toContain("partitioned: true");
    expect(result.code).toContain('raw: "raw"');
    expect(result.code).toContain('unparsed: ["x"]');
    expect(result.code).toContain("cookie.string();");
    expect(result.code).toContain("cookie.valid();");
    expect(result.code).toContain('use: "serve"');
    expect(result.code).toContain('short: "Serve"');
    expect(result.code).toContain('long: "Serve app"');
    expect(result.code).toContain('version: "1"');
    expect(result.code).toContain("silenceUsage: true");
    expect(result.code).toContain('validArgs: ["serve"]');
    expect(result.code).toContain("runE: () => null");
    expect(result.code).toContain("hidden: false");
    expect(result.code).toContain("fParseErrWhitelist: { unknownFlags: true }");
    expect(result.code).toContain("completionOptions: { disableDefaultCmd: true }");
    expect(result.code).toContain("$app.rootCmd.addCommand(command);");
    expect(result.code).toContain('command.addCommand(new Command({ use: "child" }));');
    expect(result.code).toContain("command.setOut({ write: () => null });");
    expect(result.code).toContain("command.setErr({ write: () => null });");
    expect(result.code).toContain("command.setHelpCommand(new Command());");
    expect(result.code).toContain("command.persistentFlags();");
    expect(result.code).toContain("command.flags();");
    expect(result.code).toContain("command.parseFlags([]);");
    expect(result.code).toContain("command.find([]);");
    expect(result.code).toContain("command.execute();");
    expect(result.code).toContain("command.name();");
    expect(result.code).toContain('new SubscriptionMessage({ name: "update", data: [] });');
    expect(result.code).toContain('message.writeSSE({ write: () => null }, "event-id");');
    expect(result.code).toContain("ctx.deadline();");
    expect(result.code).toContain("ctx.done();");
    expect(result.code).toContain("ctx.err();");
    expect(result.code).toContain('ctx.value("key");');
    expect(result.code).toContain('const provider = { logo: () => "", order: () => 0 };');
    expect(result.code).toContain("provider.logo();");
    expect(result.code).toContain("provider.order();");
    expect(result.code).toContain('new TextField({ name: "title", help: "shown" });');
    expect(result.code).toContain('field.help = "updated";');
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
