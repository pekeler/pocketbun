// Ported from pocketbase/tools/auth/instagram.go

import { ParseDateTime } from "../types/index.ts";
import { AuthUser, type OAuth2Token, Providers, wrapFactory } from "./auth.ts";
import { BaseProvider } from "./base_provider.ts";

// NameInstagram is the unique name of the Instagram provider.
export const NameInstagram = "instagram2";

// Instagram allows authentication via Instagram Login OAuth2.
export class Instagram extends BaseProvider {
  constructor() {
    super();
    this.setDefaults({
      displayName: "Instagram",
      pkce: true,
      scopes: ["instagram_business_basic"],
      authURL: "https://www.instagram.com/oauth/authorize",
      tokenURL: "https://api.instagram.com/oauth/access_token",
      userInfoURL:
        "https://graph.instagram.com/me?fields=id,username,account_type,user_id,name,profile_picture_url,followers_count,follows_count,media_count",
    });
  }

  // FetchAuthUser returns an AuthUser instance based on the Instagram Login user api response.
  //
  // API reference: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/get-started#fields
  override async FetchAuthUser(token: OAuth2Token): Promise<AuthUser> {
    const data = await this.FetchRawUserInfo(token);
    const text = new TextDecoder().decode(data);
    const rawUser = parseRawUser(text);

    // Include list of granted permissions to RawUser payload.
    if (!Object.prototype.hasOwnProperty.call(rawUser, "permissions")) {
      const permissions = token.permissions;
      if (permissions != null) {
        rawUser.permissions = permissions;
      }
    }

    const extracted = parseInstagramUser(text);

    const user = new AuthUser({
      Id: extracted.Id,
      Username: extracted.Username,
      Name: extracted.Name,
      AvatarURL: extracted.AvatarURL,
      RawUser: rawUser,
      AccessToken: resolveTokenString(token, "accessToken", "access_token"),
      RefreshToken: resolveTokenString(token, "refreshToken", "refresh_token"),
    });
    user.Expiry = ParseDateTime(token.expiry ?? null);

    return user;
  }
}

Providers[NameInstagram] = wrapFactory(() => new Instagram());

function parseRawUser(raw: string): Record<string, unknown> {
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("invalid instagram oauth2 user payload");
  }

  return parsed as Record<string, unknown>;
}

function parseInstagramUser(raw: string): {
  Id: string;
  Name: string;
  Username: string;
  AvatarURL: string;
} {
  const payload = parseRawUser(raw);
  return {
    Id: readStringField(payload, "user_id"),
    Name: readStringField(payload, "name"),
    Username: readStringField(payload, "username"),
    AvatarURL: readStringField(payload, "profile_picture_url"),
  };
}

function readStringField(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (value == null) {
    return "";
  }
  if (typeof value !== "string") {
    throw new Error(`invalid instagram oauth2 payload field ${key}`);
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
