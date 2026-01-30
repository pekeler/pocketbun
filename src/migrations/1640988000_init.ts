// Ported from pocketbase/migrations/1640988000_init.go @ v0.36.1 (9b036fb1)

import type { App } from "../core/app.ts";
import { SystemMigrations } from "../core/migrations_runner.ts";
import { randomString } from "../tools/security/random.ts";

const FILE_NAME = "1640988000_init.go";

SystemMigrations.register(up, down, FILE_NAME);

function up(app: App): void {
  const db = app.db();

  db.run(`
    CREATE TABLE IF NOT EXISTS _params (
      id TEXT PRIMARY KEY DEFAULT ('r'||lower(hex(randomblob(7)))) NOT NULL,
      value JSON DEFAULT NULL,
      created TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%fZ')) NOT NULL,
      updated TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%fZ')) NOT NULL
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS _collections (
      id TEXT PRIMARY KEY DEFAULT ('r'||lower(hex(randomblob(7)))) NOT NULL,
      system BOOLEAN DEFAULT FALSE NOT NULL,
      type TEXT DEFAULT "base" NOT NULL,
      name TEXT UNIQUE NOT NULL,
      fields JSON DEFAULT "[]" NOT NULL,
      indexes JSON DEFAULT "[]" NOT NULL,
      listRule TEXT DEFAULT NULL,
      viewRule TEXT DEFAULT NULL,
      createRule TEXT DEFAULT NULL,
      updateRule TEXT DEFAULT NULL,
      deleteRule TEXT DEFAULT NULL,
      options JSON DEFAULT "{}" NOT NULL,
      created TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%fZ')) NOT NULL,
      updated TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%fZ')) NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx__collections_type ON _collections (type);
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS _mfas (
      collectionRef TEXT DEFAULT '' NOT NULL,
      created TEXT DEFAULT '' NOT NULL,
      id TEXT PRIMARY KEY DEFAULT ('r'||lower(hex(randomblob(7)))) NOT NULL,
      method TEXT DEFAULT '' NOT NULL,
      recordRef TEXT DEFAULT '' NOT NULL,
      updated TEXT DEFAULT '' NOT NULL
    );

    CREATE TABLE IF NOT EXISTS _otps (
      collectionRef TEXT DEFAULT '' NOT NULL,
      created TEXT DEFAULT '' NOT NULL,
      id TEXT PRIMARY KEY DEFAULT ('r'||lower(hex(randomblob(7)))) NOT NULL,
      password TEXT DEFAULT '' NOT NULL,
      recordRef TEXT DEFAULT '' NOT NULL,
      updated TEXT DEFAULT '' NOT NULL,
      sentTo TEXT DEFAULT '' NOT NULL
    );

    CREATE TABLE IF NOT EXISTS _externalAuths (
      collectionRef TEXT DEFAULT '' NOT NULL,
      created TEXT DEFAULT '' NOT NULL,
      id TEXT PRIMARY KEY DEFAULT ('r'||lower(hex(randomblob(7)))) NOT NULL,
      provider TEXT DEFAULT '' NOT NULL,
      providerId TEXT DEFAULT '' NOT NULL,
      recordRef TEXT DEFAULT '' NOT NULL,
      updated TEXT DEFAULT '' NOT NULL
    );

    CREATE TABLE IF NOT EXISTS _authOrigins (
      collectionRef TEXT DEFAULT '' NOT NULL,
      created TEXT DEFAULT '' NOT NULL,
      fingerprint TEXT DEFAULT '' NOT NULL,
      id TEXT PRIMARY KEY DEFAULT ('r'||lower(hex(randomblob(7)))) NOT NULL,
      recordRef TEXT DEFAULT '' NOT NULL,
      updated TEXT DEFAULT '' NOT NULL
    );

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

    CREATE TABLE IF NOT EXISTS users (
      avatar TEXT DEFAULT '',
      created TEXT DEFAULT '' NOT NULL,
      email TEXT DEFAULT '' NOT NULL,
      emailVisibility BOOLEAN DEFAULT FALSE NOT NULL,
      id TEXT PRIMARY KEY DEFAULT ('r'||lower(hex(randomblob(7)))) NOT NULL,
      name TEXT DEFAULT '',
      password TEXT NOT NULL,
      tokenKey TEXT NOT NULL,
      updated TEXT DEFAULT '' NOT NULL,
      verified BOOLEAN DEFAULT FALSE NOT NULL
    );
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_mfas_collectionRef_recordRef ON _mfas (
      collectionRef,
      recordRef
    );

    CREATE INDEX IF NOT EXISTS idx_otps_collectionRef_recordRef ON _otps (
      collectionRef,
      recordRef
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_externalAuths_record_provider ON _externalAuths (
      collectionRef,
      recordRef,
      provider
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_externalAuths_collection_provider ON _externalAuths (
      collectionRef,
      provider,
      providerId
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_authOrigins_unique_pairs ON _authOrigins (
      collectionRef,
      recordRef,
      fingerprint
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_tokenKey__pbc_3142635823 ON _superusers (tokenKey);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_email__pbc_3142635823 ON _superusers (email) WHERE email != '';

    CREATE UNIQUE INDEX IF NOT EXISTS idx_tokenKey__pb_users_auth_ ON users (tokenKey);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_email__pb_users_auth_ ON users (email) WHERE email != '';
  `);

  const systemCollections = buildSystemCollections();
  for (const collection of systemCollections) {
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
}

function down(app: App): void {
  const db = app.db();
  db.run(`
    DROP TABLE IF EXISTS users;
    DROP TABLE IF EXISTS _superusers;
    DROP TABLE IF EXISTS _mfas;
    DROP TABLE IF EXISTS _otps;
    DROP TABLE IF EXISTS _externalAuths;
    DROP TABLE IF EXISTS _authOrigins;
    DROP TABLE IF EXISTS _params;
    DROP TABLE IF EXISTS _collections;
  `);
}

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

function buildSystemCollections(): CollectionInsert[] {
  const ownerRule =
    "@request.auth.id != '' && recordRef = @request.auth.id && collectionRef = @request.auth.collectionId";
  const userRule = "id = @request.auth.id";

  const mfas = baseSystemCollection(
    "_mfas",
    "base",
    true,
    [
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
    ],
    [buildIndex("idx_mfas_collectionRef_recordRef", false, "_mfas", "collectionRef, recordRef")],
  );
  mfas.listRule = ownerRule;
  mfas.viewRule = ownerRule;

  const otps = baseSystemCollection(
    "_otps",
    "base",
    true,
    [
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
      passwordField("password", {
        system: true,
        required: true,
        hidden: true,
        min: 0,
        max: 0,
        cost: 8,
      }),
      autodateField("created", { system: true, onCreate: true, onUpdate: false }),
      autodateField("updated", { system: true, onCreate: true, onUpdate: true }),
      textField("sentTo", { system: true, required: false, hidden: true }),
    ],
    [buildIndex("idx_otps_collectionRef_recordRef", false, "_otps", "collectionRef, recordRef")],
  );
  otps.listRule = ownerRule;
  otps.viewRule = ownerRule;

  const externalAuths = baseSystemCollection(
    "_externalAuths",
    "base",
    true,
    [
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
    ],
    [
      buildIndex(
        "idx_externalAuths_record_provider",
        true,
        "_externalAuths",
        "collectionRef, recordRef, provider",
      ),
      buildIndex(
        "idx_externalAuths_collection_provider",
        true,
        "_externalAuths",
        "collectionRef, provider, providerId",
      ),
    ],
  );
  externalAuths.listRule = ownerRule;
  externalAuths.viewRule = ownerRule;

  const authOrigins = baseSystemCollection(
    "_authOrigins",
    "base",
    true,
    [
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
    ],
    [
      buildIndex(
        "idx_authOrigins_unique_pairs",
        true,
        "_authOrigins",
        "collectionRef, recordRef, fingerprint",
      ),
    ],
  );
  authOrigins.listRule = ownerRule;
  authOrigins.viewRule = ownerRule;
  authOrigins.deleteRule = ownerRule;

  const superusers = baseSystemCollection(
    "_superusers",
    "auth",
    true,
    [
      textField("id", {
        system: true,
        required: true,
        primaryKey: true,
        min: 15,
        max: 15,
        pattern: "^[a-z0-9]+$",
        autogeneratePattern: "[a-z0-9]{15}",
      }),
      passwordField("password", {
        system: true,
        required: true,
        hidden: true,
        min: 8,
        max: 0,
        cost: 0,
      }),
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
    ],
    [
      buildIndex(fieldIndexName("tokenKey", "pbc_3142635823"), true, "_superusers", "tokenKey"),
      buildIndex(
        fieldIndexName("email", "pbc_3142635823"),
        true,
        "_superusers",
        "email",
        "email != ''",
      ),
    ],
  );
  superusers.options = defaultAuthOptions({ authTokenDuration: 86400 });

  const users = baseSystemCollection(
    "users",
    "auth",
    false,
    [
      textField("id", {
        system: true,
        required: true,
        primaryKey: true,
        min: 15,
        max: 15,
        pattern: "^[a-z0-9]+$",
        autogeneratePattern: "[a-z0-9]{15}",
      }),
      passwordField("password", {
        system: true,
        required: true,
        hidden: true,
        min: 8,
        max: 0,
        cost: 0,
      }),
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
      textField("name", { system: false, required: false, max: 255 }),
      fileField("avatar", {
        system: false,
        required: false,
        maxSelect: 1,
        mimeTypes: ["image/jpeg", "image/png", "image/svg+xml", "image/gif", "image/webp"],
      }),
      autodateField("created", { system: false, onCreate: true, onUpdate: false }),
      autodateField("updated", { system: false, onCreate: true, onUpdate: true }),
    ],
    [
      buildIndex(fieldIndexName("tokenKey", "_pb_users_auth_"), true, "users", "tokenKey"),
      buildIndex(fieldIndexName("email", "_pb_users_auth_"), true, "users", "email", "email != ''"),
    ],
  );
  users.id = "_pb_users_auth_";
  users.listRule = userRule;
  users.viewRule = userRule;
  users.createRule = "";
  users.updateRule = userRule;
  users.deleteRule = userRule;
  users.options = defaultAuthOptions({
    authTokenDuration: 604800,
    oauthMappedFields: { name: "name", avatarURL: "avatar" },
  });

  return [mfas, otps, externalAuths, authOrigins, superusers, users];
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

function fieldIndexName(field: string, collectionId: string): string {
  const name = `idx_${field}_${collectionId}`;
  return name.length > 64 ? name.slice(0, 64) : name;
}

function buildIndex(
  name: string,
  unique: boolean,
  table: string,
  columns: string,
  where?: string,
): string {
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
    id: fieldId("text", name),
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
    id: fieldId("password", name),
    system: options.system,
    hidden: options.hidden,
    presentable: false,
    required: options.required,
    min: options.min,
    max: options.max,
    cost: options.cost,
    pattern: "",
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
    id: fieldId("email", name),
    system: options.system,
    hidden: false,
    presentable: false,
    required: options.required,
    exceptDomains: null,
    onlyDomains: null,
  };
}

function boolField(name: string, options: { system: boolean }): Record<string, unknown> {
  return {
    type: "bool",
    name,
    id: fieldId("bool", name),
    system: options.system,
    hidden: false,
    presentable: false,
    required: false,
  };
}

function autodateField(
  name: string,
  options: { system: boolean; onCreate: boolean; onUpdate: boolean },
): Record<string, unknown> {
  return {
    type: "autodate",
    name,
    id: fieldId("autodate", name),
    system: options.system,
    hidden: false,
    presentable: false,
    onCreate: options.onCreate,
    onUpdate: options.onUpdate,
  };
}

function fileField(
  name: string,
  options: {
    system: boolean;
    required: boolean;
    maxSelect: number;
    mimeTypes: string[];
  },
): Record<string, unknown> {
  return {
    type: "file",
    name,
    id: fieldId("file", name),
    system: options.system,
    hidden: false,
    presentable: false,
    required: options.required,
    maxSelect: options.maxSelect,
    maxSize: 5242880,
    mimeTypes: options.mimeTypes,
    thumbs: null,
    protected: false,
  };
}

function fieldId(type: string, name: string): string {
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
  return ~crc >>> 0;
}

function defaultAuthOptions(options: {
  authTokenDuration: number;
  oauthMappedFields?: { name?: string; avatarURL?: string };
}): Record<string, unknown> {
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
