// Ported from pocketbase/migrations/1717233556_v0.23_migrate.go @ v0.36.1 (9b036fb1)

import type { Database } from "bun:sqlite";
import type { App } from "../core/app.ts";
import { SystemMigrations } from "../core/migrations_runner.ts";
import { randomString } from "../tools/security/random.ts";
import { decrypt } from "../tools/security/encrypt.ts";
import { rmSync } from "node:fs";
import { join } from "node:path";

const FILE_NAME = "1717233556_v0.23_migrate.go";

SystemMigrations.register(up, undefined, FILE_NAME);

function up(app: App): void {
  const db = app.db();
  const hasUpgraded = hasTable(db, "_mfas") && hasTable(db, "_authOrigins");
  if (hasUpgraded) {
    return;
  }

  const oldSettings = loadOldSettings(app);

  migrateOldCollections(app, oldSettings);
  migrateSuperusers(app, oldSettings);
  migrateSettings(app, oldSettings);
  migrateExternalAuths(app);
  createMFAsCollection(app);
  createOTPsCollection(app);
  createAuthOriginsCollection(app);

  const logsPath = join(app.dataDir(), "logs.db");
  try {
    rmSync(logsPath);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") {
      console.warn("Failed to delete old logs.db file", err);
    }
  }
}

// -------------------------------------------------------------------

function migrateSuperusers(app: App, oldSettings: Record<string, unknown>): void {
  createSuperusersCollection(app);

  const db = app.db();
  const row = db
    .query("select id, options from _collections where name = ?")
    .get("_superusers") as { id: string; options: string } | undefined;
  if (!row) {
    throw new Error("missing _superusers collection");
  }

  const options = parseJson<Record<string, unknown>>(row.options, {});
  const authToken = (options.authToken as Record<string, unknown> | undefined) ?? {};
  authToken.secret = zeroFallback(
    toString(getMapVal(oldSettings, "adminAuthToken", "secret")),
    toString(authToken.secret),
  );
  authToken.duration = zeroFallback(
    toInt64(getMapVal(oldSettings, "adminAuthToken", "duration")),
    toInt64(authToken.duration),
  );
  options.authToken = authToken;

  const passwordResetToken = (options.passwordResetToken as Record<string, unknown> | undefined) ?? {};
  passwordResetToken.secret = zeroFallback(
    toString(getMapVal(oldSettings, "adminPasswordResetToken", "secret")),
    toString(passwordResetToken.secret),
  );
  passwordResetToken.duration = zeroFallback(
    toInt64(getMapVal(oldSettings, "adminPasswordResetToken", "duration")),
    toInt64(passwordResetToken.duration),
  );
  options.passwordResetToken = passwordResetToken;

  const fileToken = (options.fileToken as Record<string, unknown> | undefined) ?? {};
  fileToken.secret = zeroFallback(
    toString(getMapVal(oldSettings, "adminFileToken", "secret")),
    toString(fileToken.secret),
  );
  fileToken.duration = zeroFallback(
    toInt64(getMapVal(oldSettings, "adminFileToken", "duration")),
    toInt64(fileToken.duration),
  );
  options.fileToken = fileToken;

  db.query("update _collections set options = ? where id = ?").run(JSON.stringify(options), row.id);

  db.exec(`
    INSERT INTO _superusers (id, verified, email, password, tokenKey, created, updated)
    SELECT id, 1, email, passwordHash, tokenKey, created, updated FROM _admins;
  `);

  db.exec("DROP TABLE _admins;");
}

// -------------------------------------------------------------------

function loadOldSettings(app: App): Record<string, unknown> {
  const row = app
    .db()
    .query("select id, key, value from _params where key = ?")
    .get("settings") as { value?: unknown } | undefined;
  if (!row) {
    throw new Error("missing settings param");
  }

  const rawValue = typeof row.value === "string" ? row.value : String(row.value ?? "");

  try {
    return JSON.parse(rawValue) as Record<string, unknown>;
  } catch (plainDecodeErr) {
    const envName = app.encryptionEnv();
    const encryptionKey = envName ? process.env[envName] ?? "" : "";
    if (!encryptionKey) {
      throw new Error(`invalid settings db data or missing encryption key "${envName}"`);
    }

    const decrypted = decrypt(rawValue, encryptionKey);
    return JSON.parse(Buffer.from(decrypted).toString("utf8")) as Record<string, unknown>;
  }
}

function migrateSettings(app: App, oldSettings: Record<string, unknown>): void {
  const db = app.db();

  db.exec("ALTER TABLE _params RENAME TO _params_old;");
  createParamsTable(db);

  const newSettings: Record<string, unknown> = {
    meta: {
      appName: toString(getMapVal(oldSettings, "meta", "appName")),
      appUrl: trimSuffix(toString(getMapVal(oldSettings, "meta", "appUrl")), "/"),
      hideControls: toBool(getMapVal(oldSettings, "meta", "hideControls")),
      senderName: toString(getMapVal(oldSettings, "meta", "senderName")),
      senderAddress: toString(getMapVal(oldSettings, "meta", "senderAddress")),
    },
    logs: {
      maxDays: toInt(getMapVal(oldSettings, "logs", "maxDays")),
      minLevel: toInt(getMapVal(oldSettings, "logs", "minLevel")),
      logIp: toBool(getMapVal(oldSettings, "logs", "logIp")),
    },
    smtp: {
      enabled: toBool(getMapVal(oldSettings, "smtp", "enabled")),
      port: toInt(getMapVal(oldSettings, "smtp", "port")),
      host: toString(getMapVal(oldSettings, "smtp", "host")),
      username: toString(getMapVal(oldSettings, "smtp", "username")),
      password: toString(getMapVal(oldSettings, "smtp", "password")),
      authMethod: toString(getMapVal(oldSettings, "smtp", "authMethod")),
      tls: toBool(getMapVal(oldSettings, "smtp", "tls")),
      localName: toString(getMapVal(oldSettings, "smtp", "localName")),
    },
    backups: {
      cron: toString(getMapVal(oldSettings, "backups", "cron")),
      cronMaxKeep: toInt(getMapVal(oldSettings, "backups", "cronMaxKeep")),
      s3: {
        enabled: toBool(getMapVal(oldSettings, "backups", "s3", "enabled")),
        bucket: toString(getMapVal(oldSettings, "backups", "s3", "bucket")),
        region: toString(getMapVal(oldSettings, "backups", "s3", "region")),
        endpoint: toString(getMapVal(oldSettings, "backups", "s3", "endpoint")),
        accessKey: toString(getMapVal(oldSettings, "backups", "s3", "accessKey")),
        secret: toString(getMapVal(oldSettings, "backups", "s3", "secret")),
        forcePathStyle: toBool(getMapVal(oldSettings, "backups", "s3", "forcePathStyle")),
      },
    },
    s3: {
      enabled: toBool(getMapVal(oldSettings, "s3", "enabled")),
      bucket: toString(getMapVal(oldSettings, "s3", "bucket")),
      region: toString(getMapVal(oldSettings, "s3", "region")),
      endpoint: toString(getMapVal(oldSettings, "s3", "endpoint")),
      accessKey: toString(getMapVal(oldSettings, "s3", "accessKey")),
      secret: toString(getMapVal(oldSettings, "s3", "secret")),
      forcePathStyle: toBool(getMapVal(oldSettings, "s3", "forcePathStyle")),
    },
  };

  db.query("insert into _params (id, value) values (?, ?)").run("settings", JSON.stringify(newSettings));
  db.exec("DROP TABLE _params_old;");
}

