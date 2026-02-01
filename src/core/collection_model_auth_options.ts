// Ported from pocketbase/core/collection_model_auth_options.go

import { toNumberValue, toStringValue } from "../internal/compat/cast.ts";
import { ValidationErrors, ErrRequired, newError, required } from "../internal/compat/validation.ts";
import { newProviderByName } from "../tools/auth/index.ts";
import { toUniqueStringSlice } from "../tools/list/list.ts";
import { randomString } from "../tools/security/random.ts";
import {
  defaultAuthAlertTemplate,
  defaultConfirmEmailChangeTemplate,
  defaultOTPTemplate,
  defaultResetPasswordTemplate,
  defaultVerificationTemplate,
} from "./collection_model_auth_templates.ts";

export type TokenConfig = {
  Secret: string;
  Duration: number;
};

export class TokenConfigValue implements TokenConfig {
  Secret: string;
  Duration: number;

  constructor(secret = "", duration = 0) {
    this.Secret = secret;
    this.Duration = duration;
  }

  Validate(): Error | null {
    const errors: Record<string, Error> = {};

    if (required(this.Secret)) {
      errors.secret = ErrRequired;
    } else if (this.Secret.length < 30 || this.Secret.length > 255) {
      errors.secret = newError("validation_length", "The length must be between 30 and 255.");
    }

    if (required(this.Duration)) {
      errors.duration = ErrRequired;
    } else if (this.Duration < 10) {
      errors.duration = newError("validation_min", "Must be greater than or equal to 10.");
    } else if (this.Duration > 94670856) {
      errors.duration = newError("validation_max", "Must be less than or equal to 94670856.");
    }

    return Object.keys(errors).length > 0 ? new ValidationErrors(errors) : null;
  }

  DurationTime(): number {
    return this.Duration;
  }
}

export type EmailTemplateData = {
  Subject: string;
  Body: string;
};

export class EmailTemplate implements EmailTemplateData {
  Subject: string;
  Body: string;

  constructor(subject = "", body = "") {
    this.Subject = subject;
    this.Body = body;
  }

  Validate(): Error | null {
    const errors: Record<string, Error> = {};
    if (required(this.Subject)) {
      errors.subject = ErrRequired;
    }
    if (required(this.Body)) {
      errors.body = ErrRequired;
    }
    return Object.keys(errors).length > 0 ? new ValidationErrors(errors) : null;
  }

  Resolve(placeholders: Record<string, unknown> | null | undefined): {
    subject: string;
    body: string;
  } {
    let subject = this.Subject;
    let body = this.Body;

    if (!placeholders) {
      return { subject, body };
    }

    for (const [key, value] of Object.entries(placeholders)) {
      const valueStr = toStringValue(value);
      subject = subject.split(key).join(valueStr);
      body = body.split(key).join(valueStr);
    }

    return { subject, body };
  }
}

export class AuthAlertConfig {
  Enabled = false;
  EmailTemplate = new EmailTemplate();

  Validate(): Error | null {
    const templateErr = this.EmailTemplate.Validate();
    if (templateErr) {
      return new ValidationErrors({ emailTemplate: templateErr });
    }
    return null;
  }
}

export class OTPConfig {
  Enabled = false;
  Duration = 0;
  Length = 0;
  EmailTemplate = new EmailTemplate();

  Validate(): Error | null {
    const errors: Record<string, Error> = {};

    if (this.Enabled) {
      if (required(this.Duration)) {
        errors.duration = ErrRequired;
      } else if (this.Duration < 10) {
        errors.duration = newError("validation_min", "Must be greater than or equal to 10.");
      } else if (this.Duration > 86400) {
        errors.duration = newError("validation_max", "Must be less than or equal to 86400.");
      }

      if (required(this.Length)) {
        errors.length = ErrRequired;
      } else if (this.Length < 4) {
        errors.length = newError("validation_min", "Must be greater than or equal to 4.");
      }
    }

    const templateErr = this.EmailTemplate.Validate();
    if (templateErr) {
      errors.emailTemplate = templateErr;
    }

    return Object.keys(errors).length > 0 ? new ValidationErrors(errors) : null;
  }

  DurationTime(): number {
    return this.Duration;
  }
}

export class MFAConfig {
  Enabled = false;
  Duration = 0;
  Rule = "";

