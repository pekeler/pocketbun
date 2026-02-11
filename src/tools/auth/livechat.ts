// Ported from pocketbase/tools/auth/livechat.go

import { ParseDateTime } from "../types/index.ts";
import { AuthUser, type OAuth2Token, Providers, wrapFactory } from "./auth.ts";
import { BaseProvider } from "./base_provider.ts";

// NameLivechat is the unique name of the Livechat provider.
export const NameLivechat = "livechat";

// Livechat allows authentication via Livechat OAuth2.
export class Livechat extends BaseProvider {
  constructor() {
    super();
    this.setDefaults({
      displayName: "LiveChat",
      pkce: true,
      scopes: [],
      authURL: "https://accounts.livechat.com/",
      tokenURL: "https://accounts.livechat.com/token",
      userInfoURL: "https://accounts.livechat.com/v2/accounts/me",
    });
  }

  // FetchAuthUser returns an AuthUser based on the Livechat accounts API.
  //
  // API reference: https://developers.livechat.com/docs/authorization
  override async FetchAuthUser(token: OAuth2Token): Promise<AuthUser> {
    const data = await this.FetchRawUserInfo(token);
    const text = new TextDecoder().decode(data);
    const rawUser = parseRawUser(text);
    const extracted = parseLivechatUser(text);

    const user = new AuthUser({
      Id: extracted.Id,
      Name: extracted.Name,
      AvatarURL: extracted.AvatarURL,
      RawUser: rawUser,
      AccessToken: resolveTokenString(token, "accessToken", "access_token"),
      RefreshToken: resolveTokenString(token, "refreshToken", "refresh_token"),
    });
    user.Expiry = ParseDateTime(token.expiry ?? null);

    if (extracted.EmailVerified) {
      user.Email = extracted.Email;
    }

    return user;
  }
}

Providers[NameLivechat] = wrapFactory(() => new Livechat());

function parseRawUser(raw: string): Record<string, unknown> {
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("invalid livechat oauth2 user payload");
  }

  return parsed as Record<string, unknown>;
}

function parseLivechatUser(raw: string): {
  Id: string;
  Name: string;
  Email: string;
  EmailVerified: boolean;
  AvatarURL: string;
} {
  const payload = parseRawUser(raw);
  return {
    Id: readStringField(payload, "account_id"),
    Name: readStringField(payload, "name"),
    Email: readStringField(payload, "email"),
    EmailVerified: readBoolField(payload, "email_verified"),
    AvatarURL: readStringField(payload, "avatar_url"),
  };
}

function readStringField(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (value == null) {
    return "";
  }
  if (typeof value !== "string") {
    throw new Error(`invalid livechat oauth2 payload field ${key}`);
  }
  return value;
}

function readBoolField(payload: Record<string, unknown>, key: string): boolean {
  const value = payload[key];
  if (value == null) {
    return false;
  }
  if (typeof value !== "boolean") {
    throw new Error(`invalid livechat oauth2 payload field ${key}`);
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