// -------------------------------------------------------------------

function migrateExternalAuths(app: App): void {
  const db = app.db();
  db.exec("ALTER TABLE _externalAuths RENAME TO _externalAuths_old;");

  createExternalAuthsCollection(app);

  db.exec(`
    INSERT INTO _externalAuths (id, collectionRef, recordRef, provider, providerId, created, updated)
    SELECT id, collectionId, recordId, provider, providerId, created, updated FROM _externalAuths_old;
  `);

  db.exec("DROP TABLE _externalAuths_old;");
}

// -------------------------------------------------------------------

type OldCollectionRow = {
  id: string;
  name: string;
  type: string;
  system: number | boolean;
  schema?: string;
  fields?: string;
  indexes?: string;
  listRule?: string | null;
  viewRule?: string | null;
  createRule?: string | null;
  updateRule?: string | null;
  deleteRule?: string | null;
  options?: string;
};

function migrateOldCollections(app: App, oldSettings: Record<string, unknown>): void {
  const db = app.db();
  const schemaColumn = hasColumn(db, "_collections", "schema") ? "schema" : "fields";
  const rows = db
    .query(
      `select id, name, type, system, ${schemaColumn} as schema, indexes, listRule, viewRule, createRule, updateRule, deleteRule, options from _collections`,
    )
    .all() as OldCollectionRow[];

  for (const row of rows) {
    const oldSchema = parseJson<Record<string, unknown>[]>(row.schema, []);
    const oldIndexes = parseJson<string[]>(row.indexes, []);
    const oldOptions = parseJson<Record<string, unknown>>(row.options, {});

    const schema = oldSchema.map((field) => migrateField(field));
    const indexes = [...oldIndexes];
    const options: Record<string, unknown> = {};

    let listRule = migrateRule(row.listRule);
    let viewRule = migrateRule(row.viewRule);
    let createRule = migrateRule(row.createRule);
    let updateRule = migrateRule(row.updateRule);
    let deleteRule = migrateRule(row.deleteRule);

    if (row.type === "auth") {
      const dummyAuthOptions = defaultAuthOptions({ authTokenDuration: 604800 });

      options.authToken = {
        secret: zeroFallback(
          toString(getMapVal(oldSettings, "recordAuthToken", "secret")),
          dummyAuthOptions.authToken.secret,
        ),
        duration: zeroFallback(
          toInt64(getMapVal(oldSettings, "recordAuthToken", "duration")),
          dummyAuthOptions.authToken.duration,
        ),
      };
      options.passwordResetToken = {
        secret: zeroFallback(
          toString(getMapVal(oldSettings, "recordPasswordResetToken", "secret")),
          dummyAuthOptions.passwordResetToken.secret,
        ),
        duration: zeroFallback(
          toInt64(getMapVal(oldSettings, "recordPasswordResetToken", "duration")),
          dummyAuthOptions.passwordResetToken.duration,
        ),
      };
      options.emailChangeToken = {
        secret: zeroFallback(
          toString(getMapVal(oldSettings, "recordEmailChangeToken", "secret")),
          dummyAuthOptions.emailChangeToken.secret,
        ),
        duration: zeroFallback(
          toInt64(getMapVal(oldSettings, "recordEmailChangeToken", "duration")),
          dummyAuthOptions.emailChangeToken.duration,
        ),
      };
      options.verificationToken = {
        secret: zeroFallback(
          toString(getMapVal(oldSettings, "recordVerificationToken", "secret")),
          dummyAuthOptions.verificationToken.secret,
        ),
        duration: zeroFallback(
          toInt64(getMapVal(oldSettings, "recordVerificationToken", "duration")),
          dummyAuthOptions.verificationToken.duration,
        ),
      };
      options.fileToken = {
        secret: zeroFallback(
          toString(getMapVal(oldSettings, "recordFileToken", "secret")),
          dummyAuthOptions.fileToken.secret,
        ),
        duration: zeroFallback(
          toInt64(getMapVal(oldSettings, "recordFileToken", "duration")),
          dummyAuthOptions.fileToken.duration,
        ),
      };

      const onlyVerified = toBool(oldOptions.onlyVerified);
      options.authRule = onlyVerified ? "verified=true" : "";

      options.manageRule = null;
      if (oldOptions.manageRule != null) {
        const manageRule = toString(oldOptions.manageRule);
        if (manageRule) {
          options.manageRule = migrateRule(manageRule);
        }
      }

      const identityFields: string[] = [];
      if (toBool(oldOptions.allowEmailAuth)) {
        identityFields.push("email");
      }
      if (toBool(oldOptions.allowUsernameAuth)) {
        identityFields.push("username");
      }
      options.passwordAuth = {
        enabled: identityFields.length > 0,
        identityFields,
      };

      const providerNames = [
        "googleAuth",
        "facebookAuth",
        "githubAuth",
        "gitlabAuth",
        "discordAuth",
        "twitterAuth",
        "microsoftAuth",
        "spotifyAuth",
        "kakaoAuth",
        "twitchAuth",
        "stravaAuth",
        "giteeAuth",
        "livechatAuth",
        "giteaAuth",
        "oidcAuth",
        "oidc2Auth",
        "oidc3Auth",
        "appleAuth",
        "instagramAuth",
        "vkAuth",
        "yandexAuth",
        "patreonAuth",
        "mailcowAuth",
        "bitbucketAuth",
        "planningcenterAuth",
      ];

      const oauth2Providers: Array<Record<string, unknown>> = [];
      for (const name of providerNames) {
        if (!toBool(getMapVal(oldSettings, name, "enabled"))) {
          continue;
        }
        oauth2Providers.push({
          name: name.replace(/Auth$/, ""),
          clientId: toString(getMapVal(oldSettings, name, "clientId")),
          clientSecret: toString(getMapVal(oldSettings, name, "clientSecret")),
          authURL: toString(getMapVal(oldSettings, name, "authUrl")),
          tokenURL: toString(getMapVal(oldSettings, name, "tokenUrl")),
          userInfoURL: toString(getMapVal(oldSettings, name, "userApiUrl")),
          displayName: toString(getMapVal(oldSettings, name, "displayName")),
          pkce: getMapVal(oldSettings, name, "pkce"),
        });
      }

      options.oauth2 = {
        enabled: toBool(oldOptions.allowOAuth2Auth) && oauth2Providers.length > 0,
        providers: oauth2Providers,
        mappedFields: {
          username: "username",
        },
      };

      const templateDefaults = {
        verificationTemplate: dummyAuthOptions.verificationTemplate,
        resetPasswordTemplate: dummyAuthOptions.resetPasswordTemplate,
        confirmEmailChangeTemplate: dummyAuthOptions.confirmEmailChangeTemplate,
      };

      for (const [name, fallback] of Object.entries(templateDefaults)) {
        const actionUrl = toString(getMapVal(oldSettings, "meta", name, "actionUrl"));
        const subject = zeroFallback(
          toString(getMapVal(oldSettings, "meta", name, "subject")),
          fallback.subject,
        );
        const body = zeroFallback(
          replaceAll(toString(getMapVal(oldSettings, "meta", name, "body")), "{ACTION_URL}", actionUrl),
          fallback.body,
        );
        options[name] = { subject, body };
      }

      options.mfa = {
        enabled: dummyAuthOptions.mfa.enabled,
        duration: dummyAuthOptions.mfa.duration,
        rule: dummyAuthOptions.mfa.rule,
      };

      options.otp = {
        enabled: dummyAuthOptions.otp.enabled,
        duration: dummyAuthOptions.otp.duration,
        length: dummyAuthOptions.otp.length,
        emailTemplate: {
          subject: dummyAuthOptions.otp.emailTemplate.subject,
          body: dummyAuthOptions.otp.emailTemplate.body,
        },
      };

      options.authAlert = {
        enabled: dummyAuthOptions.authAlert.enabled,
        emailTemplate: {
          subject: dummyAuthOptions.authAlert.emailTemplate.subject,
          body: dummyAuthOptions.authAlert.emailTemplate.body,
        },
      };

      indexes.unshift(
        `CREATE UNIQUE INDEX \`_${row.id}_username_idx\` ON \`${row.name}\` (username COLLATE NOCASE)`,
        `CREATE UNIQUE INDEX \`_${row.id}_email_idx\` ON \`${row.name}\` (\`email\`) WHERE \`email\` != ''`,
        `CREATE UNIQUE INDEX \`_${row.id}_tokenKey_idx\` ON \`${row.name}\` (\`tokenKey\`)`,
      );

      schema.unshift(
        {
          id: fieldIdChecksum("password", "password"),
          type: "password",
          name: "password",
          presentable: false,
          system: true,
          hidden: true,
          required: true,
          pattern: "",
          min: toInt(oldOptions.minPasswordLength),
          cost: 10,
        },
        {
          id: fieldIdChecksum("text", "tokenKey"),
          type: "text",
          name: "tokenKey",
          system: true,
          hidden: true,
          required: true,
          presentable: false,
          primaryKey: false,
          min: 30,
          max: 60,
          pattern: "",
          autogeneratePattern: "[a-zA-Z0-9_]{50}",
        },
        {
          id: fieldIdChecksum("email", "email"),
          type: "email",
          name: "email",
          system: true,
          hidden: false,
          presentable: false,
          required: toBool(oldOptions.requireEmail),
          exceptDomains: toStringSlice(oldOptions.exceptEmailDomains),
          onlyDomains: toStringSlice(oldOptions.onlyEmailDomains),
        },
        {
          id: fieldIdChecksum("bool", "emailVisibility"),
          type: "bool",
          name: "emailVisibility",
          system: true,
          hidden: false,
          presentable: false,
          required: false,
        },
        {
          id: fieldIdChecksum("bool", "verified"),
          type: "bool",
          name: "verified",
          system: true,
          hidden: false,
          presentable: false,
          required: false,
        },
        {
          id: fieldIdChecksum("text", "username"),
          type: "text",
          name: "username",
          system: false,
          hidden: false,
          required: true,
          presentable: false,
          primaryKey: false,
          min: 3,
          max: 150,
          pattern: "^[\\w][\\w\\.\\-]*$",
          autogeneratePattern: "users[0-9]{6}",
        },
      );

      renameColumn(db, row.name, "passwordHash", "password");

      for (const col of ["lastResetSentAt", "lastVerificationSentAt", "lastLoginAlertSentAt"]) {
        dropColumn(db, row.name, col);
      }
    } else if (row.type === "view") {
      options.viewQuery = toString(oldOptions.query);
    }

    schema.unshift({
      id: fieldIdChecksum("text", "id"),
      type: "text",
      name: "id",
      system: true,
      required: true,
      presentable: false,
      hidden: false,
      primaryKey: true,
      min: 15,
      max: 15,
      pattern: "^[a-z0-9]+$",
      autogeneratePattern: "[a-z0-9]{15}",
    });

    let addCreated = true;
    let addUpdated = true;
    if (row.type === "view") {
      addCreated = false;
      addUpdated = false;
      for (const column of tableColumns(db, row.name)) {
        if (column.toLowerCase() === "created") {
          addCreated = true;
        } else if (column.toLowerCase() === "updated") {
          addUpdated = true;
        }
      }
    }

    if (addCreated) {
      schema.push({
        id: fieldIdChecksum("autodate", "created"),
        type: "autodate",
        name: "created",
        system: false,
        presentable: false,
        hidden: false,
        onCreate: true,
        onUpdate: false,
      });
    }

    if (addUpdated) {
      schema.push({
        id: fieldIdChecksum("autodate", "updated"),
        type: "autodate",
        name: "updated",
        system: false,
        presentable: false,
        hidden: false,
        onCreate: true,
        onUpdate: true,
      });
    }

    db.query(
      `update _collections set ${schemaColumn} = ?, indexes = ?, listRule = ?, viewRule = ?, createRule = ?, updateRule = ?, deleteRule = ?, options = ? where id = ?`,
    ).run(
      JSON.stringify(schema),
      JSON.stringify(indexes),
      listRule ?? null,
      viewRule ?? null,
      createRule ?? null,
      updateRule ?? null,
      deleteRule ?? null,
      JSON.stringify(options),
      row.id,
    );
  }

  if (schemaColumn === "schema") {
    db.exec("ALTER TABLE _collections RENAME COLUMN schema TO fields;");
  }
}

