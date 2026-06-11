// Ported from pocketbase/plugins/migratecmd/migratecmd_test.go

import type { Dirent } from "node:fs";
import { describe, expect, it } from "bun:test";
import { readFile, readdir } from "node:fs/promises";
import { basename, join } from "node:path";
import { NewAuthCollection } from "../../core/collection_model.ts";
import { OAuth2ProviderConfig } from "../../core/collection_model_auth_options.ts";
import { RequestEvent } from "../../core/event_request.ts";
import { CollectionRequestEvent } from "../../core/events.ts";
import { BoolField } from "../../core/field_bool.ts";
import { NumberField } from "../../core/field_number.ts";
import { TextField } from "../../core/field_text.ts";
import { MigrationsList } from "../../core/migrations_list.ts";
import { MigrationsRunner } from "../../core/migrations_runner.ts";
import { newTestApp } from "../../tests/app.ts";
import { Command } from "../../tools/cli/command.ts";
import { JSONArray, Pointer } from "../../tools/types/index.ts";
import { appBinds } from "../jsvm/binds.ts";
import { Register as RegisterJSVM } from "../jsvm/jsvm.ts";
import { MustRegister, Register, TemplateLangGo, TemplateLangJS } from "./migratecmd.ts";

const createExpectedJS = String.raw`
/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const migrationApp = app.forMigrations();
  const collection = new Collection({
    "authAlert": {
      "emailTemplate": {
        "body": "<p>Hello,</p>\n<p>We noticed a login to your {APP_NAME} account from a new location:</p>\n<p><em>{ALERT_INFO}</em></p>\n<p><strong>If this wasn't you, you should immediately change your {APP_NAME} account password to revoke access from all other locations.</strong></p>\n<p>If this was you, you may disregard this email.</p>\n<p>\n  Thanks,<br/>\n  {APP_NAME} team\n</p>",
        "subject": "Login from a new location"
      },
      "enabled": true
    },
    "authRule": "",
    "authToken": {
      "duration": 432000
    },
    "confirmEmailChangeTemplate": {
      "body": "<p>Hello,</p>\n<p>Click on the button below to confirm your new email address.</p>\n<p>\n  <a class=\"btn\" href=\"{APP_URL}/_/#/auth/confirm-email-change/{TOKEN}\" target=\"_blank\" rel=\"noopener\">Confirm new email</a>\n</p>\n<p><i>If you didn't ask to change your email address, please ignore this email.</i></p>\n<p>\n  Thanks,<br/>\n  {APP_NAME} team\n</p>",
      "subject": "Confirm your {APP_NAME} new email address"
    },
    "createRule": null,
    "deleteRule": null,
    "emailChangeToken": {
      "duration": 1800
    },
    "fields": [
      {
        "autogeneratePattern": "[a-z0-9]{15}",
        "help": "",
        "hidden": false,
        "id": "text@TEST_RANDOM",
        "max": 15,
        "min": 15,
        "name": "id",
        "pattern": "^[a-z0-9]+$",
        "presentable": false,
        "primaryKey": true,
        "required": true,
        "system": true,
        "type": "text"
      },
      {
        "cost": 0,
        "help": "",
        "hidden": true,
        "id": "password@TEST_RANDOM",
        "max": 0,
        "min": 8,
        "name": "password",
        "pattern": "",
        "presentable": false,
        "required": true,
        "system": true,
        "type": "password"
      },
      {
        "autogeneratePattern": "[a-zA-Z0-9]{50}",
        "help": "",
        "hidden": true,
        "id": "text@TEST_RANDOM",
        "max": 60,
        "min": 30,
        "name": "tokenKey",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": true,
        "system": true,
        "type": "text"
      },
      {
        "exceptDomains": null,
        "help": "",
        "hidden": false,
        "id": "email@TEST_RANDOM",
        "name": "email",
        "onlyDomains": null,
        "presentable": false,
        "required": true,
        "system": true,
        "type": "email"
      },
      {
        "help": "",
        "hidden": false,
        "id": "bool@TEST_RANDOM",
        "name": "emailVisibility",
        "presentable": false,
        "required": false,
        "system": true,
        "type": "bool"
      },
      {
        "help": "",
        "hidden": false,
        "id": "bool@TEST_RANDOM",
        "name": "verified",
        "presentable": false,
        "required": false,
        "system": true,
        "type": "bool"
      }
    ],
    "fileToken": {
      "duration": 180
    },
    "id": "@TEST_RANDOM",
    "indexes": [
      "create index test on new_name (id)",
      "CREATE UNIQUE INDEX \`idx_tokenKey_@TEST_RANDOM\` ON \`new_name\` (\`tokenKey\`)",
      "CREATE UNIQUE INDEX \`idx_email_@TEST_RANDOM\` ON \`new_name\` (\`email\`) WHERE \`email\` != ''"
    ],
    "listRule": "@request.auth.id != '' && 1 > 0 || 'backtick\`test' = 0",
    "manageRule": "1 != 2",
    "mfa": {
      "duration": 600,
      "enabled": false,
      "rule": ""
    },
    "name": "new_name",
    "oauth2": {
      "enabled": false,
      "mappedFields": {
        "avatarURL": "",
        "id": "",
        "name": "",
        "username": ""
      }
    },
    "otp": {
      "duration": 180,
      "emailTemplate": {
        "body": "<p>Hello,</p>\n<p>Your one-time password is: <strong>{OTP}</strong></p>\n<p><i>If you didn't ask for the one-time password, you can ignore this email.</i></p>\n<p>\n  Thanks,<br/>\n  {APP_NAME} team\n</p>",
        "subject": "OTP for {APP_NAME}"
      },
      "enabled": false,
      "length": 8
    },
    "passwordAuth": {
      "enabled": true,
      "identityFields": [
        "email"
      ]
    },
    "passwordResetToken": {
      "duration": 1800
    },
    "resetPasswordTemplate": {
      "body": "<p>Hello,</p>\n<p>Click on the button below to reset your password.</p>\n<p>\n  <a class=\"btn\" href=\"{APP_URL}/_/#/auth/confirm-password-reset/{TOKEN}\" target=\"_blank\" rel=\"noopener\">Reset password</a>\n</p>\n<p><i>If you didn't ask to reset your password, please ignore this email.</i></p>\n<p>\n  Thanks,<br/>\n  {APP_NAME} team\n</p>",
      "subject": "Reset your {APP_NAME} password"
    },
    "system": true,
    "type": "auth",
    "updateRule": null,
    "verificationTemplate": {
      "body": "<p>Hello,</p>\n<p>Thank you for joining us at {APP_NAME}.</p>\n<p>Click on the button below to verify your email address.</p>\n<p>\n  <a class=\"btn\" href=\"{APP_URL}/_/#/auth/confirm-verification/{TOKEN}\" target=\"_blank\" rel=\"noopener\">Verify</a>\n</p>\n<p><i>If you didn't recently register, please ignore this email.</i></p>\n<p>\n  Thanks,<br/>\n  {APP_NAME} team\n</p>",
      "subject": "Verify your {APP_NAME} email"
    },
    "verificationToken": {
      "duration": 86400
    },
    "viewRule": "id = \"1\""
  });

  return migrationApp.save(collection);
}, (app) => {
  const migrationApp = app.forMigrations();
  const collection = migrationApp.findCollectionByNameOrId("@TEST_RANDOM");

  return migrationApp.delete(collection);
})
`;

