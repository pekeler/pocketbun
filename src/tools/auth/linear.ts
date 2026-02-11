// Ported from pocketbase/tools/auth/linear.go

import { ParseDateTime } from "../types/index.ts";
import { AuthUser, type OAuth2Token, Providers, wrapFactory } from "./auth.ts";
import { BaseProvider } from "./base_provider.ts";

// NameLinear is the unique name of the Linear provider.
export const NameLinear = "linear";

// Linear allows authentication via Linear OAuth2.
export class Linear extends BaseProvider {
  constructor() {
    super();
    this.setDefaults({
      displayName: "Linear",
      pkce: false,
      scopes: ["read"],
      authURL: "https://linear.app/oauth/authorize",
      tokenURL: "https://api.linear.app/oauth/token",
      userInfoURL: "https://api.linear.app/graphql",
    });
  }

  // FetchAuthUser returns an AuthUser instance based on the Linear's user api.
  //
  // API reference: https://developers.linear.app/docs/graphql/working-with-the-graphql-api#authentication
  override async FetchAuthUser(token: OAuth2Token): Promise<AuthUser> {
    const data = await this.FetchRawUserInfo(token);
    const text = new TextDecoder().decode(data);
    const rawUser = parseRawUser(text);
    const extracted = parseLinearUser(text);

    if (!extracted.Data.Viewer.Active) {
      throw new Error("the Linear user account is not active");
    }

    const user = new AuthUser({
      Id: extracted.Data.Viewer.Id,
      Name: extracted.Data.Viewer.Name,
      Username: extracted.Data.Viewer.DisplayName,
      Email: extracted.Data.Viewer.Email,
      AvatarURL: extracted.Data.Viewer.AvatarURL,
      RawUser: rawUser,
      AccessToken: resolveTokenString(token, "accessToken", "access_token"),
      RefreshToken: resolveTokenString(token, "refreshToken", "refresh_token"),
    });
    user.Expiry = ParseDateTime(token.expiry ?? null);

    return user;
  }

  // FetchRawUserInfo implements Provider.FetchRawUserInfo interface method.
  //
  // Linear doesn't have a UserInfo endpoint and information on the user
  // is retrieved using their GraphQL API
  // (https://developers.linear.app/docs/graphql/working-with-the-graphql-api#queries-and-mutations).
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

    const query = '{"query": "query Me { viewer { id displayName name email avatarUrl active } }"}';

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

Providers[NameLinear] = wrapFactory(() => new Linear());

function parseRawUser(raw: string): Record<string, unknown> {
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("invalid linear oauth2 user payload");
  }

  return parsed as Record<string, unknown>;
}

function parseLinearUser(raw: string): {
  Data: {
    Viewer: {
      Id: string;
      DisplayName: string;
      Name: string;
      Email: string;
      AvatarURL: string;
      Active: boolean;
    };
  };
} {
  const payload = parseRawUser(raw);
  const data = readObjectField(payload, "data", "invalid linear oauth2 payload field data");
  const viewer = readObjectField(data, "viewer", "invalid linear oauth2 payload field data.viewer");

  return {
    Data: {
      Viewer: {
        Id: readStringField(viewer, "id"),
        DisplayName: readStringField(viewer, "displayName"),
        Name: readStringField(viewer, "name"),
        Email: readStringField(viewer, "email"),
        AvatarURL: readStringField(viewer, "avatarUrl"),
        Active: readBoolField(viewer, "active"),
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
    throw new Error(`invalid linear oauth2 payload field ${key}`);
  }
  return value;
}

function readBoolField(payload: Record<string, unknown>, key: string): boolean {
  const value = payload[key];
  if (value == null) {
    return false;
  }
  if (typeof value !== "boolean") {
    throw new Error(`invalid linear oauth2 payload field ${key}`);
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