// -------------------------------------------------------------------

function createParamsTable(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _params (
      id TEXT PRIMARY KEY DEFAULT ('r'||lower(hex(randomblob(7)))) NOT NULL,
      value JSON DEFAULT NULL,
      created TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%fZ')) NOT NULL,
      updated TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%fZ')) NOT NULL
    );
  `);
}

// -------------------------------------------------------------------

type CollectionInsert = {
  id: string;
  system: boolean;
  type: string;
  name: string;
  fields: Record<string, unknown>[];
  indexes: string[];
  listRule: string | null;
  viewRule: string | null;
  createRule: string | null;
  updateRule: string | null;
  deleteRule: string | null;
  options: Record<string, unknown>;
};

function insertCollection(db: Database, collection: CollectionInsert): void {
  db.query(
    `INSERT OR IGNORE INTO _collections
      (id, system, type, name, fields, indexes, listRule, viewRule, createRule, updateRule, deleteRule, options)
     VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    collection.id,
    collection.system ? 1 : 0,
    collection.type,
    collection.name,
    JSON.stringify(collection.fields),
    JSON.stringify(collection.indexes),
    collection.listRule ?? null,
    collection.viewRule ?? null,
    collection.createRule ?? null,
    collection.updateRule ?? null,
    collection.deleteRule ?? null,
    JSON.stringify(collection.options),
  );
}

