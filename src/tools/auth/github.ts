// Ported from pocketbase/tools/auth/github.go

import { ParseDateTime } from "../types/index.ts";
import { AuthUser, type OAuth2Token, Providers, wrapFactory } from "./auth.ts";
import { BaseProvider } from "./base_provider.ts";

// NameGithub is the unique name of the Github provider.
export const NameGithub = "github";

// Github allows authentication via Github OAuth2.
export class Github extends BaseProvider {
  constructor() {
    super();
    this.setDefaults({
      displayName: "GitHub",
      pkce: true,
      scopes: ["read:user", "user:email"],
      authURL: "https://github.com/login/oauth/authorize",
      tokenURL: "https://github.com/login/oauth/access_token",
      userInfoURL: "https://api.github.com/user",
    });
  }

  // FetchAuthUser returns an AuthUser instance based the Github's user api.
  //
  // API reference: https://docs.github.com/en/rest/users/users?apiVersion=2026-03-10#get-the-authenticated-user
  override async FetchAuthUser(token: OAuth2Token): Promise<AuthUser> {
    const data = await this.FetchRawUserInfo(token);
    const text = new TextDecoder().decode(data);
    const rawUser = parseRawUser(text);
    const extracted = parseGithubUser(text);

    const user = new AuthUser({
      Id: String(extracted.Id),
      Name: extracted.Name,
      Username: extracted.Login,
      AvatarURL: extracted.AvatarURL,
      RawUser: rawUser,
      AccessToken: resolveTokenString(token, "accessToken", "access_token"),
      RefreshToken: resolveTokenString(token, "refreshToken", "refresh_token"),
    });
    user.Expiry = ParseDateTime(token.expiry ?? null);

    // always send a primary email request even though the email is
    // returned in the userinfo endpoint since the API may change and
    // enterprise setups may have configuration that could allow unverified emails
    user.Email = await this.fetchVerifiedPrimaryEmail(token);

    return user;
  }

  // fetchVerifiedPrimaryEmail sends an API request to retrieve the verified
  // primary email, in case "Keep my email address private" was set.
  //
  // NB! This method can succeed and still return an empty email.
  // Error responses that are result of insufficient scopes permissions are ignored.
  //
  // API reference: https://docs.github.com/en/rest/users/emails?apiVersion=2022-11-28#list-email-addresses-for-the-authenticated-user
  private async fetchVerifiedPrimaryEmail(token: OAuth2Token): Promise<string> {
    const userInfoURL = this.UserInfoURL();
    if (!userInfoURL) {
      return "";
    }

    const headers = new Headers();
    const accessToken = resolveTokenString(token, "accessToken", "access_token");
    if (accessToken) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }

    const response = await this.Client(token)(`${userInfoURL}/emails`, {
      headers,
    });

    // Ignore common HTTP errors caused by insufficient scope permissions
    // (the email field is optional, aka. return the auth user without it).
    if (response.status === 401 || response.status === 403 || response.status === 404) {
      return "";
    }

    const emails = parseGithubEmails(await response.text());

    // Extract the verified primary email.
    for (const email of emails) {
      if (email.Verified && email.Primary) {
        return email.Email;
      }
    }

    return "";
  }
}

Providers[NameGithub] = wrapFactory(() => new Github());

function parseRawUser(raw: string): Record<string, unknown> {
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("invalid github oauth2 user payload");
  }

  return parsed as Record<string, unknown>;
}

function parseGithubUser(raw: string): {
  Login: string;
  Name: string;
  AvatarURL: string;
  Id: number;
} {
  const payload = parseRawUser(raw);
  return {
    Login: readStringField(payload, "login"),
    Name: readStringField(payload, "name"),
    AvatarURL: readStringField(payload, "avatar_url"),
    Id: readInt64Field(payload, "id"),
  };
}

function parseGithubEmails(raw: string): Array<{
  Email: string;
  Verified: boolean;
  Primary: boolean;
}> {
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error("invalid github oauth2 emails payload");
  }

  return parsed.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error("invalid github oauth2 emails payload entry");
    }

    const row = entry as Record<string, unknown>;
    return {
      Email: readStringField(row, "email"),
      Verified: readBoolField(row, "verified"),
      Primary: readBoolField(row, "primary"),
    };
  });
}

function readStringField(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (value == null) {
    return "";
  }
  if (typeof value !== "string") {
    throw new Error(`invalid github oauth2 payload field ${key}`);
  }
  return value;
}

function readBoolField(payload: Record<string, unknown>, key: string): boolean {
  const value = payload[key];
  if (value == null) {
    return false;
  }
  if (typeof value !== "boolean") {
    throw new Error(`invalid github oauth2 payload field ${key}`);
  }
  return value;
}

function readInt64Field(payload: Record<string, unknown>, key: string): number {
  const value = payload[key];
  if (value == null) {
    return 0;
  }
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new Error(`invalid github oauth2 payload field ${key}`);
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
