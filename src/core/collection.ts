// Ported from pocketbase/core/collection_model.go

import { FieldsList, NewFieldsList } from "./fields_list.ts";
import { TextField, defaultLowercaseRecordIdPattern } from "./field_text.ts";
import {
  FieldNameEmail,
  FieldNameEmailVisibility,
  FieldNameId,
  FieldNamePassword,
  FieldNameTokenKey,
  FieldNameVerified,
} from "./field.ts";
import { BoolField } from "./field_bool.ts";
import { EmailField } from "./field_email.ts";
import { PasswordField } from "./field_password.ts";
import { randomString } from "../tools/security/random.ts";

export const CollectionNameSuperusers = "_superusers";
export const CollectionTypeBase = "base";
export const CollectionTypeAuth = "auth";
export const CollectionTypeView = "view";

export type CollectionField = {
  name: string;
  type: string;
  system: boolean;
  hidden: boolean;
  raw: Record<string, unknown>;
};

export type TokenConfig = {
  secret: string;
  duration: number;
};

export type CollectionAuthOptions = {
  authToken: TokenConfig;
  fileToken: TokenConfig;
  verificationToken: TokenConfig;
  passwordResetToken: TokenConfig;
  emailChangeToken: TokenConfig;
};

export class Collection {
  id: string;
  name: string;
  type: string;
  system: boolean;
  fields: CollectionField[];
  Fields: FieldsList;
  indexes: string[];
  listRule: string | null;
  viewRule: string | null;
  createRule: string | null;
  updateRule: string | null;
  deleteRule: string | null;
  options: CollectionAuthOptions;

  #isNew: boolean;

  constructor(values: {
    id: string;
    name: string;
    type: string;
    system?: boolean;
    fields?: CollectionField[];
    Fields?: FieldsList;
    indexes?: string[];
    listRule?: string | null;
    viewRule?: string | null;
    createRule?: string | null;
    updateRule?: string | null;
    deleteRule?: string | null;
    options?: Partial<CollectionAuthOptions> | null;
  }) {
    this.id = values.id;
    this.name = values.name;
    this.type = values.type;
    this.system = Boolean(values.system);
    this.fields = values.fields ?? [];
    this.Fields = values.Fields ?? new FieldsList();
    this.indexes = values.indexes ?? [];
    this.listRule = values.listRule ?? null;
    this.viewRule = values.viewRule ?? null;
    this.createRule = values.createRule ?? null;
    this.updateRule = values.updateRule ?? null;
    this.deleteRule = values.deleteRule ?? null;
    this.options = normalizeAuthOptions(values.options ?? null);
    this.#isNew = false;
  }

  get Id(): string {
    return this.id;
  }

  set Id(value: string) {
    this.id = value;
  }

  get Name(): string {
    return this.name;
  }

  set Name(value: string) {
    this.name = value;
  }

  get Type(): string {
    return this.type;
  }

  set Type(value: string) {
    this.type = value;
  }

  isAuth(): boolean {
    return this.type === CollectionTypeAuth;
  }

  isView(): boolean {
    return this.type === CollectionTypeView;
  }

  BaseFilesPath(): string {
    return this.id;
  }

  isNew(): boolean {
    return this.#isNew;
  }

  markNew(value = true): void {
    this.#isNew = value;
  }
}

export function NewBaseCollection(name: string, id = ""): Collection {
  const collection = new Collection({
    id,
    name,
    type: CollectionTypeBase,
  });
  collection.markNew(true);
  collection.Fields = NewFieldsList();

  const idField = new TextField();
  idField.Name = FieldNameId;
  idField.System = true;
  idField.PrimaryKey = true;
  idField.Required = true;
  idField.Min = 15;
  idField.Max = 15;
  idField.Pattern = defaultLowercaseRecordIdPattern;
  idField.AutogeneratePattern = "[a-z0-9]{15}";
  collection.Fields.Add(idField);

  return collection;
}