function createSuperusersCollection(app: App): void {
  const db = app.db();
  const collection = buildSuperusersCollection();
  insertCollection(db, collection);
  db.exec(`
    CREATE TABLE IF NOT EXISTS _superusers (
      created TEXT DEFAULT '' NOT NULL,
      email TEXT DEFAULT '' NOT NULL,
      emailVisibility BOOLEAN DEFAULT FALSE NOT NULL,
      id TEXT PRIMARY KEY DEFAULT ('r'||lower(hex(randomblob(7)))) NOT NULL,
      password TEXT DEFAULT '' NOT NULL,
      tokenKey TEXT DEFAULT '' NOT NULL,
      updated TEXT DEFAULT '' NOT NULL,
      verified BOOLEAN DEFAULT FALSE NOT NULL
    );
  `);
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_tokenKey__pbc_3142635823 ON _superusers (tokenKey);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_email__pbc_3142635823 ON _superusers (email) WHERE email != '';
  `);
}

function createMFAsCollection(app: App): void {
  const db = app.db();
  const collection = buildMFAsCollection();
  insertCollection(db, collection);
  db.exec(`
    CREATE TABLE IF NOT EXISTS _mfas (
      collectionRef TEXT DEFAULT '' NOT NULL,
      created TEXT DEFAULT '' NOT NULL,
      id TEXT PRIMARY KEY DEFAULT ('r'||lower(hex(randomblob(7)))) NOT NULL,
      method TEXT DEFAULT '' NOT NULL,
      recordRef TEXT DEFAULT '' NOT NULL,
      updated TEXT DEFAULT '' NOT NULL
    );
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_mfas_collectionRef_recordRef ON _mfas (collectionRef, recordRef);
  `);
}

function createOTPsCollection(app: App): void {
  const db = app.db();
  const collection = buildOTPsCollection();
  insertCollection(db, collection);
  db.exec(`
    CREATE TABLE IF NOT EXISTS _otps (
      collectionRef TEXT DEFAULT '' NOT NULL,
      created TEXT DEFAULT '' NOT NULL,
      id TEXT PRIMARY KEY DEFAULT ('r'||lower(hex(randomblob(7)))) NOT NULL,
      password TEXT DEFAULT '' NOT NULL,
      recordRef TEXT DEFAULT '' NOT NULL,
      updated TEXT DEFAULT '' NOT NULL,
      sentTo TEXT DEFAULT '' NOT NULL
    );
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_otps_collectionRef_recordRef ON _otps (collectionRef, recordRef);
  `);
}

function createExternalAuthsCollection(app: App): void {
  const db = app.db();
  const collection = buildExternalAuthsCollection();
  insertCollection(db, collection);
  db.exec(`
    CREATE TABLE IF NOT EXISTS _externalAuths (
      collectionRef TEXT DEFAULT '' NOT NULL,
      created TEXT DEFAULT '' NOT NULL,
      id TEXT PRIMARY KEY DEFAULT ('r'||lower(hex(randomblob(7)))) NOT NULL,
      provider TEXT DEFAULT '' NOT NULL,
      providerId TEXT DEFAULT '' NOT NULL,
      recordRef TEXT DEFAULT '' NOT NULL,
      updated TEXT DEFAULT '' NOT NULL
    );
  `);
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_externalAuths_record_provider ON _externalAuths (collectionRef, recordRef, provider);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_externalAuths_collection_provider ON _externalAuths (collectionRef, provider, providerId);
  `);
}

