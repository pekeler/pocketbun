// Ported from pocketbase/tools/auth/gitee.go

import { ParseDateTime } from "../types/index.ts";
import { AuthUser, type OAuth2Token, Providers, wrapFactory } from "./auth.ts";
import { BaseProvider } from "./base_provider.ts";

// NameGitee is the unique name of the Gitee provider.
export const NameGitee = "gitee";

// Gitee allows authentication via Gitee OAuth2.
export class Gitee extends BaseProvider {
  constructor() {
    super();
    this.setDefaults({
      displayName: "Gitee",
      pkce: true,
      scopes: ["user_info", "emails"],
      authURL: "https://gitee.com/oauth/authorize",
      tokenURL: "https://gitee.com/oauth/token",
      userInfoURL: "https://gitee.com/api/v5/user",
    });
  }

  // FetchAuthUser returns an AuthUser instance based the Gitee's user api.
  //
  // API reference: https://gitee.com/api/v5/swagger#/getV5User
  override async FetchAuthUser(token: OAuth2Token): Promise<AuthUser> {
    const data = await this.FetchRawUserInfo(token);
    const text = new TextDecoder().decode(data);
    const rawUser = parseRawUser(text);
    const extracted = parseGiteeUser(text);

    const user = new AuthUser({
      Id: extracted.Id.toString(),
      Name: extracted.Name,
      Username: extracted.Login,
      AvatarURL: extracted.AvatarURL,
      RawUser: rawUser,
      AccessToken: resolveTokenString(token, "accessToken", "access_token"),
      RefreshToken: resolveTokenString(token, "refreshToken", "refresh_token"),
    });
    user.Expiry = ParseDateTime(token.expiry ?? null);

    if (extracted.Email && isEmail(extracted.Email)) {
      // Valid public primary email.
      user.Email = extracted.Email;
    } else {
      // Send an additional optional request to retrieve the email.
      user.Email = await this.fetchPrimaryEmail(token);
    }

    return user;
  }

  // fetchPrimaryEmail sends an API request to retrieve the verified primary email,
  // in case the user hasn't set "Public email address" or has unchecked
  // the "Access your emails data" permission during authentication.
  //
  // NB! This method can succeed and still return an empty email.
  // Error responses that are result of insufficient scopes permissions are ignored.
  //
  // API reference: https://gitee.com/api/v5/swagger#/getV5Emails
  private async fetchPrimaryEmail(token: OAuth2Token): Promise<string> {
    const response = await this.Client(token)("https://gitee.com/api/v5/emails");

    // Ignore common HTTP errors caused by insufficient scope permissions.
    if (response.status === 401 || response.status === 403 || response.status === 404) {
      return "";
    }

    const content = await response.text();
    const emails = parseGiteeEmails(content);
    if (!emails) {
      // Ignore unmarshal errors, eg. when "Keep my email address private" is enabled.
      return "";
    }

    // Extract the first verified primary email.
    for (const email of emails) {
      if (email.State !== "confirmed") {
        continue;
      }

      for (const scope of email.Scope) {
        if (scope === "primary" && isEmail(email.Email)) {
          return email.Email;
        }
      }
    }

    return "";
  }
}

Providers[NameGitee] = wrapFactory(() => new Gitee());

function parseRawUser(raw: string): Record<string, unknown> {
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("invalid gitee oauth2 user payload");
  }

  return parsed as Record<string, unknown>;
}

function parseGiteeUser(raw: string): {
  Login: string;
  Name: string;
  Email: string;
  AvatarURL: string;
  Id: number;
} {
  const payload = parseRawUser(raw);
  return {
    Login: readStringField(payload, "login"),
    Name: readStringField(payload, "name"),
    Email: readStringField(payload, "email"),
    AvatarURL: readStringField(payload, "avatar_url"),
    Id: readIntField(payload, "id"),
  };
}

function parseGiteeEmails(raw: string): Array<{
  Email: string;
  State: string;
  Scope: string[];
}> | null {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error("invalid gitee oauth2 emails payload");
    }

    return parsed.map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        throw new Error("invalid gitee oauth2 emails payload entry");
      }

      const row = entry as Record<string, unknown>;
      return {
        Email: readStringField(row, "email"),
        State: readStringField(row, "state"),
        Scope: readStringArrayField(row, "scope"),
      };
    });
  } catch {
    return null;
  }
}

function readStringField(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (value == null) {
    return "";
  }
  if (typeof value !== "string") {
    throw new Error(`invalid gitee oauth2 payload field ${key}`);
  }
  return value;
}

function readIntField(payload: Record<string, unknown>, key: string): number {
  const value = payload[key];
  if (value == null) {
    return 0;
  }
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value)) {
    throw new Error(`invalid gitee oauth2 payload field ${key}`);
  }
  return value;
}

function readStringArrayField(payload: Record<string, unknown>, key: string): string[] {
  const value = payload[key];
  if (value == null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error(`invalid gitee oauth2 payload field ${key}`);
  }

  const result: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") {
      throw new Error(`invalid gitee oauth2 payload field ${key}`);
    }
    result.push(entry);
  }

  return result;
}

function isEmail(value: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
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
