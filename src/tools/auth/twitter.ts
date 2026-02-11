// Ported from pocketbase/tools/auth/twitter.go

import { ParseDateTime } from "../types/index.ts";
import { AuthUser, type OAuth2Token, Providers, wrapFactory } from "./auth.ts";
import { BaseProvider } from "./base_provider.ts";

// NameTwitter is the unique name of the Twitter provider.
export const NameTwitter = "twitter";

// Twitter allows authentication via Twitter OAuth2.
export class Twitter extends BaseProvider {
  constructor() {
    super();
    this.setDefaults({
      displayName: "X/Twitter",
      pkce: true,
      scopes: ["users.read", "users.email", "tweet.read"],
      authURL: "https://x.com/i/oauth2/authorize",
      tokenURL: "https://api.x.com/2/oauth2/token",
      userInfoURL: "https://api.x.com/2/users/me?user.fields=id,name,username,profile_image_url,confirmed_email",
    });
  }

  // FetchAuthUser returns an AuthUser instance based on the Twitter's user api.
  //
  // API reference: https://docs.x.com/x-api/users/user-lookup-me
  override async FetchAuthUser(token: OAuth2Token): Promise<AuthUser> {
    const data = await this.FetchRawUserInfo(token);
    const text = new TextDecoder().decode(data);
    const rawUser = parseRawUser(text);
    const extracted = parseTwitterUser(text);

    const user = new AuthUser({
      Id: extracted.Data.Id,
      Name: extracted.Data.Name,
      Username: extracted.Data.Username,
      Email: extracted.Data.Email,
      AvatarURL: extracted.Data.ProfileImageURL,
      RawUser: rawUser,
      AccessToken: resolveTokenString(token, "accessToken", "access_token"),
      RefreshToken: resolveTokenString(token, "refreshToken", "refresh_token"),
    });
    user.Expiry = ParseDateTime(token.expiry ?? null);

    return user;
  }
}

Providers[NameTwitter] = wrapFactory(() => new Twitter());

function parseRawUser(raw: string): Record<string, unknown> {
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("invalid twitter oauth2 user payload");
  }

  return parsed as Record<string, unknown>;
}

function parseTwitterUser(raw: string): {
  Data: {
    Id: string;
    Name: string;
    Username: string;
    Email: string;
    ProfileImageURL: string;
  };
} {
  const payload = parseRawUser(raw);
  const data = readObjectField(payload, "data", "invalid twitter oauth2 payload field data");

  return {
    Data: {
      Id: readStringField(data, "id"),
      Name: readStringField(data, "name"),
      Username: readStringField(data, "username"),
      Email: readStringField(data, "confirmed_email"),
      ProfileImageURL: readStringField(data, "profile_image_url"),
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
    throw new Error(`invalid twitter oauth2 payload field ${key}`);
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