function createAuthOriginsCollection(app: App): void {
  const db = app.db();
  const collection = buildAuthOriginsCollection();
  insertCollection(db, collection);
  db.exec(`
    CREATE TABLE IF NOT EXISTS _authOrigins (
      collectionRef TEXT DEFAULT '' NOT NULL,
      created TEXT DEFAULT '' NOT NULL,
      fingerprint TEXT DEFAULT '' NOT NULL,
      id TEXT PRIMARY KEY DEFAULT ('r'||lower(hex(randomblob(7)))) NOT NULL,
      recordRef TEXT DEFAULT '' NOT NULL,
      updated TEXT DEFAULT '' NOT NULL
    );
  `);
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_authOrigins_unique_pairs ON _authOrigins (collectionRef, recordRef, fingerprint);
  `);
}

function buildMFAsCollection(): CollectionInsert {
  const ownerRule =
    "@request.auth.id != '' && recordRef = @request.auth.id && collectionRef = @request.auth.collectionId";

  const mfas = baseSystemCollection("_mfas", "base", true, [
    textField("id", {
      system: true,
      required: true,
      primaryKey: true,
      min: 15,
      max: 15,
      pattern: "^[a-z0-9]+$",
      autogeneratePattern: "[a-z0-9]{15}",
    }),
    textField("collectionRef", { system: true, required: true }),
    textField("recordRef", { system: true, required: true }),
    textField("method", { system: true, required: true }),
    autodateField("created", { system: true, onCreate: true, onUpdate: false }),
    autodateField("updated", { system: true, onCreate: true, onUpdate: true }),
  ], [buildIndex("idx_mfas_collectionRef_recordRef", false, "_mfas", "collectionRef, recordRef")]);
  mfas.listRule = ownerRule;
  mfas.viewRule = ownerRule;

  return mfas;
}

function buildOTPsCollection(): CollectionInsert {
  const ownerRule =
    "@request.auth.id != '' && recordRef = @request.auth.id && collectionRef = @request.auth.collectionId";

  const otps = baseSystemCollection("_otps", "base", true, [
    textField("id", {
      system: true,
      required: true,
      primaryKey: true,
      min: 15,
      max: 15,
      pattern: "^[a-z0-9]+$",
      autogeneratePattern: "[a-z0-9]{15}",
    }),
    textField("collectionRef", { system: true, required: true }),
    textField("recordRef", { system: true, required: true }),
    passwordField("password", { system: true, required: true, hidden: true, min: 0, max: 0, cost: 8 }),
    autodateField("created", { system: true, onCreate: true, onUpdate: false }),
    autodateField("updated", { system: true, onCreate: true, onUpdate: true }),
    textField("sentTo", { system: true, required: false, hidden: true }),
  ], [buildIndex("idx_otps_collectionRef_recordRef", false, "_otps", "collectionRef, recordRef")]);
  otps.listRule = ownerRule;
  otps.viewRule = ownerRule;

  return otps;
}

function buildExternalAuthsCollection(): CollectionInsert {
  const ownerRule =
    "@request.auth.id != '' && recordRef = @request.auth.id && collectionRef = @request.auth.collectionId";

  const externalAuths = baseSystemCollection("_externalAuths", "base", true, [
    textField("id", {
      system: true,
      required: true,
      primaryKey: true,
      min: 15,
      max: 15,
      pattern: "^[a-z0-9]+$",
      autogeneratePattern: "[a-z0-9]{15}",
    }),
    textField("collectionRef", { system: true, required: true }),
    textField("recordRef", { system: true, required: true }),
    textField("provider", { system: true, required: true }),
    textField("providerId", { system: true, required: true }),
    autodateField("created", { system: true, onCreate: true, onUpdate: false }),
    autodateField("updated", { system: true, onCreate: true, onUpdate: true }),
  ], [
    buildIndex("idx_externalAuths_record_provider", true, "_externalAuths", "collectionRef, recordRef, provider"),
    buildIndex("idx_externalAuths_collection_provider", true, "_externalAuths", "collectionRef, provider, providerId"),
  ]);
  externalAuths.listRule = ownerRule;
  externalAuths.viewRule = ownerRule;

  return externalAuths;
}

function buildAuthOriginsCollection(): CollectionInsert {
  const ownerRule =
    "@request.auth.id != '' && recordRef = @request.auth.id && collectionRef = @request.auth.collectionId";

  const authOrigins = baseSystemCollection("_authOrigins", "base", true, [
    textField("id", {
      system: true,
      required: true,
      primaryKey: true,
      min: 15,
      max: 15,
      pattern: "^[a-z0-9]+$",
      autogeneratePattern: "[a-z0-9]{15}",
    }),
    textField("collectionRef", { system: true, required: true }),
    textField("recordRef", { system: true, required: true }),
    textField("fingerprint", { system: true, required: true }),
    autodateField("created", { system: true, onCreate: true, onUpdate: false }),
    autodateField("updated", { system: true, onCreate: true, onUpdate: true }),
  ], [buildIndex("idx_authOrigins_unique_pairs", true, "_authOrigins", "collectionRef, recordRef, fingerprint")]);
  authOrigins.listRule = ownerRule;
  authOrigins.viewRule = ownerRule;
  authOrigins.deleteRule = ownerRule;

  return authOrigins;
}

function buildSuperusersCollection(): CollectionInsert {
  const superusers = baseSystemCollection("_superusers", "auth", true, [
    textField("id", {
      system: true,
      required: true,
      primaryKey: true,
      min: 15,
      max: 15,
      pattern: "^[a-z0-9]+$",
      autogeneratePattern: "[a-z0-9]{15}",
    }),
    passwordField("password", { system: true, required: true, hidden: true, min: 8, max: 0, cost: 0 }),
    textField("tokenKey", {
      system: true,
      required: true,
      hidden: true,
      min: 30,
      max: 60,
      autogeneratePattern: "[a-zA-Z0-9_]{50}",
    }),
    emailField("email", { system: true, required: true }),
    boolField("emailVisibility", { system: true }),
    boolField("verified", { system: true }),
    autodateField("created", { system: true, onCreate: true, onUpdate: false }),
    autodateField("updated", { system: true, onCreate: true, onUpdate: true }),
  ], [
    buildIndex(fieldIndexName("tokenKey", "pbc_3142635823"), true, "_superusers", "tokenKey"),
    buildIndex(fieldIndexName("email", "pbc_3142635823"), true, "_superusers", "email", "email != ''"),
  ]);
  superusers.options = defaultAuthOptions({ authTokenDuration: 86400 });

  return superusers;
}

function baseSystemCollection(
  name: string,
  type: string,
  system: boolean,
  fields: Record<string, unknown>[],
  indexes: string[],
): CollectionInsert {
  return {
    id: collectionId(type, name),
    system,
    type,
    name,
    fields,
    indexes,
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    options: {},
  };
}

function collectionId(type: string, name: string): string {
  return `pbc_${crc32(type + name)}`;
}

function fieldIndexName(field: string, collectionIdValue: string): string {
  const name = `idx_${field}_${collectionIdValue}`;
  return name.length > 64 ? name.slice(0, 64) : name;
}

function buildIndex(name: string, unique: boolean, table: string, columns: string, where?: string): string {
  const uniqueClause = unique ? "UNIQUE " : "";
  const whereClause = where ? ` WHERE ${where}` : "";
  return `CREATE ${uniqueClause}INDEX \`${name}\` ON \`${table}\` (${columns})${whereClause}`;
}

