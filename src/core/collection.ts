// Ported from pocketbase/core/collection_model.go @ v0.36.1 (9b036fb1)

export const CollectionNameSuperusers = "_superusers";

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
  options: CollectionAuthOptions;

  constructor(values: {
    id: string;
    name: string;
    type: string;
    options?: Partial<CollectionAuthOptions> | null;
  }) {
    this.id = values.id;
    this.name = values.name;
    this.type = values.type;
    this.options = normalizeAuthOptions(values.options ?? null);
  }

  isAuth(): boolean {
    return this.type === "auth";
  }
}

function normalizeAuthOptions(options: Partial<CollectionAuthOptions> | null): CollectionAuthOptions {
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
