// Ported from pocketbase/tools/auth/yandex.go

import { ParseDateTime } from "../types/index.ts";
import { AuthUser, type OAuth2Token, Providers, wrapFactory } from "./auth.ts";
import { BaseProvider } from "./base_provider.ts";

// NameYandex is the unique name of the Yandex provider.
export const NameYandex = "yandex";

// Yandex allows authentication via Yandex OAuth2.
export class Yandex extends BaseProvider {
  constructor() {
    super();
    this.setDefaults({
      displayName: "Yandex",
      pkce: true,
      scopes: ["login:email", "login:avatar", "login:info"],
      authURL: "https://oauth.yandex.ru/authorize",
      tokenURL: "https://oauth.yandex.ru/token",
      userInfoURL: "https://login.yandex.ru/info",
    });
  }

  // FetchAuthUser returns an AuthUser instance based on Yandex's user api.
  //
  // API reference: https://yandex.ru/dev/id/doc/en/user-information#response-format
  override async FetchAuthUser(token: OAuth2Token): Promise<AuthUser> {
    const data = await this.FetchRawUserInfo(token);
    const text = new TextDecoder().decode(data);
    const rawUser = parseRawUser(text);
    const extracted = parseYandexUser(text);

    const user = new AuthUser({
      Id: extracted.Id,
      Name: extracted.Name,
      Username: extracted.Username,
      Email: extracted.Email,
      RawUser: rawUser,
      AccessToken: resolveTokenString(token, "accessToken", "access_token"),
      RefreshToken: resolveTokenString(token, "refreshToken", "refresh_token"),
    });
    user.Expiry = ParseDateTime(token.expiry ?? null);

    if (!extracted.IsAvatarEmpty) {
      user.AvatarURL = `https://avatars.yandex.net/get-yapic/${extracted.AvatarId}/islands-200`;
    }

    return user;
  }
}

Providers[NameYandex] = wrapFactory(() => new Yandex());

function parseRawUser(raw: string): Record<string, unknown> {
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("invalid yandex oauth2 user payload");
  }

  return parsed as Record<string, unknown>;
}

function parseYandexUser(raw: string): {
  Id: string;
  Name: string;
  Username: string;
  Email: string;
  IsAvatarEmpty: boolean;
  AvatarId: string;
} {
  const payload = parseRawUser(raw);
  return {
    Id: readStringField(payload, "id"),
    Name: readStringField(payload, "real_name"),
    Username: readStringField(payload, "login"),
    Email: readStringField(payload, "default_email"),
    IsAvatarEmpty: readBoolField(payload, "is_avatar_empty"),
    AvatarId: readStringField(payload, "default_avatar_id"),
  };
}

function readStringField(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (value == null) {
    return "";
  }
  if (typeof value !== "string") {
    throw new Error(`invalid yandex oauth2 payload field ${key}`);
  }
  return value;
}

function readBoolField(payload: Record<string, unknown>, key: string): boolean {
  const value = payload[key];
  if (value == null) {
    return false;
  }
  if (typeof value !== "boolean") {
    throw new Error(`invalid yandex oauth2 payload field ${key}`);
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