const deleteExpectedJS = String.raw`
/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const migrationApp = app.forMigrations();
  const collection = migrationApp.findCollectionByNameOrId("@TEST_RANDOM");

  return migrationApp.delete(collection);
}, (app) => {
  const migrationApp = app.forMigrations();
  const collection = new Collection({
    "authAlert": {
      "emailTemplate": {
        "body": "<p>Hello,</p>\n<p>We noticed a login to your {APP_NAME} account from a new location:</p>\n<p><em>{ALERT_INFO}</em></p>\n<p><strong>If this wasn't you, you should immediately change your {APP_NAME} account password to revoke access from all other locations.</strong></p>\n<p>If this was you, you may disregard this email.</p>\n<p>\n  Thanks,<br/>\n  {APP_NAME} team\n</p>",
        "subject": "Login from a new location"
      },
      "enabled": true
    },
    "authRule": "",
    "authToken": {
      "duration": 432000
    },
    "confirmEmailChangeTemplate": {
      "body": "<p>Hello,</p>\n<p>Click on the button below to confirm your new email address.</p>\n<p>\n  <a class=\"btn\" href=\"{APP_URL}/_/#/auth/confirm-email-change/{TOKEN}\" target=\"_blank\" rel=\"noopener\">Confirm new email</a>\n</p>\n<p><i>If you didn't ask to change your email address, please ignore this email.</i></p>\n<p>\n  Thanks,<br/>\n  {APP_NAME} team\n</p>",
      "subject": "Confirm your {APP_NAME} new email address"
    },
    "createRule": null,
    "deleteRule": null,
    "emailChangeToken": {
      "duration": 1800
    },
    "fields": [
      {
        "autogeneratePattern": "[a-z0-9]{15}",
        "help": "",
        "hidden": false,
        "id": "text@TEST_RANDOM",
        "max": 15,
        "min": 15,
        "name": "id",
        "pattern": "^[a-z0-9]+$",
        "presentable": false,
        "primaryKey": true,
        "required": true,
        "system": true,
        "type": "text"
      },
      {
        "cost": 0,
        "help": "",
        "hidden": true,
        "id": "password@TEST_RANDOM",
        "max": 0,
        "min": 8,
        "name": "password",
        "pattern": "",
        "presentable": false,
        "required": true,
        "system": true,
        "type": "password"
      },
      {
        "autogeneratePattern": "[a-zA-Z0-9]{50}",
        "help": "",
        "hidden": true,
        "id": "text@TEST_RANDOM",
        "max": 60,
        "min": 30,
        "name": "tokenKey",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": true,
        "system": true,
        "type": "text"
      },
      {
        "exceptDomains": null,
        "help": "",
        "hidden": false,
        "id": "email@TEST_RANDOM",
        "name": "email",
        "onlyDomains": null,
        "presentable": false,
        "required": true,
        "system": true,
        "type": "email"
      },
      {
        "help": "",
        "hidden": false,
        "id": "bool@TEST_RANDOM",
        "name": "emailVisibility",
        "presentable": false,
        "required": false,
        "system": true,
        "type": "bool"
      },
      {
        "help": "",
        "hidden": false,
        "id": "bool@TEST_RANDOM",
        "name": "verified",
        "presentable": false,
        "required": false,
        "system": true,
        "type": "bool"
      }
    ],
    "fileToken": {
      "duration": 180
    },
    "id": "@TEST_RANDOM",
    "indexes": [
      "create index test on test123 (id)",
      "CREATE UNIQUE INDEX \`idx_tokenKey_@TEST_RANDOM\` ON \`test123\` (\`tokenKey\`)",
      "CREATE UNIQUE INDEX \`idx_email_@TEST_RANDOM\` ON \`test123\` (\`email\`) WHERE \`email\` != ''"
    ],
    "listRule": "@request.auth.id != '' && 1 > 0 || 'backtick\`test' = 0",
    "manageRule": "1 != 2",
    "mfa": {
      "duration": 600,
      "enabled": false,
      "rule": ""
    },
    "name": "test123",
    "oauth2": {
      "enabled": false,
      "mappedFields": {
        "avatarURL": "",
        "id": "",
        "name": "",
        "username": ""
      }
    },
    "otp": {
      "duration": 180,
      "emailTemplate": {
        "body": "<p>Hello,</p>\n<p>Your one-time password is: <strong>{OTP}</strong></p>\n<p><i>If you didn't ask for the one-time password, you can ignore this email.</i></p>\n<p>\n  Thanks,<br/>\n  {APP_NAME} team\n</p>",
        "subject": "OTP for {APP_NAME}"
      },
      "enabled": false,
      "length": 8
    },
    "passwordAuth": {
      "enabled": true,
      "identityFields": [
        "email"
      ]
    },
    "passwordResetToken": {
      "duration": 1800
    },
    "resetPasswordTemplate": {
      "body": "<p>Hello,</p>\n<p>Click on the button below to reset your password.</p>\n<p>\n  <a class=\"btn\" href=\"{APP_URL}/_/#/auth/confirm-password-reset/{TOKEN}\" target=\"_blank\" rel=\"noopener\">Reset password</a>\n</p>\n<p><i>If you didn't ask to reset your password, please ignore this email.</i></p>\n<p>\n  Thanks,<br/>\n  {APP_NAME} team\n</p>",
      "subject": "Reset your {APP_NAME} password"
    },
    "system": false,
    "type": "auth",
    "updateRule": null,
    "verificationTemplate": {
      "body": "<p>Hello,</p>\n<p>Thank you for joining us at {APP_NAME}.</p>\n<p>Click on the button below to verify your email address.</p>\n<p>\n  <a class=\"btn\" href=\"{APP_URL}/_/#/auth/confirm-verification/{TOKEN}\" target=\"_blank\" rel=\"noopener\">Verify</a>\n</p>\n<p><i>If you didn't recently register, please ignore this email.</i></p>\n<p>\n  Thanks,<br/>\n  {APP_NAME} team\n</p>",
      "subject": "Verify your {APP_NAME} email"
    },
    "verificationToken": {
      "duration": 86400
    },
    "viewRule": "id = \"1\""
  });

  return migrationApp.save(collection);
})
`;

