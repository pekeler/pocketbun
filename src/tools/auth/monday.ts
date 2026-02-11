// Ported from pocketbase/tools/auth/monday.go

import { ParseDateTime } from "../types/index.ts";
import { AuthUser, type OAuth2Token, Providers, wrapFactory } from "./auth.ts";
import { BaseProvider } from "./base_provider.ts";

// NameMonday is the unique name of the Monday provider.
export const NameMonday = "monday";

// Monday is an auth provider for monday.com.
export class Monday extends BaseProvider {
  constructor() {
    super();
    this.setDefaults({
      displayName: "monday.com",
      pkce: true,
      scopes: ["me:read"],
      authURL: "https://auth.monday.com/oauth2/authorize",
      tokenURL: "https://auth.monday.com/oauth2/token",
      userInfoURL: "https://api.monday.com/v2",
    });
  }

  // FetchAuthUser returns an AuthUser instance based on the Monday's user api.
  //
  // API reference: https://developer.monday.com/api-reference/reference/me
  override async FetchAuthUser(token: OAuth2Token): Promise<AuthUser> {
    const data = await this.FetchRawUserInfo(token);
    const text = new TextDecoder().decode(data);
    const rawUser = parseRawUser(text);
    const extracted = parseMondayUser(text);

    if (!extracted.Data.Me.Enabled) {
      throw new Error("the monday.com user account is not enabled");
    }

    const user = new AuthUser({
      Id: extracted.Data.Me.Id,
      Name: extracted.Data.Me.Name,
      AvatarURL: extracted.Data.Me.Avatar,
      RawUser: rawUser,
      AccessToken: resolveTokenString(token, "accessToken", "access_token"),
      RefreshToken: resolveTokenString(token, "refreshToken", "refresh_token"),
    });
    user.Expiry = ParseDateTime(token.expiry ?? null);

    if (extracted.Data.Me.IsVerified) {
      user.Email = extracted.Data.Me.Email;
    }

    return user;
  }

  // FetchRawUserInfo implements Provider.FetchRawUserInfo interface.
  //
  // monday.com doesn't have a UserInfo endpoint and information on the user
  // is retrieved using their GraphQL API (https://developer.monday.com/api-reference/reference/me#queries)
  override async FetchRawUserInfo(token: OAuth2Token): Promise<Uint8Array> {
    const userInfoURL = this.UserInfoURL();
    if (!userInfoURL) {
      throw new Error("missing OAuth2 user info url");
    }

    const headers = new Headers();
    headers.set("Content-Type", "application/json");

    const accessToken = resolveTokenString(token, "accessToken", "access_token");
    if (accessToken) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }

    const query = '{"query": "query { me { id enabled name email is_verified photo_small }}"}';

    const response = await this.Client(token)(userInfoURL, {
      method: "POST",
      headers,
      body: query,
    });

    const data = new Uint8Array(await response.arrayBuffer());
    if (response.status >= 400) {
      const decoded = new TextDecoder().decode(data);
      throw new Error(`failed to fetch OAuth2 user profile via ${userInfoURL} (${response.status}):\\n${decoded}`);
    }

    return data;
  }
}

Providers[NameMonday] = wrapFactory(() => new Monday());

function parseRawUser(raw: string): Record<string, unknown> {
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("invalid monday oauth2 user payload");
  }

  return parsed as Record<string, unknown>;
}

function parseMondayUser(raw: string): {
  Data: {
    Me: {
      Id: string;
      Enabled: boolean;
      Name: string;
      Email: string;
      IsVerified: boolean;
      Avatar: string;
    };
  };
} {
  const payload = parseRawUser(raw);
  const data = readObjectField(payload, "data", "invalid monday oauth2 payload field data");
  const me = readObjectField(data, "me", "invalid monday oauth2 payload field data.me");

  return {
    Data: {
      Me: {
        Id: readStringField(me, "id"),
        Enabled: readBoolField(me, "enabled"),
        Name: readStringField(me, "name"),
        Email: readStringField(me, "email"),
        IsVerified: readBoolField(me, "is_verified"),
        Avatar: readStringField(me, "photo_small"),
      },
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
    throw new Error(`invalid monday oauth2 payload field ${key}`);
  }
  return value;
}

function readBoolField(payload: Record<string, unknown>, key: string): boolean {
  const value = payload[key];
  if (value == null) {
    return false;
  }
  if (typeof value !== "boolean") {
    throw new Error(`invalid monday oauth2 payload field ${key}`);
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