export function NewAuthCollection(name: string, id = ""): Collection {
  const collection = new Collection({
    id,
    name,
    type: CollectionTypeAuth,
    options: defaultAuthOptions(),
  });
  collection.markNew(true);
  collection.Fields = NewFieldsList();

  const idField = new TextField();
  idField.Name = FieldNameId;
  idField.System = true;
  idField.PrimaryKey = true;
  idField.Required = true;
  idField.Min = 15;
  idField.Max = 15;
  idField.Pattern = defaultLowercaseRecordIdPattern;
  idField.AutogeneratePattern = "[a-z0-9]{15}";
  collection.Fields.Add(idField);

  const passwordField = new PasswordField();
  passwordField.Name = FieldNamePassword;
  passwordField.System = true;
  passwordField.Hidden = true;
  passwordField.Required = true;
  passwordField.Min = 8;
  collection.Fields.Add(passwordField);

  const tokenKeyField = new TextField();
  tokenKeyField.Name = FieldNameTokenKey;
  tokenKeyField.System = true;
  tokenKeyField.Hidden = true;
  tokenKeyField.Required = true;
  tokenKeyField.Min = 30;
  tokenKeyField.Max = 60;
  tokenKeyField.AutogeneratePattern = "[a-zA-Z0-9]{50}";
  collection.Fields.Add(tokenKeyField);

  const emailField = new EmailField();
  emailField.Name = FieldNameEmail;
  emailField.System = true;
  emailField.Required = true;
  collection.Fields.Add(emailField);

  const emailVisibilityField = new BoolField();
  emailVisibilityField.Name = FieldNameEmailVisibility;
  emailVisibilityField.System = true;
  collection.Fields.Add(emailVisibilityField);

  const verifiedField = new BoolField();
  verifiedField.Name = FieldNameVerified;
  verifiedField.System = true;
  collection.Fields.Add(verifiedField);

  return collection;
}

export function NewViewCollection(name: string, id = ""): Collection {
  const collection = new Collection({
    id,
    name,
    type: CollectionTypeView,
  });
  collection.markNew(true);
  collection.Fields = NewFieldsList();

  const idField = new TextField();
  idField.Name = FieldNameId;
  idField.System = true;
  idField.PrimaryKey = true;
  idField.Required = true;
  idField.Min = 15;
  idField.Max = 15;
  idField.Pattern = defaultLowercaseRecordIdPattern;
  idField.AutogeneratePattern = "[a-z0-9]{15}";
  collection.Fields.Add(idField);

  return collection;
}

export function parseCollectionFields(raw: unknown): CollectionField[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const fields: CollectionField[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const record = entry as Record<string, unknown>;
    const name = typeof record.name === "string" ? record.name : "";
    if (!name) {
      continue;
    }
    fields.push({
      name,
      type: typeof record.type === "string" ? record.type : "",
      system: Boolean(record.system),
      hidden: Boolean(record.hidden),
      raw: record,
    });
  }

  return fields;
}

function defaultAuthOptions(): CollectionAuthOptions {
  return {
    authToken: { secret: randomString(50), duration: 604800 },
    fileToken: { secret: randomString(50), duration: 180 },
    verificationToken: { secret: randomString(50), duration: 259200 },
    passwordResetToken: { secret: randomString(50), duration: 1800 },
    emailChangeToken: { secret: randomString(50), duration: 1800 },
  };
}

function normalizeAuthOptions(
  options: Partial<CollectionAuthOptions> | null,
): CollectionAuthOptions {
  return {
    authToken: normalizeTokenConfig(options?.authToken),
    fileToken: normalizeTokenConfig(options?.fileToken),
    verificationToken: normalizeTokenConfig(options?.verificationToken),
    passwordResetToken: normalizeTokenConfig(options?.passwordResetToken),
    emailChangeToken: normalizeTokenConfig(options?.emailChangeToken),
  };
}

function normalizeTokenConfig(config: TokenConfig | undefined): TokenConfig {
  if (!config) {
    return { secret: "", duration: 0 };
  }

  return {
    secret: typeof config.secret === "string" ? config.secret : "",
    duration: typeof config.duration === "number" ? config.duration : 0,
  };
}