  Validate(): Error | null {
    if (!this.Enabled) {
      return null;
    }

    const errors: Record<string, Error> = {};
    if (required(this.Duration)) {
      errors.duration = ErrRequired;
    } else if (this.Duration < 10) {
      errors.duration = newError("validation_min", "Must be greater than or equal to 10.");
    } else if (this.Duration > 86400) {
      errors.duration = newError("validation_max", "Must be less than or equal to 86400.");
    }

    return Object.keys(errors).length > 0 ? new ValidationErrors(errors) : null;
  }

  DurationTime(): number {
    return this.Duration;
  }
}

export class PasswordAuthConfig {
  Enabled = false;
  IdentityFields: string[] | null = null;

  Validate(): Error | null {
    if (!this.Enabled) {
      return null;
    }

    const identity = toUniqueStringSlice(this.IdentityFields ?? []);
    this.IdentityFields = identity.length > 0 ? identity : [];

    if (this.IdentityFields.length === 0) {
      return new ValidationErrors({ identityFields: ErrRequired });
    }

    return null;
  }
}

export type OAuth2KnownFields = {
  Id: string;
  Name: string;
  Username: string;
  AvatarURL: string;
};

export class OAuth2Config {
  Providers: OAuth2ProviderConfig[] | null = null;
  MappedFields: OAuth2KnownFields = { Id: "", Name: "", Username: "", AvatarURL: "" };
  Enabled = false;

  GetProviderConfig(name: string): { config: OAuth2ProviderConfig; exists: boolean } {
    const providers = this.Providers ?? [];
    for (const p of providers) {
      if (p.Name === name) {
        return { config: p, exists: true };
      }
    }
    return { config: new OAuth2ProviderConfig(), exists: false };
  }

  Validate(): Error | null {
    if (!this.Enabled) {
      return null;
    }

    const providers = this.Providers ?? [];
    const err = checkForDuplicatedProviders(providers);
    if (err) {
      return new ValidationErrors({ providers: err });
    }

    for (let i = 0; i < providers.length; i += 1) {
      const providerErr = providers[i]?.Validate() ?? null;
      if (providerErr) {
        const errors: Record<string, Error> = {};
        errors[String(i)] = providerErr;
        return new ValidationErrors({ providers: new ValidationErrors(errors) });
      }
    }

    return null;
  }
}

export class OAuth2ProviderConfig {
  PKCE: boolean | null = null;
  Name = "";
  ClientId = "";
  ClientSecret = "";
  AuthURL = "";
  TokenURL = "";
  UserInfoURL = "";
  DisplayName = "";
  Extra: Record<string, unknown> | null = null;

  Validate(): Error | null {
    const errors: Record<string, Error> = {};

    if (required(this.Name)) {
      errors.name = ErrRequired;
    } else {
      const err = checkProviderName(this.Name);
      if (err) {
        errors.name = err;
      }
    }

    if (required(this.ClientId)) {
      errors.clientId = ErrRequired;
    }
    if (required(this.ClientSecret)) {
      errors.clientSecret = ErrRequired;
    }

    const authErr = checkUrl(this.AuthURL);
    if (authErr) {
      errors.authURL = authErr;
    }
    const tokenErr = checkUrl(this.TokenURL);
    if (tokenErr) {
      errors.tokenURL = tokenErr;
    }
    const userErr = checkUrl(this.UserInfoURL);
    if (userErr) {
      errors.userInfoURL = userErr;
    }

    return Object.keys(errors).length > 0 ? new ValidationErrors(errors) : null;
  }

  InitProvider(): {
    provider: import("../tools/auth/auth.ts").Provider | null;
    error: Error | null;
  } {
    let provider: import("../tools/auth/auth.ts").Provider;
    try {
      provider = newProviderByName(this.Name);
    } catch (error) {
      return { provider: null, error: error as Error };
    }

    if (this.ClientId !== "") {
      provider.SetClientId(this.ClientId);
    }
    if (this.ClientSecret !== "") {
      provider.SetClientSecret(this.ClientSecret);
    }
    if (this.AuthURL !== "") {
      provider.SetAuthURL(this.AuthURL);
    }
    if (this.UserInfoURL !== "") {
      provider.SetUserInfoURL(this.UserInfoURL);
    }
    if (this.TokenURL !== "") {
      provider.SetTokenURL(this.TokenURL);
    }
    if (this.DisplayName !== "") {
      provider.SetDisplayName(this.DisplayName);
    }
    if (this.PKCE !== null) {
      provider.SetPKCE(this.PKCE);
    }
    if (this.Extra) {
      provider.SetExtra(this.Extra);
    }

    return { provider, error: null };
  }
}

