// Ported from pocketbase/tools/auth/gitea.go

import { ParseDateTime } from "../types/index.ts";
import { AuthUser, type OAuth2Token, Providers, wrapFactory } from "./auth.ts";
import { BaseProvider } from "./base_provider.ts";

// NameGitea is the unique name of the Gitea/Forgejo provider.
export const NameGitea = "gitea";

// Gitea allows authentication via Gitea/Forgejo OAuth2.
export class Gitea extends BaseProvider {
  constructor() {
    super();
    this.setDefaults({
      displayName: "Gitea/Forgejo",
      pkce: true,
      scopes: ["read:user", "user:email"],
      authURL: "https://gitea.com/login/oauth/authorize",
      tokenURL: "https://gitea.com/login/oauth/access_token",
      userInfoURL: "https://gitea.com/api/v1/user",
    });
  }

  // FetchAuthUser returns an AuthUser instance based on Gitea/Forgejo's user api.
  //
  // API reference: https://codeberg.org/api/swagger#/user/userGetCurrent
  override async FetchAuthUser(token: OAuth2Token): Promise<AuthUser> {
    const data = await this.FetchRawUserInfo(token);
    const text = new TextDecoder().decode(data);
    const rawUser = parseRawUser(text);
    const extracted = parseGiteaUser(text);

    if (!extracted.Active) {
      throw new Error("user account is not active");
    }

    const user = new AuthUser({
      Id: extracted.Id.toString(),
      Name: extracted.Name,
      Username: extracted.Username,
      AvatarURL: extracted.AvatarURL,
      RawUser: rawUser,
      AccessToken: resolveTokenString(token, "accessToken", "access_token"),
      RefreshToken: resolveTokenString(token, "refreshToken", "refresh_token"),
    });
    user.Expiry = ParseDateTime(token.expiry ?? null);

    try {
      user.Email = await this.fetchVerifiedPrimaryEmail(token);
    } catch (error) {
      throw new Error(`failed to fetch primary email: ${(error as Error).message}`);
    }

    return user;
  }

  // fetchVerifiedPrimaryEmail sends an API request to retrieve the verified
  // primary email, in case "Keep my email address private" was set.
  //
  // NB! This method can succeed and still return an empty email.
  // Error responses that are result of insufficient scopes permissions are ignored.
  //
  // API reference: https://codeberg.org/api/swagger#/user/userListEmails
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

    // ignore common http errors caused by insufficient scope permissions
    // (the email field is optional, aka. return the auth user without it)
    if (response.status === 401 || response.status === 403 || response.status === 404) {
      return "";
    }

    const emails = parseGiteaEmails(await response.text());
    for (const email of emails) {
      if (email.Verified && email.Primary) {
        return email.Email;
      }
    }

    return "";
  }
}

Providers[NameGitea] = wrapFactory(() => new Gitea());

function parseRawUser(raw: string): Record<string, unknown> {
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("invalid gitea oauth2 user payload");
  }

  return parsed as Record<string, unknown>;
}

function parseGiteaUser(raw: string): {
  Name: string;
  Username: string;
  AvatarURL: string;
  Id: number;
  Active: boolean;
} {
  const payload = parseRawUser(raw);
  return {
    Name: readStringField(payload, "full_name"),
    Username: readStringField(payload, "login"),
    AvatarURL: readStringField(payload, "avatar_url"),
    Id: readIntField(payload, "id"),
    Active: readBoolField(payload, "active"),
  };
}

function parseGiteaEmails(raw: string): Array<{
  Email: string;
  Verified: boolean;
  Primary: boolean;
}> {
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error("invalid gitea oauth2 emails payload");
  }

  return parsed.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error("invalid gitea oauth2 emails payload entry");
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
    throw new Error(`invalid gitea oauth2 payload field ${key}`);
  }
  return value;
}

function readIntField(payload: Record<string, unknown>, key: string): number {
  const value = payload[key];
  if (value == null) {
    return 0;
  }
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value)) {
    throw new Error(`invalid gitea oauth2 payload field ${key}`);
  }
  return value;
}

function readBoolField(payload: Record<string, unknown>, key: string): boolean {
  const value = payload[key];
  if (value == null) {
    return false;
  }
  if (typeof value !== "boolean") {
    throw new Error(`invalid gitea oauth2 payload field ${key}`);
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
