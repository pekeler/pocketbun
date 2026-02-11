// Ported from pocketbase/tools/auth/gitea.go

import { ParseDateTime } from "../types/index.ts";
import { AuthUser, type OAuth2Token, Providers, wrapFactory } from "./auth.ts";
import { BaseProvider } from "./base_provider.ts";

// NameGitea is the unique name of the Gitea provider.
export const NameGitea = "gitea";

// Gitea allows authentication via Gitea OAuth2.
export class Gitea extends BaseProvider {
  constructor() {
    super();
    this.setDefaults({
      displayName: "Gitea",
      pkce: true,
      scopes: ["read:user", "user:email"],
      authURL: "https://gitea.com/login/oauth/authorize",
      tokenURL: "https://gitea.com/login/oauth/access_token",
      userInfoURL: "https://gitea.com/api/v1/user",
    });
  }

  // FetchAuthUser returns an AuthUser instance based on Gitea's user api.
  //
  // API reference: https://try.gitea.io/api/swagger#/user/userGetCurrent
  override async FetchAuthUser(token: OAuth2Token): Promise<AuthUser> {
    const data = await this.FetchRawUserInfo(token);
    const text = new TextDecoder().decode(data);
    const rawUser = parseRawUser(text);
    const extracted = parseGiteaUser(text);

    const user = new AuthUser({
      Id: extracted.Id.toString(),
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
  Email: string;
  AvatarURL: string;
  Id: number;
} {
  const payload = parseRawUser(raw);
  return {
    Name: readStringField(payload, "full_name"),
    Username: readStringField(payload, "login"),
    Email: readStringField(payload, "email"),
    AvatarURL: readStringField(payload, "avatar_url"),
    Id: readIntField(payload, "id"),
  };
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

function resolveTokenString(token: OAuth2Token, ...keys: string[]): string {
  for (const key of keys) {
    const value = token[key];
    if (typeof value === "string" && value) {
      return value;
    }
  }

  return "";
}
