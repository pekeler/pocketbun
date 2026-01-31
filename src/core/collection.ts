// Ported from pocketbase/core/collection_model.go @ v0.36.1 (9b036fb1)

export const CollectionNameSuperusers = "_superusers";

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
  listRule: string | null;
  viewRule: string | null;
  createRule: string | null;
  updateRule: string | null;
  deleteRule: string | null;
  options: CollectionAuthOptions;

  constructor(values: {
    id: string;
    name: string;
    type: string;
    system?: boolean;
    fields?: CollectionField[];
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
    this.listRule = values.listRule ?? null;
    this.viewRule = values.viewRule ?? null;
    this.createRule = values.createRule ?? null;
    this.updateRule = values.updateRule ?? null;
    this.deleteRule = values.deleteRule ?? null;
    this.options = normalizeAuthOptions(values.options ?? null);
  }

  isAuth(): boolean {
    return this.type === "auth";
  }
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