export type CollectionAuthOptions = {
  AuthRule: string | null;
  ManageRule: string | null;
  AuthAlert: AuthAlertConfig;
  OAuth2: OAuth2Config;
  PasswordAuth: PasswordAuthConfig;
  MFA: MFAConfig;
  OTP: OTPConfig;
  AuthToken: TokenConfigValue;
  PasswordResetToken: TokenConfigValue;
  EmailChangeToken: TokenConfigValue;
  VerificationToken: TokenConfigValue;
  FileToken: TokenConfigValue;
  VerificationTemplate: EmailTemplate;
  ResetPasswordTemplate: EmailTemplate;
  ConfirmEmailChangeTemplate: EmailTemplate;
};

export function createDefaultAuthOptions(): CollectionAuthOptions {
  return {
    AuthRule: "",
    ManageRule: null,
    AuthAlert: normalizeAuthAlertConfig({ enabled: true, emailTemplate: defaultAuthAlertTemplate }),
    OAuth2: normalizeOAuth2Config({ enabled: false }),
    PasswordAuth: normalizePasswordAuthConfig({ enabled: true, identityFields: ["email"] }),
    MFA: normalizeMFAConfig({ enabled: false, duration: 1800, rule: "" }),
    OTP: normalizeOTPConfig({
      enabled: false,
      duration: 180,
      length: 8,
      emailTemplate: defaultOTPTemplate,
    }),
    AuthToken: normalizeTokenConfig({ secret: randomSecret(), duration: 604800 }),
    PasswordResetToken: normalizeTokenConfig({ secret: randomSecret(), duration: 1800 }),
    EmailChangeToken: normalizeTokenConfig({ secret: randomSecret(), duration: 1800 }),
    VerificationToken: normalizeTokenConfig({ secret: randomSecret(), duration: 259200 }),
    FileToken: normalizeTokenConfig({ secret: randomSecret(), duration: 180 }),
    VerificationTemplate: normalizeEmailTemplate(defaultVerificationTemplate),
    ResetPasswordTemplate: normalizeEmailTemplate(defaultResetPasswordTemplate),
    ConfirmEmailChangeTemplate: normalizeEmailTemplate(defaultConfirmEmailChangeTemplate),
  };
}

function randomSecret(): string {
  return randomString(50);
}

export function normalizeEmailTemplate(raw: unknown): EmailTemplate {
  if (!raw || typeof raw !== "object") {
    return new EmailTemplate();
  }
  const record = raw as Record<string, unknown>;
  const subject = toStringValue(record.subject ?? record.Subject);
  const body = toStringValue(record.body ?? record.Body);
  return new EmailTemplate(subject, body);
}

export function normalizeAuthAlertConfig(raw: unknown): AuthAlertConfig {
  const result = new AuthAlertConfig();
  if (!raw || typeof raw !== "object") {
    return result;
  }
  const record = raw as Record<string, unknown>;
  if (typeof record.enabled === "boolean") {
    result.Enabled = record.enabled;
  }
  if (record.emailTemplate != null) {
    result.EmailTemplate = normalizeEmailTemplate(record.emailTemplate);
  }
  return result;
}

export function normalizeTokenConfig(raw: unknown): TokenConfigValue {
  if (!raw || typeof raw !== "object") {
    return new TokenConfigValue();
  }
  const record = raw as Record<string, unknown>;
  const secret = toStringValue(record.secret ?? record.Secret);
  const duration = toNumberValue(record.duration ?? record.Duration);
  return new TokenConfigValue(secret, duration);
}

export function normalizeOTPConfig(raw: unknown): OTPConfig {
  const result = new OTPConfig();
  if (!raw || typeof raw !== "object") {
    return result;
  }
  const record = raw as Record<string, unknown>;
  if (typeof record.enabled === "boolean") {
    result.Enabled = record.enabled;
  }
  result.Duration = toNumberValue(record.duration ?? record.Duration);
  const length = toNumberValue(record.length ?? record.Length);
  result.Length = length ? Math.trunc(length) : 0;
  if (record.emailTemplate != null) {
    result.EmailTemplate = normalizeEmailTemplate(record.emailTemplate);
  }
  return result;
}