const updateExpectedJS = String.raw`
/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const migrationApp = app.forMigrations()
  const collection = migrationApp.findCollectionByNameOrId("@TEST_RANDOM")

  // update collection data
  unmarshal({
    "createRule": "id = \"nil_update\"",
    "deleteRule": null,
    "fileToken": {
      "duration": 10
    },
    "indexes": [
      "create index test1 on test123_update (f1_name)",
      "CREATE UNIQUE INDEX \`idx_tokenKey_@TEST_RANDOM\` ON \`test123_update\` (\`tokenKey\`)",
      "CREATE UNIQUE INDEX \`idx_email_@TEST_RANDOM\` ON \`test123_update\` (\`email\`) WHERE \`email\` != ''"
    ],
    "listRule": "@request.auth.id != ''",
    "name": "test123_update",
    "oauth2": {
      "enabled": true
    },
    "updateRule": "id = \"2_update\""
  }, collection)

  // remove field
  collection.fields.removeById("f3_id")

  // add field
  collection.fields.addAt(8, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "f4_id",
    "max": 0,
    "min": 0,
    "name": "f4_name",
    "pattern": "\`test backtick\`123",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // update field
  collection.fields.addAt(7, new Field({
    "help": "",
    "hidden": false,
    "id": "f2_id",
    "max": null,
    "min": 10,
    "name": "f2_name_new",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  return migrationApp.save(collection)
}, (app) => {
  const migrationApp = app.forMigrations()
  const collection = migrationApp.findCollectionByNameOrId("@TEST_RANDOM")

  // update collection data
  unmarshal({
    "createRule": null,
    "deleteRule": "id = \"3\"",
    "fileToken": {
      "duration": 180
    },
    "indexes": [
      "create index test1 on test123 (f1_name)",
      "CREATE UNIQUE INDEX \`idx_tokenKey_@TEST_RANDOM\` ON \`test123\` (\`tokenKey\`)",
      "CREATE UNIQUE INDEX \`idx_email_@TEST_RANDOM\` ON \`test123\` (\`email\`) WHERE \`email\` != ''"
    ],
    "listRule": "@request.auth.id != '' && 1 != 2",
    "name": "test123",
    "oauth2": {
      "enabled": false
    },
    "updateRule": "id = \"2\""
  }, collection)

  // add field
  collection.fields.addAt(8, new Field({
    "help": "",
    "hidden": false,
    "id": "f3_id",
    "name": "f3_name",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  // remove field
  collection.fields.removeById("f4_id")

  // update field
  collection.fields.addAt(7, new Field({
    "help": "",
    "hidden": false,
    "id": "f2_id",
    "max": null,
    "min": 10,
    "name": "f2_name",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  return migrationApp.save(collection)
})

`;