function textField(
  name: string,
  options: {
    system: boolean;
    required: boolean;
    primaryKey?: boolean;
    hidden?: boolean;
    min?: number;
    max?: number;
    pattern?: string;
    autogeneratePattern?: string;
  },
): Record<string, unknown> {
  return {
    type: "text",
    name,
    id: fieldIdChecksum("text", name),
    system: options.system,
    hidden: options.hidden ?? false,
    presentable: false,
    primaryKey: options.primaryKey ?? false,
    required: options.required,
    min: options.min ?? 0,
    max: options.max ?? 0,
    pattern: options.pattern ?? "",
    autogeneratePattern: options.autogeneratePattern ?? "",
  };
}

function passwordField(
  name: string,
  options: {
    system: boolean;
    required: boolean;
    hidden: boolean;
    min: number;
    max: number;
    cost: number;
  },
): Record<string, unknown> {
  return {
    type: "password",
    name,
    id: fieldIdChecksum("password", name),
    system: options.system,
    hidden: options.hidden,
    presentable: false,
    required: options.required,
    min: options.min,
    max: options.max,
    pattern: "",
    cost: options.cost,
  };
}

function emailField(
  name: string,
  options: {
    system: boolean;
    required: boolean;
  },
): Record<string, unknown> {
  return {
    type: "email",
    name,
    id: fieldIdChecksum("email", name),
    system: options.system,
    hidden: false,
    presentable: false,
    required: options.required,
    exceptDomains: null,
    onlyDomains: null,
  };
}

function boolField(
  name: string,
  options: {
    system: boolean;
  },
): Record<string, unknown> {
  return {
    type: "bool",
    name,
    id: fieldIdChecksum("bool", name),
    system: options.system,
    hidden: false,
    presentable: false,
    required: false,
  };
}

function autodateField(
  name: string,
  options: {
    system: boolean;
    onCreate: boolean;
    onUpdate: boolean;
  },
): Record<string, unknown> {
  return {
    type: "autodate",
    name,
    id: fieldIdChecksum("autodate", name),
    system: options.system,
    hidden: false,
    presentable: false,
    onCreate: options.onCreate,
    onUpdate: options.onUpdate,
  };
}