export function normalizeMFAConfig(raw: unknown): MFAConfig {
  const result = new MFAConfig();
  if (!raw || typeof raw !== "object") {
    return result;
  }
  const record = raw as Record<string, unknown>;
  if (typeof record.enabled === "boolean") {
    result.Enabled = record.enabled;
  }
  result.Duration = toNumberValue(record.duration ?? record.Duration);
  result.Rule = toStringValue(record.rule ?? record.Rule);
  return result;
}

export function normalizePasswordAuthConfig(raw: unknown): PasswordAuthConfig {
  const result = new PasswordAuthConfig();
  if (!raw || typeof raw !== "object") {
    return result;
  }
  const record = raw as Record<string, unknown>;
  if (typeof record.enabled === "boolean") {
    result.Enabled = record.enabled;
  }
  const fields = record.identityFields ?? record.IdentityFields;
  if (fields != null) {
    result.IdentityFields = toUniqueStringSlice(fields);
  }
  return result;
}

export function normalizeOAuth2Config(raw: unknown): OAuth2Config {
  const result = new OAuth2Config();
  if (!raw || typeof raw !== "object") {
    return result;
  }
  const record = raw as Record<string, unknown>;
  if (typeof record.enabled === "boolean") {
    result.Enabled = record.enabled;
  }

  if (Array.isArray(record.providers) || Array.isArray(record.Providers)) {
    const providers = (record.providers ?? record.Providers) as unknown[];
    result.Providers = providers.map((item) => normalizeOAuth2ProviderConfig(item));
  } else {
    result.Providers = null;
  }

  if (record.mappedFields && typeof record.mappedFields === "object") {
    const fields = record.mappedFields as Record<string, unknown>;
    result.MappedFields = {
      Id: toStringValue(fields.id ?? fields.Id),
      Name: toStringValue(fields.name ?? fields.Name),
      Username: toStringValue(fields.username ?? fields.Username),
      AvatarURL: toStringValue(fields.avatarURL ?? fields.AvatarURL),
    };
  }

  return result;
}

export function normalizeOAuth2ProviderConfig(raw: unknown): OAuth2ProviderConfig {
  const result = new OAuth2ProviderConfig();
  if (!raw || typeof raw !== "object") {
    return result;
  }
  const record = raw as Record<string, unknown>;
  if (typeof record.pkce === "boolean") {
    result.PKCE = record.pkce;
  } else if (typeof record.PKCE === "boolean") {
    result.PKCE = record.PKCE;
  }
  result.Name = toStringValue(record.name ?? record.Name);
  result.ClientId = toStringValue(record.clientId ?? record.ClientId);
  result.ClientSecret = toStringValue(record.clientSecret ?? record.ClientSecret);
  result.AuthURL = toStringValue(record.authURL ?? record.AuthURL);
  result.TokenURL = toStringValue(record.tokenURL ?? record.TokenURL);
  result.UserInfoURL = toStringValue(record.userInfoURL ?? record.UserInfoURL);
  result.DisplayName = toStringValue(record.displayName ?? record.DisplayName);
  if (record.extra && typeof record.extra === "object") {
    result.Extra = record.extra as Record<string, unknown>;
  } else if (record.Extra && typeof record.Extra === "object") {
    result.Extra = record.Extra as Record<string, unknown>;
  }
  return result;
}

export function checkForDuplicatedProviders(configs: OAuth2ProviderConfig[]): Error | null {
  const existing = new Set<string>();

  for (let i = 0; i < configs.length; i += 1) {
    const c = configs[i];
    if (!c?.Name) {
      continue;
    }
    const key = c.Name;
    if (existing.has(key)) {
      const err = newError("validation_duplicated_provider", "The provider {{.name}} is already registered.").setParams({
        name: c.Name,
      });
      return new ValidationErrors({ [String(i)]: new ValidationErrors({ name: err }) });
    }
    existing.add(key);
  }

  return null;
}

function checkProviderName(value: string): Error | null {
  if (!value) {
    return null;
  }

  try {
    newProviderByName(value);
  } catch {
    return newError("validation_missing_provider", "Invalid or missing provider with name {{.name}}.").setParams({
      name: value,
    });
  }

  return null;
}

function checkUrl(value: string): Error | null {
  if (!value) {
    return null;
  }
  try {
    // eslint-disable-next-line no-new
    new URL(value);
  } catch {
    return newError("validation_is_url", "Must be a valid URL.");
  }
  return null;
}