describe("migratecmd automigrate", () => {
  it("migrate help includes supported positional commands", async () => {
    const { app, cleanup } = await newTestApp();
    const root = new Command({ Use: "pocketbun" });
    try {
      MustRegister(app, root, {
        TemplateLang: TemplateLangJS,
        Automigrate: false,
      });

      const [migrateCmd, _args, findErr] = root.Find(["migrate"]);
      if (findErr) {
        throw findErr;
      }

      let out = "";
      migrateCmd.SetOut({
        write: (chunk: string) => {
          out += chunk;
        },
      });

      const err = await root.Execute(["migrate", "--help"]);
      expect(err).toBeNull();
      expect(out).toContain("Supported arguments are:");
      expect(out).toContain("- down [number] - reverts the last [number] applied migrations");
      expect(out).toContain("- history-sync  - ensures that the _migrations history table");
    } finally {
      await cleanup();
    }
  });

  it("rejects Go migration template generation", async () => {
    const { app, cleanup } = await newTestApp();

    try {
      const err = Register(app, null, {
        TemplateLang: TemplateLangGo,
        Automigrate: false,
      });

      expect(err).toBeInstanceOf(Error);
      expect(err?.message).toContain("only supports JavaScript migration templates");
      expect(err?.message).toContain(JSON.stringify(TemplateLangGo));
    } finally {
      await cleanup();
    }
  });

  it("collection create", async () => {
    const { app, cleanup } = await newTestApp();

    const migrationsDir = join(app.DataDir(), "_test_migrations");

    MustRegister(app, null, {
      Automigrate: true,
      Dir: migrationsDir,
    });

    app.bootstrap();

    const collection = NewAuthCollection("new_name");
    collection.System = true;
    collection.ListRule = Pointer("@request.auth.id != '' && 1 > 0 || 'backtick`test' = 0");
    collection.ViewRule = Pointer('id = "1"');
    collection.indexes = new JSONArray("create index test on new_name (id)");
    collection.ManageRule = Pointer("1 != 2");
    //  should be ignored
    collection.OAuth2.Providers = [
      Object.assign(new OAuth2ProviderConfig(), {
        Name: "gitlab",
        ClientId: "abc",
        ClientSecret: "123",
      }),
    ];
    const testSecret = "a".repeat(30);
    collection.AuthToken.Secret = testSecret;
    collection.FileToken.Secret = testSecret;
    collection.EmailChangeToken.Secret = testSecret;
    collection.PasswordResetToken.Secret = testSecret;
    collection.VerificationToken.Secret = testSecret;

    const requestEvent = new RequestEvent({ app, request: new Request("http://127.0.0.1") });
    const event = new CollectionRequestEvent(requestEvent, collection);
    const result = await app.OnCollectionCreateRequest().Trigger(event, async (e) => e.App.Save(e.Collection));
    if (result instanceof Error) {
      throw new Error(`Failed to save the created dummy collection, got: ${result.message}`);
    }

    const files = await readdir(migrationsDir, { withFileTypes: true });
    if (files.length !== 1) {
      throw new Error(`Expected 1 file to be generated, got ${files.length}`);
    }

    const expectedName = "_created_new_name.js";
    if (!files[0]?.name.includes(expectedName)) {
      throw new Error(`Expected filename to contains ${JSON.stringify(expectedName)}, got ${JSON.stringify(files[0]?.name)}`);
    }

    const fullPath = join(migrationsDir, files[0]?.name ?? "");
    const content = await readFile(fullPath, "utf8");
    const contentStr = normalizeGeneratedTemplate(content.trim());
    const expectedTemplate = normalizeExpectedTemplate(createExpectedJS);
    if (contentStr !== expectedTemplate) {
      throw new Error(`Expected template \n${createExpectedJS}\ngot \n${content.trim()}`);
    }

    await cleanup();
  });

  it("collection create preserves response result", async () => {
    const { app, cleanup } = await newTestApp();

    const migrationsDir = join(app.DataDir(), "_test_migrations");

    MustRegister(app, null, {
      TemplateLang: TemplateLangJS,
      Automigrate: true,
      Dir: migrationsDir,
    });
    app.bootstrap();

    const collection = NewAuthCollection("response_passthrough");

    const requestEvent = new RequestEvent({ app, request: new Request("http://127.0.0.1") });
    const event = new CollectionRequestEvent(requestEvent, collection);
    const result = await app.OnCollectionCreateRequest().Trigger(event, async (e) => {
      const saveErr = await e.App.Save(e.Collection);
      if (saveErr) {
        return saveErr;
      }
      return e.RequestEvent.json(200, { ok: true });
    });

    if (!(result instanceof Response)) {
      throw new Error(`Expected hook chain result to be Response, got ${String(result)}`);
    }
    if (result.status !== 200) {
      throw new Error(`Expected response status 200, got ${result.status}`);
    }
    const body = await result.text();
    if (!body.includes('"ok":true')) {
      throw new Error(`Expected response body to include ok=true, got ${body}`);
    }

    const files = await readdir(migrationsDir, { withFileTypes: true });
    if (files.length !== 1) {
      throw new Error(`Expected 1 file to be generated, got ${files.length}`);
    }

    await cleanup();
  });

  it("collection delete", async () => {
    const { app, cleanup } = await newTestApp();

    const migrationsDir = join(app.DataDir(), "_test_migrations");

    // create dummy collection
    const collection = NewAuthCollection("test123");
    collection.ListRule = Pointer("@request.auth.id != '' && 1 > 0 || 'backtick`test' = 0");
    collection.ViewRule = Pointer('id = "1"');
    collection.indexes = new JSONArray("create index test on test123 (id)");
    collection.ManageRule = Pointer("1 != 2");
    //  should be ignored
    collection.OAuth2.Providers = [
      Object.assign(new OAuth2ProviderConfig(), {
        Name: "gitlab",
        ClientId: "abc",
        ClientSecret: "123",
      }),
    ];
    const testSecret = "a".repeat(30);
    collection.AuthToken.Secret = testSecret;
    collection.FileToken.Secret = testSecret;
    collection.EmailChangeToken.Secret = testSecret;
    collection.PasswordResetToken.Secret = testSecret;
    collection.VerificationToken.Secret = testSecret;

    const saveErr = await app.Save(collection);
    if (saveErr) {
      throw new Error(`Failed to save dummy collection, got ${saveErr.message}`);
    }

    MustRegister(app, null, {
      TemplateLang: TemplateLangJS,
      Automigrate: true,
      Dir: migrationsDir,
    });
    app.bootstrap();

    const requestEvent = new RequestEvent({ app, request: new Request("http://127.0.0.1") });
    const event = new CollectionRequestEvent(requestEvent, collection);
    const result = await app.OnCollectionDeleteRequest().Trigger(event, async (e) => e.App.Delete(e.Collection));
    if (result instanceof Error) {
      throw new Error(`Failed to delete dummy collection, got ${result.message}`);
    }

    const files = await readdir(migrationsDir, { withFileTypes: true });
    if (files.length !== 1) {
      throw new Error(`Expected 1 file to be generated, got ${files.length}`);
    }

    const expectedName = "_deleted_test123.js";
    if (!files[0]?.name.includes(expectedName)) {
      throw new Error(`Expected filename to contains ${JSON.stringify(expectedName)}, got ${JSON.stringify(files[0]?.name)}`);
    }

    const fullPath = join(migrationsDir, files[0]?.name ?? "");
    const content = await readFile(fullPath, "utf8");
    const contentStr = normalizeGeneratedTemplate(content.trim());
    const expectedTemplate = normalizeExpectedTemplate(deleteExpectedJS);
    if (contentStr !== expectedTemplate) {
      throw new Error(`Expected template \n${deleteExpectedJS}\ngot \n${content.trim()}`);
    }

    await cleanup();
  });

  it("collection update", async () => {
    const { app, cleanup } = await newTestApp();

    const migrationsDir = join(app.DataDir(), "_test_migrations");

    // create dummy collection
    const collection = NewAuthCollection("test123");
    collection.ListRule = Pointer("@request.auth.id != '' && 1 != 2");
    collection.ViewRule = Pointer('id = "1"');
    collection.UpdateRule = Pointer('id = "2"');
    collection.CreateRule = null;
    collection.DeleteRule = Pointer('id = "3"');
    collection.indexes = new JSONArray("create index test1 on test123 (f1_name)");
    collection.ManageRule = Pointer("1 != 2");
    const f1 = new TextField();
    f1.Id = "f1_id";
    f1.Name = "f1_name";
    f1.Required = true;
    collection.Fields.Add(f1);

    const f2 = new NumberField();
    f2.Id = "f2_id";
    f2.Name = "f2_name";
    f2.Min = Pointer(10);
    collection.Fields.Add(f2);

    const f3 = new BoolField();
    f3.Id = "f3_id";
    f3.Name = "f3_name";
    collection.Fields.Add(f3);

    const saveErr = await app.Save(collection);
    if (saveErr) {
      throw new Error(`Failed to save dummy collection, got ${saveErr.message}`);
    }

    MustRegister(app, null, {
      TemplateLang: TemplateLangJS,
      Automigrate: true,
      Dir: migrationsDir,
    });
    app.bootstrap();

    // update the dummy collection
    collection.Name = "test123_update";
    collection.ListRule = Pointer("@request.auth.id != ''");
    collection.ViewRule = Pointer('id = "1"');
    collection.UpdateRule = Pointer('id = "2_update"');
    collection.CreateRule = Pointer('id = "nil_update"');
    collection.DeleteRule = null;
    collection.indexes = new JSONArray("create index test1 on test123_update (f1_name)");
    collection.Fields.RemoveById("f3_id");
    const f4 = new TextField();
    f4.Id = "f4_id";
    f4.Name = "f4_name";
    f4.Pattern = "`test backtick`123";
    collection.Fields.Add(f4);
    const f2Field = collection.Fields.GetById("f2_id");
    f2Field?.SetName("f2_name_new");
    collection.OAuth2.Enabled = true;
    collection.FileToken.Duration = 10;
    //  should be ignored
    collection.OAuth2.Providers = [
      Object.assign(new OAuth2ProviderConfig(), {
        Name: "gitlab",
        ClientId: "abc",
        ClientSecret: "123",
      }),
    ];
    const testSecret = "b".repeat(30);
    collection.AuthToken.Secret = testSecret;
    collection.FileToken.Secret = testSecret;
    collection.EmailChangeToken.Secret = testSecret;
    collection.PasswordResetToken.Secret = testSecret;
    collection.VerificationToken.Secret = testSecret;

    const requestEvent = new RequestEvent({ app, request: new Request("http://127.0.0.1") });
    const event = new CollectionRequestEvent(requestEvent, collection);
    const result = await app.OnCollectionUpdateRequest().Trigger(event, async (e) => e.App.Save(e.Collection));
    if (result instanceof Error) {
      throw new Error(`Failed to save dummy collection changes, got ${result.message}`);
    }

    const files = await readdir(migrationsDir, { withFileTypes: true });
    if (files.length !== 1) {
      throw new Error(`Expected 1 file to be generated, got ${files.length}`);
    }

    const expectedName = "_updated_test123.js";
    if (!files[0]?.name.includes(expectedName)) {
      throw new Error(`Expected filename to contains ${JSON.stringify(expectedName)}, got ${JSON.stringify(files[0]?.name)}`);
    }

    const fullPath = join(migrationsDir, files[0]?.name ?? "");
    const content = await readFile(fullPath, "utf8");
    const contentStr = normalizeGeneratedTemplate(content.trim());
    const expectedTemplate = normalizeExpectedTemplate(updateExpectedJS);
    if (contentStr !== expectedTemplate) {
      throw new Error(`Expected template \n${updateExpectedJS}\ngot \n${content.trim()}`);
    }

    await cleanup();
  });

  it("collection no changes", async () => {
    const { app, cleanup } = await newTestApp();

    const migrationsDir = join(app.DataDir(), "_test_migrations");

    const collection = NewAuthCollection("test123");
    const saveErr = await app.Save(collection);
    if (saveErr) {
      throw new Error(`Failed to save dummy collection, got ${saveErr.message}`);
    }

    MustRegister(app, null, {
      TemplateLang: TemplateLangJS,
      Automigrate: true,
      Dir: migrationsDir,
    });
    app.bootstrap();

    //  should be ignored
    collection.OAuth2.Providers = [
      Object.assign(new OAuth2ProviderConfig(), {
        Name: "gitlab",
        ClientId: "abc",
        ClientSecret: "123",
      }),
    ];
    const testSecret = "b".repeat(30);
    collection.AuthToken.Secret = testSecret;
    collection.FileToken.Secret = testSecret;
    collection.EmailChangeToken.Secret = testSecret;
    collection.PasswordResetToken.Secret = testSecret;
    collection.VerificationToken.Secret = testSecret;

    const requestEvent = new RequestEvent({ app, request: new Request("http://127.0.0.1") });
    const event = new CollectionRequestEvent(requestEvent, collection);
    const result = await app.OnCollectionUpdateRequest().Trigger(event, async (e) => e.App.Save(e.Collection));
    if (result instanceof Error) {
      throw new Error(`Failed to save dummy collection update, got ${result.message}`);
    }

    let files: Dirent[] = [];
    try {
      files = await readdir(migrationsDir, { withFileTypes: true });
    } catch (err) {
      const error = err as NodeJS.ErrnoException;
      if (error.code !== "ENOENT") {
        throw err;
      }
    }
    if (files.length !== 0) {
      throw new Error(`Expected 0 files to be generated, got ${files.length}`);
    }

    await cleanup();
  });

  it.serial("generated JS collection migrations replay collection and nested auth template changes", async () => {
    const { app, cleanup } = await newTestApp(undefined, { bindEventCounters: false });
    const migrationsDir = join(app.DataDir(), "_test_migrations");
    const hooksDir = join(app.DataDir(), "_test_hooks");

    try {
      MustRegister(app, null, {
        TemplateLang: TemplateLangJS,
        Automigrate: true,
        Dir: migrationsDir,
      });
      app.bootstrap();

      const authCollection = NewAuthCollection("migration_auth_replay");
      const displayName = new TextField();
      displayName.Name = "displayName";
      displayName.Required = true;
      authCollection.Fields.Add(displayName);

      const subscribed = new BoolField();
      subscribed.Name = "subscribed";
      authCollection.Fields.Add(subscribed);

      const requestEvent = new RequestEvent({ app, request: new Request("http://127.0.0.1") });
      let event = new CollectionRequestEvent(requestEvent, authCollection);
      let result = await app.OnCollectionCreateRequest().Trigger(event, async (e) => e.App.Save(e.Collection));
      if (result instanceof Error) {
        throw new Error(`Failed to create migration replay collection, got ${result.message}`);
      }

      const updated = app.FindCollectionByNameOrId("migration_auth_replay");
      const score = new NumberField();
      score.Name = "score";
      score.Min = Pointer(1);
      score.Max = Pointer(5);
      updated.Fields.Add(score);
      updated.UpdateRule = Pointer("@request.auth.id != ''");

      event = new CollectionRequestEvent(requestEvent, updated);
      result = await app.OnCollectionUpdateRequest().Trigger(event, async (e) => e.App.Save(e.Collection));
      if (result instanceof Error) {
        throw new Error(`Failed to update migration replay collection, got ${result.message}`);
      }

      const users = app.FindCollectionByNameOrId("users");
      const originalAuthAlertSubject = users.AuthAlert.EmailTemplate.Subject;
      users.AuthAlert.EmailTemplate.Body = "<p>Generated auth alert body-only migration.</p>";

      event = new CollectionRequestEvent(requestEvent, users);
      result = await app.OnCollectionUpdateRequest().Trigger(event, async (e) => e.App.Save(e.Collection));
      if (result instanceof Error) {
        throw new Error(`Failed to update users auth template, got ${result.message}`);
      }

      const files = await readdir(migrationsDir, { withFileTypes: true });
      if (files.length !== 3) {
        throw new Error(`Expected 3 generated migrations, got ${files.length}`);
      }

      const generatedUsersMigration = files.find((file) => file.name.includes("_updated_users.js"));
      if (!generatedUsersMigration) {
        throw new Error("Expected users auth template migration to be generated");
      }
      const generatedUsersContent = await readFile(join(migrationsDir, generatedUsersMigration.name), "utf8");
      if (!generatedUsersContent.includes('"authAlert"') || !generatedUsersContent.includes('"body"')) {
        throw new Error(`Expected users migration to include authAlert body diff, got:\n${generatedUsersContent}`);
      }
      if (generatedUsersContent.includes('"subject"')) {
        throw new Error(`Expected generated authAlert diff to omit unchanged subject, got:\n${generatedUsersContent}`);
      }

      const { app: replayApp, cleanup: replayCleanup } = await newTestApp(undefined, { bindEventCounters: false });
      try {
        const replayMigrations = new MigrationsList();
        const registerErr = RegisterJSVM(replayApp, {
          HooksDir: hooksDir,
          MigrationsDir: migrationsDir,
          TypesDir: app.DataDir(),
          OnInit: (globals) => {
            globals.migrate = (up: (txApp: typeof replayApp) => void, down?: (txApp: typeof replayApp) => void): void => {
              const toScriptApp = (txApp: typeof replayApp): typeof replayApp => {
                const scope: Record<string, unknown> = {};
                appBinds(scope, txApp);
                return scope.$app as typeof replayApp;
              };
              const fileName = typeof globals.__filename === "string" ? basename(globals.__filename) : "";
              replayMigrations.register(
                (txApp) => up(toScriptApp(txApp as typeof replayApp)),
                down ? (txApp) => down(toScriptApp(txApp as typeof replayApp)) : undefined,
                fileName,
              );
            };
          },
        });
        if (registerErr) {
          throw registerErr;
        }

        new MigrationsRunner(replayApp, replayMigrations).Up();

        const replayedAuthCollection = replayApp.FindCollectionByNameOrId("migration_auth_replay");
        if (!replayedAuthCollection.Fields.GetByName("score")) {
          throw new Error("Expected generated collection update migration to replay the score field");
        }
        if (replayedAuthCollection.UpdateRule !== "@request.auth.id != ''") {
          throw new Error(`Expected generated collection updateRule to replay, got ${replayedAuthCollection.UpdateRule}`);
        }

        const replayedUsers = replayApp.FindCollectionByNameOrId("users");
        if (replayedUsers.AuthAlert.EmailTemplate.Subject !== originalAuthAlertSubject) {
          throw new Error("Expected authAlert email subject to be preserved while replaying body-only migration");
        }
        if (replayedUsers.AuthAlert.EmailTemplate.Body !== "<p>Generated auth alert body-only migration.</p>") {
          throw new Error("Expected authAlert email body to be updated while replaying generated migration");
        }
      } finally {
        await replayCleanup();
      }
    } finally {
      await cleanup();
    }
  });
});

function normalizeExpectedTemplate(template: string): string {
  const normalized = template
    .trim()
    .replaceAll("\\`", "`")
    .replaceAll(/\\\\+"/g, '\\"');
  return normalizeTemplateText(normalized);
}

function normalizeGeneratedTemplate(value: string): string {
  return normalizeTemplateText(value.trim());
}

function normalizeTemplateText(value: string): string {
  return value
    .replaceAll(/pbc_\d+/g, "@TEST_RANDOM")
    .replaceAll(/text\d+/g, "text@TEST_RANDOM")
    .replaceAll(/password\d+/g, "password@TEST_RANDOM")
    .replaceAll(/email\d+/g, "email@TEST_RANDOM")
    .replaceAll(/bool\d+/g, "bool@TEST_RANDOM");
}
