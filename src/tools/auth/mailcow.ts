// Ported from pocketbase/tools/auth/mailcow.go

import { ParseDateTime } from "../types/index.ts";
import { AuthUser, type OAuth2Token, Providers, wrapFactory } from "./auth.ts";
import { BaseProvider } from "./base_provider.ts";

// NameMailcow is the unique name of the mailcow provider.
export const NameMailcow = "mailcow";

// Mailcow allows authentication via mailcow OAuth2.
export class Mailcow extends BaseProvider {
  constructor() {
    super();
    this.setDefaults({
      displayName: "mailcow",
      pkce: true,
      scopes: ["profile"],
    });
  }

  // FetchAuthUser returns an AuthUser instance based on mailcow's user api.
  //
  // API reference: https://github.com/mailcow/mailcow-dockerized/blob/master/data/web/oauth/profile.php
  override async FetchAuthUser(token: OAuth2Token): Promise<AuthUser> {
    const data = await this.FetchRawUserInfo(token);
    const text = new TextDecoder().decode(data);
    const rawUser = parseRawUser(text);
    const extracted = parseMailcowUser(text);

    if (extracted.Active !== 1) {
      throw new Error("the mailcow user is not active");
    }

    const user = new AuthUser({
      Id: extracted.Id,
      Name: extracted.FullName,
      Username: extracted.Username,
      Email: extracted.Email,
      RawUser: rawUser,
      AccessToken: resolveTokenString(token, "accessToken", "access_token"),
      RefreshToken: resolveTokenString(token, "refreshToken", "refresh_token"),
    });
    user.Expiry = ParseDateTime(token.expiry ?? null);

    // Mailcow usernames are usually email addresses, so keep only the local part.
    if (user.Username.includes("@")) {
      user.Username = user.Username.split("@")[0] ?? user.Username;
    }

    return user;
  }
}

Providers[NameMailcow] = wrapFactory(() => new Mailcow());

function parseRawUser(raw: string): Record<string, unknown> {
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("invalid mailcow oauth2 user payload");
  }

  return parsed as Record<string, unknown>;
}

function parseMailcowUser(raw: string): {
  Id: string;
  Username: string;
  Email: string;
  FullName: string;
  Active: number;
} {
  const payload = parseRawUser(raw);
  return {
    Id: readStringField(payload, "id"),
    Username: readStringField(payload, "username"),
    Email: readStringField(payload, "email"),
    FullName: readStringField(payload, "full_name"),
    Active: readIntField(payload, "active"),
  };
}

function readStringField(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (value == null) {
    return "";
  }
  if (typeof value !== "string") {
    throw new Error(`invalid mailcow oauth2 payload field ${key}`);
  }
  return value;
}

function readIntField(payload: Record<string, unknown>, key: string): number {
  const value = payload[key];
  if (value == null) {
    return 0;
  }
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value)) {
    throw new Error(`invalid mailcow oauth2 payload field ${key}`);
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
