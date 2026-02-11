// Ported from pocketbase/tools/auth/wakatime.go

import { ParseDateTime } from "../types/index.ts";
import { AuthUser, type OAuth2Token, Providers, wrapFactory } from "./auth.ts";
import { BaseProvider } from "./base_provider.ts";

// NameWakatime is the unique name of the Wakatime provider.
export const NameWakatime = "wakatime";

// Wakatime is an auth provider for Wakatime.
export class Wakatime extends BaseProvider {
  constructor() {
    super();
    this.setDefaults({
      displayName: "WakaTime",
      pkce: true,
      scopes: ["email"],
      authURL: "https://wakatime.com/oauth/authorize",
      tokenURL: "https://wakatime.com/oauth/token",
      userInfoURL: "https://wakatime.com/api/v1/users/current",
    });
  }

  // FetchAuthUser returns an AuthUser instance based on the Wakatime's user API.
  //
  // API reference: https://wakatime.com/developers#users
  override async FetchAuthUser(token: OAuth2Token): Promise<AuthUser> {
    const data = await this.FetchRawUserInfo(token);
    const text = new TextDecoder().decode(data);
    const rawUser = parseRawUser(text);
    const extracted = parseWakatimeUser(text);

    const user = new AuthUser({
      Id: extracted.Data.Id,
      Name: extracted.Data.DisplayName,
      Username: extracted.Data.Username,
      RawUser: rawUser,
      AccessToken: resolveTokenString(token, "accessToken", "access_token"),
      RefreshToken: resolveTokenString(token, "refreshToken", "refresh_token"),
    });

    // Note: we don't check for is_email_public because PocketBase
    // has its own emailVisibility flag which is false by default.
    if (extracted.Data.IsEmailConfirmed) {
      user.Email = extracted.Data.Email;
    }

    if (extracted.Data.IsPhotoPublic) {
      user.AvatarURL = extracted.Data.Photo;
    }

    user.Expiry = ParseDateTime(token.expiry ?? null);

    return user;
  }
}

Providers[NameWakatime] = wrapFactory(() => new Wakatime());

function parseRawUser(raw: string): Record<string, unknown> {
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("invalid wakatime oauth2 user payload");
  }

  return parsed as Record<string, unknown>;
}

function parseWakatimeUser(raw: string): {
  Data: {
    Id: string;
    DisplayName: string;
    Username: string;
    Email: string;
    Photo: string;
    IsPhotoPublic: boolean;
    IsEmailConfirmed: boolean;
  };
} {
  const payload = parseRawUser(raw);
  const data = readObjectField(payload, "data", "invalid wakatime oauth2 payload field data");

  return {
    Data: {
      Id: readStringField(data, "id"),
      DisplayName: readStringField(data, "display_name"),
      Username: readStringField(data, "username"),
      Email: readStringField(data, "email"),
      Photo: readStringField(data, "photo"),
      IsPhotoPublic: readBoolField(data, "photo_public"),
      IsEmailConfirmed: readBoolField(data, "is_email_confirmed"),
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
    throw new Error(`invalid wakatime oauth2 payload field ${key}`);
  }
  return value;
}

function readBoolField(payload: Record<string, unknown>, key: string): boolean {
  const value = payload[key];
  if (value == null) {
    return false;
  }
  if (typeof value !== "boolean") {
    throw new Error(`invalid wakatime oauth2 payload field ${key}`);
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