function defaultAuthOptions(options: {
  authTokenDuration: number;
  oauthMappedFields?: { name?: string; avatarURL?: string };
}): {
  authRule: string;
  manageRule: string | null;
  authAlert: { enabled: boolean; emailTemplate: { subject: string; body: string } };
  oauth2: { enabled: boolean; providers: null; mappedFields: { id: string; name: string; username: string; avatarURL: string } };
  passwordAuth: { enabled: boolean; identityFields: string[] };
  mfa: { enabled: boolean; duration: number; rule: string };
  otp: { enabled: boolean; duration: number; length: number; emailTemplate: { subject: string; body: string } };
  authToken: { secret: string; duration: number };
  passwordResetToken: { secret: string; duration: number };
  emailChangeToken: { secret: string; duration: number };
  verificationToken: { secret: string; duration: number };
  fileToken: { secret: string; duration: number };
  verificationTemplate: { subject: string; body: string };
  resetPasswordTemplate: { subject: string; body: string };
  confirmEmailChangeTemplate: { subject: string; body: string };
} {
  const authTokenSecret = randomString(50);
  const passwordResetSecret = randomString(50);
  const emailChangeSecret = randomString(50);
  const verificationSecret = randomString(50);
  const fileSecret = randomString(50);

  return {
    authRule: "",
    manageRule: null,
    authAlert: {
      enabled: true,
      emailTemplate: {
        subject: "Login from a new location",
        body: `<p>Hello,</p>\n<p>We noticed a login to your {APP_NAME} account from a new location:</p>\n<p><em>{ALERT_INFO}</em></p>\n<p><strong>If this wasn't you, you should immediately change your {APP_NAME} account password to revoke access from all other locations.</strong></p>\n<p>If this was you, you may disregard this email.</p>\n<p>\n  Thanks,<br/>\n  {APP_NAME} team\n</p>`,
      },
    },
    oauth2: {
      enabled: false,
      providers: null,
      mappedFields: {
        id: "",
        name: options.oauthMappedFields?.name ?? "",
        username: "",
        avatarURL: options.oauthMappedFields?.avatarURL ?? "",
      },
    },
    passwordAuth: {
      enabled: true,
      identityFields: ["email"],
    },
    mfa: {
      enabled: false,
      duration: 1800,
      rule: "",
    },
    otp: {
      enabled: false,
      duration: 180,
      length: 8,
      emailTemplate: {
        subject: "OTP for {APP_NAME}",
        body: `<p>Hello,</p>\n<p>Your one-time password is: <strong>{OTP}</strong></p>\n<p><i>If you didn't ask for the one-time password, you can ignore this email.</i></p>\n<p>\n  Thanks,<br/>\n  {APP_NAME} team\n</p>`,
      },
    },
    authToken: {
      secret: authTokenSecret,
      duration: options.authTokenDuration,
    },
    passwordResetToken: {
      secret: passwordResetSecret,
      duration: 1800,
    },
    emailChangeToken: {
      secret: emailChangeSecret,
      duration: 1800,
    },
    verificationToken: {
      secret: verificationSecret,
      duration: 259200,
    },
    fileToken: {
      secret: fileSecret,
      duration: 180,
    },
    verificationTemplate: {
      subject: "Verify your {APP_NAME} email",
      body: `<p>Hello,</p>\n<p>Thank you for joining us at {APP_NAME}.</p>\n<p>Click on the button below to verify your email address.</p>\n<p>\n  <a class="btn" href="{APP_URL}/_/#/auth/confirm-verification/{TOKEN}" target="_blank" rel="noopener">Verify</a>\n</p>\n<p>\n  Thanks,<br/>\n  {APP_NAME} team\n</p>`,
    },
    resetPasswordTemplate: {
      subject: "Reset your {APP_NAME} password",
      body: `<p>Hello,</p>\n<p>Click on the button below to reset your password.</p>\n<p>\n  <a class="btn" href="{APP_URL}/_/#/auth/confirm-password-reset/{TOKEN}" target="_blank" rel="noopener">Reset password</a>\n</p>\n<p><i>If you didn't ask to reset your password, you can ignore this email.</i></p>\n<p>\n  Thanks,<br/>\n  {APP_NAME} team\n</p>`,
    },
    confirmEmailChangeTemplate: {
      subject: "Confirm your {APP_NAME} new email address",
      body: `<p>Hello,</p>\n<p>Click on the button below to confirm your new email address.</p>\n<p>\n  <a class="btn" href="{APP_URL}/_/#/auth/confirm-email-change/{TOKEN}" target="_blank" rel="noopener">Confirm new email</a>\n</p>\n<p><i>If you didn't ask to change your email address, you can ignore this email.</i></p>\n<p>\n  Thanks,<br/>\n  {APP_NAME} team\n</p>`,
    },
  };
}

// -------------------------------------------------------------------

function migrateRule(rule: string | null | undefined): string | null {
  if (rule == null) {
    return null;
  }
  return rule.replaceAll("@request.data", "@request.body");
}

function migrateField(field: Record<string, unknown>): Record<string, unknown> {
  switch (toString(field.type)) {
    case "bool":
      return toBoolField(field);
    case "number":
      return toNumberField(field);
    case "text":
      return toTextField(field);
    case "url":
      return toURLField(field);
    case "email":
      return toEmailField(field);
    case "editor":
      return toEditorField(field);
    case "date":
      return toDateField(field);
    case "select":
      return toSelectField(field);
    case "json":
      return toJSONField(field);
    case "relation":
      return toRelationField(field);
    case "file":
      return toFileField(field);
    default:
      return field;
  }
}

function toBoolField(data: Record<string, unknown>): Record<string, unknown> {
  return {
    type: "bool",
    id: toString(data.id),
    name: toString(data.name),
    system: toBool(data.system),
    required: toBool(data.required),
    presentable: toBool(data.presentable),
    hidden: false,
  };
}

function toNumberField(data: Record<string, unknown>): Record<string, unknown> {
  return {
    type: "number",
    id: toString(data.id),
    name: toString(data.name),
    system: toBool(data.system),
    required: toBool(data.required),
    presentable: toBool(data.presentable),
    hidden: false,
    onlyInt: toBool(getMapVal(data, "options", "noDecimal")),
    min: getMapVal(data, "options", "min"),
    max: getMapVal(data, "options", "max"),
  };
}

function toTextField(data: Record<string, unknown>): Record<string, unknown> {
  return {
    type: "text",
    id: toString(data.id),
    name: toString(data.name),
    system: toBool(data.system),
    primaryKey: toBool(data.primaryKey),
    hidden: toBool(data.hidden),
    presentable: toBool(data.presentable),
    required: toBool(data.required),
    min: toInt(getMapVal(data, "options", "min")),
    max: toInt(getMapVal(data, "options", "max")),
    pattern: toString(getMapVal(data, "options", "pattern")),
    autogeneratePattern: toString(getMapVal(data, "options", "autogeneratePattern")),
  };
}

function toEmailField(data: Record<string, unknown>): Record<string, unknown> {
  return {
    type: "email",
    id: toString(data.id),
    name: toString(data.name),
    system: toBool(data.system),
    required: toBool(data.required),
    presentable: toBool(data.presentable),
    hidden: false,
    exceptDomains: toStringSlice(getMapVal(data, "options", "exceptDomains")),
    onlyDomains: toStringSlice(getMapVal(data, "options", "onlyDomains")),
  };
}

function toURLField(data: Record<string, unknown>): Record<string, unknown> {
  return {
    type: "url",
    id: toString(data.id),
    name: toString(data.name),
    system: toBool(data.system),
    required: toBool(data.required),
    presentable: toBool(data.presentable),
    hidden: false,
    exceptDomains: toStringSlice(getMapVal(data, "options", "exceptDomains")),
    onlyDomains: toStringSlice(getMapVal(data, "options", "onlyDomains")),
  };
}

