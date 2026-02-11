// Ported from pocketbase/tools/auth/patreon.go

import { ParseDateTime } from "../types/index.ts";
import { AuthUser, type OAuth2Token, Providers, wrapFactory } from "./auth.ts";
import { BaseProvider } from "./base_provider.ts";

// NamePatreon is the unique name of the Patreon provider.
export const NamePatreon = "patreon";

// Patreon allows authentication via Patreon OAuth2.
export class Patreon extends BaseProvider {
  constructor() {
    super();
    this.setDefaults({
      displayName: "Patreon",
      pkce: true,
      scopes: ["identity", "identity[email]"],
      authURL: "https://www.patreon.com/oauth2/authorize",
      tokenURL: "https://www.patreon.com/api/oauth2/token",
      userInfoURL:
        "https://www.patreon.com/api/oauth2/v2/identity?fields%5Buser%5D=full_name,email,vanity,image_url,is_email_verified",
    });
  }

  // FetchAuthUser returns an AuthUser instance based on the Patreons's identity api.
  //
  // API reference:
  // https://docs.patreon.com/#get-api-oauth2-v2-identity
  // https://docs.patreon.com/#user-v2
  override async FetchAuthUser(token: OAuth2Token): Promise<AuthUser> {
    const data = await this.FetchRawUserInfo(token);
    const text = new TextDecoder().decode(data);
    const rawUser = parseRawUser(text);
    const extracted = parsePatreonUser(text);

    const user = new AuthUser({
      Id: extracted.Data.Id,
      Username: extracted.Data.Attributes.Username,
      Name: extracted.Data.Attributes.Name,
      AvatarURL: extracted.Data.Attributes.AvatarURL,
      RawUser: rawUser,
      AccessToken: resolveTokenString(token, "accessToken", "access_token"),
      RefreshToken: resolveTokenString(token, "refreshToken", "refresh_token"),
    });
    user.Expiry = ParseDateTime(token.expiry ?? null);

    if (extracted.Data.Attributes.IsEmailVerified) {
      user.Email = extracted.Data.Attributes.Email;
    }

    return user;
  }
}

Providers[NamePatreon] = wrapFactory(() => new Patreon());

function parseRawUser(raw: string): Record<string, unknown> {
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("invalid patreon oauth2 user payload");
  }

  return parsed as Record<string, unknown>;
}

function parsePatreonUser(raw: string): {
  Data: {
    Id: string;
    Attributes: {
      Email: string;
      Name: string;
      Username: string;
      AvatarURL: string;
      IsEmailVerified: boolean;
    };
  };
} {
  const payload = parseRawUser(raw);
  const data = readObjectField(payload, "data", "invalid patreon oauth2 payload field data");
  const attributes = readObjectField(data, "attributes", "invalid patreon oauth2 payload field data.attributes");

  return {
    Data: {
      Id: readStringField(data, "id"),
      Attributes: {
        Email: readStringField(attributes, "email"),
        Name: readStringField(attributes, "full_name"),
        Username: readStringField(attributes, "vanity"),
        AvatarURL: readStringField(attributes, "image_url"),
        IsEmailVerified: readBoolField(attributes, "is_email_verified"),
      },
    },
  };
}

function readObjectField(payload: Record<string, unknown>, key: string, typeError: string): Record<string, unknown> {
  const value = payload[key];
  if (value == null) {
    return {};
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(typeError);
  }
  return value as Record<string, unknown>;
}

function readStringField(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (value == null) {
    return "";
  }
  if (typeof value !== "string") {
    throw new Error(`invalid patreon oauth2 payload field ${key}`);
  }
  return value;
}

function readBoolField(payload: Record<string, unknown>, key: string): boolean {
  const value = payload[key];
  if (value == null) {
    return false;
  }
  if (typeof value !== "boolean") {
    throw new Error(`invalid patreon oauth2 payload field ${key}`);
  }
  return value;
}

function resolveTokenString(token: OAuth2Token, ...keys: string[]): string {
  for (const key of keys) {
    const value = token[key];
    if (typeof value === "string" && value) {
      return value;
    }
  }

  return "";
}
