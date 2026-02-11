// Ported from pocketbase/tools/auth/google.go

import { ParseDateTime } from "../types/index.ts";
import { AuthUser, type OAuth2Token, Providers, wrapFactory } from "./auth.ts";
import { BaseProvider } from "./base_provider.ts";

// NameGoogle is the unique name of the Google provider.
export const NameGoogle = "google";

// Google allows authentication via Google OAuth2.
export class Google extends BaseProvider {
  constructor() {
    super();
    this.setDefaults({
      displayName: "Google",
      pkce: true,
      scopes: ["https://www.googleapis.com/auth/userinfo.profile", "https://www.googleapis.com/auth/userinfo.email"],
      authURL: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenURL: "https://oauth2.googleapis.com/token",
      userInfoURL: "https://www.googleapis.com/oauth2/v3/userinfo",
    });
  }

  // FetchAuthUser returns an AuthUser instance based the Google's user api.
  override async FetchAuthUser(token: OAuth2Token): Promise<AuthUser> {
    const data = await this.FetchRawUserInfo(token);
    const text = new TextDecoder().decode(data);
    const rawUser = parseRawUser(text);
    const extracted = parseGoogleUser(text);

    const user = new AuthUser({
      Id: extracted.Id,
      Name: extracted.Name,
      AvatarURL: extracted.Picture,
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

Providers[NameGoogle] = wrapFactory(() => new Google());

function parseRawUser(raw: string): Record<string, unknown> {
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("invalid google oauth2 user payload");
  }

  return parsed as Record<string, unknown>;
}

function parseGoogleUser(raw: string): {
  Id: string;
  Name: string;
  Picture: string;
  Email: string;
  EmailVerified: boolean;
} {
  const payload = parseRawUser(raw);
  return {
    Id: readStringField(payload, "sub"),
    Name: readStringField(payload, "name"),
    Picture: readStringField(payload, "picture"),
    Email: readStringField(payload, "email"),
    EmailVerified: readBoolField(payload, "email_verified"),
  };
}

function readStringField(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (value == null) {
    return "";
  }
  if (typeof value !== "string") {
    throw new Error(`invalid google oauth2 user payload field ${key}`);
  }
  return value;
}

function readBoolField(payload: Record<string, unknown>, key: string): boolean {
  const value = payload[key];
  if (value == null) {
    return false;
  }
  if (typeof value !== "boolean") {
    throw new Error(`invalid google oauth2 user payload field ${key}`);
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