function toEditorField(data: Record<string, unknown>): Record<string, unknown> {
  return {
    type: "editor",
    id: toString(data.id),
    name: toString(data.name),
    system: toBool(data.system),
    required: toBool(data.required),
    presentable: toBool(data.presentable),
    hidden: false,
    convertURLs: toBool(getMapVal(data, "options", "convertUrls")),
  };
}

function toDateField(data: Record<string, unknown>): Record<string, unknown> {
  return {
    type: "date",
    id: toString(data.id),
    name: toString(data.name),
    system: toBool(data.system),
    required: toBool(data.required),
    presentable: toBool(data.presentable),
    hidden: false,
    min: toString(getMapVal(data, "options", "min")),
    max: toString(getMapVal(data, "options", "max")),
  };
}

function toJSONField(data: Record<string, unknown>): Record<string, unknown> {
  return {
    type: "json",
    id: toString(data.id),
    name: toString(data.name),
    system: toBool(data.system),
    required: toBool(data.required),
    presentable: toBool(data.presentable),
    hidden: false,
    maxSize: toInt64(getMapVal(data, "options", "maxSize")),
  };
}

function toSelectField(data: Record<string, unknown>): Record<string, unknown> {
  return {
    type: "select",
    id: toString(data.id),
    name: toString(data.name),
    system: toBool(data.system),
    required: toBool(data.required),
    presentable: toBool(data.presentable),
    hidden: false,
    values: toStringSlice(getMapVal(data, "options", "values")),
    maxSelect: toInt(getMapVal(data, "options", "maxSelect")),
  };
}

function toRelationField(data: Record<string, unknown>): Record<string, unknown> {
  let maxSelect = toInt(getMapVal(data, "options", "maxSelect"));
  if (maxSelect <= 0) {
    maxSelect = 2147483647;
  }

  return {
    type: "relation",
    id: toString(data.id),
    name: toString(data.name),
    system: toBool(data.system),
    required: toBool(data.required),
    presentable: toBool(data.presentable),
    hidden: false,
    collectionId: toString(getMapVal(data, "options", "collectionId")),
    cascadeDelete: toBool(getMapVal(data, "options", "cascadeDelete")),
    minSelect: toInt(getMapVal(data, "options", "minSelect")),
    maxSelect,
  };
}

function toFileField(data: Record<string, unknown>): Record<string, unknown> {
  return {
    type: "file",
    id: toString(data.id),
    name: toString(data.name),
    system: toBool(data.system),
    required: toBool(data.required),
    presentable: toBool(data.presentable),
    hidden: false,
    maxSelect: toInt(getMapVal(data, "options", "maxSelect")),
    maxSize: toInt64(getMapVal(data, "options", "maxSize")),
    thumbs: toStringSlice(getMapVal(data, "options", "thumbs")),
    mimeTypes: toStringSlice(getMapVal(data, "options", "mimeTypes")),
    protected: toBool(getMapVal(data, "options", "protected")),
  };
}

function getMapVal(data: Record<string, unknown>, ...keys: string[]): unknown {
  if (keys.length === 0) {
    return undefined;
  }

  let current: unknown = data;
  for (const key of keys) {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    const next = (current as Record<string, unknown>)[key];
    if (next === undefined) {
      return undefined;
    }
    current = next;
  }

  return current;
}

function zeroFallback<T>(value: T, fallback: T): T {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value === "string" && value === "") {
    return fallback;
  }
  if (typeof value === "number" && value === 0) {
    return fallback;
  }
  return value;
}

function toString(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value == null) {
    return "";
  }
  return String(value);
}

function toInt(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }
  return 0;
}

function toInt64(value: unknown): number {
  return toInt(value);
}

function toBool(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  if (typeof value === "string") {
    return value === "true" || value === "1";
  }
  return false;
}

function toStringSlice(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((entry) => typeof entry === "string") as string[];
  }
  if (typeof value === "string" && value) {
    return [value];
  }
  return [];
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  if (value && typeof value === "object") {
    return value as T;
  }
  return fallback;
}

function replaceAll(value: string, search: string, replacement: string): string {
  if (!value || !search) {
    return value;
  }
  return value.split(search).join(replacement);
}

function trimSuffix(value: string, suffix: string): string {
  if (!suffix || !value.endsWith(suffix)) {
    return value;
  }
  return value.slice(0, -suffix.length);
}

function hasTable(db: Database, name: string): boolean {
  const row = db
    .query("select name from sqlite_master where type='table' and name = ?")
    .get(name) as { name?: string } | undefined;
  return Boolean(row?.name);
}

function hasColumn(db: Database, table: string, column: string): boolean {
  if (!isSafeIdentifier(table)) {
    return false;
  }
  const rows = db.query(`pragma table_info("${table}")`).all() as Array<{ name: string }>;
  return rows.some((row) => row.name.toLowerCase() === column.toLowerCase());
}

function tableColumns(db: Database, table: string): string[] {
  if (!isSafeIdentifier(table)) {
    return [];
  }
  const rows = db.query(`pragma table_info("${table}")`).all() as Array<{ name: string }>;
  return rows.map((row) => row.name);
}

function renameColumn(db: Database, table: string, from: string, to: string): void {
  if (!isSafeIdentifier(table)) {
    throw new Error(`unsafe table name ${table}`);
  }
  db.exec(`ALTER TABLE "${table}" RENAME COLUMN "${from}" TO "${to}"`);
}

function dropColumn(db: Database, table: string, column: string): void {
  if (!isSafeIdentifier(table)) {
    return;
  }
  try {
    db.exec(`ALTER TABLE "${table}" DROP COLUMN "${column}"`);
  } catch {
    // ignore if unsupported or missing column
  }
}

function fieldIdChecksum(type: string, name: string): string {
  return `${type}${crc32(name)}`;
}

function crc32(input: string): number {
  let crc = 0xffffffff;
  for (let i = 0; i < input.length; i += 1) {
    crc ^= input.charCodeAt(i);
    for (let j = 0; j < 8; j += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (~crc) >>> 0;
}

function isSafeIdentifier(value: string): boolean {
  return /^[A-Za-z0-9_]+$/.test(value);
}
