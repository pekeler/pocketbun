// Ported from pocketbase/tools/auth/gitlab.go

import { ParseDateTime } from "../types/index.ts";
import { AuthUser, type OAuth2Token, Providers, wrapFactory } from "./auth.ts";
import { BaseProvider } from "./base_provider.ts";

// NameGitlab is the unique name of the Gitlab provider.
export const NameGitlab = "gitlab";

// Gitlab allows authentication via Gitlab OAuth2.
export class Gitlab extends BaseProvider {
  constructor() {
    super();
    this.setDefaults({
      displayName: "GitLab",
      pkce: true,
      scopes: ["read_user"],
      authURL: "https://gitlab.com/oauth/authorize",
      tokenURL: "https://gitlab.com/oauth/token",
      userInfoURL: "https://gitlab.com/api/v4/user",
    });
  }

  // FetchAuthUser returns an AuthUser instance based the Gitlab's user api.
  //
  // API reference: https://docs.gitlab.com/ee/api/users.html#for-admin
  override async FetchAuthUser(token: OAuth2Token): Promise<AuthUser> {
    const data = await this.FetchRawUserInfo(token);
    const text = new TextDecoder().decode(data);
    const rawUser = parseRawUser(text);
    const extracted = parseGitlabUser(text);

    const user = new AuthUser({
      Id: String(extracted.Id),
      Name: extracted.Name,
      Username: extracted.Username,
      Email: extracted.Email,
      AvatarURL: extracted.AvatarURL,
      RawUser: rawUser,
      AccessToken: resolveTokenString(token, "accessToken", "access_token"),
      RefreshToken: resolveTokenString(token, "refreshToken", "refresh_token"),
    });
    user.Expiry = ParseDateTime(token.expiry ?? null);

    return user;
  }
}

Providers[NameGitlab] = wrapFactory(() => new Gitlab());

function parseRawUser(raw: string): Record<string, unknown> {
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("invalid gitlab oauth2 user payload");
  }

  return parsed as Record<string, unknown>;
}

function parseGitlabUser(raw: string): {
  Name: string;
  Username: string;
  Email: string;
  AvatarURL: string;
  Id: number;
} {
  const payload = parseRawUser(raw);
  return {
    Name: readStringField(payload, "name"),
    Username: readStringField(payload, "username"),
    Email: readStringField(payload, "email"),
    AvatarURL: readStringField(payload, "avatar_url"),
    Id: readInt64Field(payload, "id"),
  };
}

function readStringField(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (value == null) {
    return "";
  }
  if (typeof value !== "string") {
    throw new Error(`invalid gitlab oauth2 payload field ${key}`);
  }
  return value;
}

function readInt64Field(payload: Record<string, unknown>, key: string): number {
  const value = payload[key];
  if (value == null) {
    return 0;
  }
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new Error(`invalid gitlab oauth2 payload field ${key}`);
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
