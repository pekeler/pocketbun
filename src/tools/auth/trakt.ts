// Ported from pocketbase/tools/auth/trakt.go

import { ParseDateTime } from "../types/index.ts";
import { AuthUser, type OAuth2Token, Providers, wrapFactory } from "./auth.ts";
import { BaseProvider } from "./base_provider.ts";

// NameTrakt is the unique name of the Trakt provider.
export const NameTrakt = "trakt";

// Trakt allows authentication via Trakt OAuth2.
export class Trakt extends BaseProvider {
  constructor() {
    super();
    this.setDefaults({
      displayName: "Trakt",
      pkce: true,
      authURL: "https://trakt.tv/oauth/authorize",
      tokenURL: "https://api.trakt.tv/oauth/token",
      userInfoURL: "https://api.trakt.tv/users/settings",
    });
  }

  // FetchAuthUser returns an AuthUser instance based on Trakt's user settings API.
  // API reference: https://trakt.docs.apiary.io/#reference/users/settings/retrieve-settings
  override async FetchAuthUser(token: OAuth2Token): Promise<AuthUser> {
    const data = await this.FetchRawUserInfo(token);
    const text = new TextDecoder().decode(data);
    const rawUser = parseRawUser(text);
    const extracted = parseTraktUser(text);

    const user = new AuthUser({
      Id: extracted.User.Ids.UUID,
      Username: extracted.User.Username,
      Name: extracted.User.Name,
      AvatarURL: extracted.User.Images.Avatar.Full,
      RawUser: rawUser,
      AccessToken: resolveTokenString(token, "accessToken", "access_token"),
      RefreshToken: resolveTokenString(token, "refreshToken", "refresh_token"),
    });
    user.Expiry = ParseDateTime(token.expiry ?? null);

    return user;
  }

  // FetchRawUserInfo implements Provider.FetchRawUserInfo interface method.
  //
  // This differs from BaseProvider because Trakt requires a number of
  // mandatory headers for all requests
  // (https://trakt.docs.apiary.io/#introduction/required-headers).
  override async FetchRawUserInfo(token: OAuth2Token): Promise<Uint8Array> {
    const userInfoURL = this.UserInfoURL();
    if (!userInfoURL) {
      throw new Error("missing OAuth2 user info url");
    }

    const headers = new Headers();
    headers.set("Content-type", "application/json");
    headers.set("trakt-api-key", this.ClientId());
    headers.set("trakt-api-version", "2");

    const accessToken = resolveTokenString(token, "accessToken", "access_token");
    if (accessToken) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }

    const response = await this.Client(token)(userInfoURL, {
      method: "GET",
      headers,
    });

    const data = new Uint8Array(await response.arrayBuffer());
    if (response.status >= 400) {
      const decoded = new TextDecoder().decode(data);
      throw new Error(`failed to fetch OAuth2 user profile via ${userInfoURL} (${response.status}):\\n${decoded}`);
    }

    return data;
  }
}

Providers[NameTrakt] = wrapFactory(() => new Trakt());

function parseRawUser(raw: string): Record<string, unknown> {
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("invalid trakt oauth2 user payload");
  }

  return parsed as Record<string, unknown>;
}

function parseTraktUser(raw: string): {
  User: {
    Username: string;
    Name: string;
    Ids: {
      Slug: string;
      UUID: string;
    };
    Images: {
      Avatar: {
        Full: string;
      };
    };
  };
} {
  const payload = parseRawUser(raw);
  const user = readObjectField(payload, "user", "invalid trakt oauth2 payload field user");
  const ids = readObjectField(user, "ids", "invalid trakt oauth2 payload field user.ids");
  const images = readObjectField(user, "images", "invalid trakt oauth2 payload field user.images");
  const avatar = readObjectField(images, "avatar", "invalid trakt oauth2 payload field user.images.avatar");

  return {
    User: {
      Username: readStringField(user, "username"),
      Name: readStringField(user, "name"),
      Ids: {
        Slug: readStringField(ids, "slug"),
        UUID: readStringField(ids, "uuid"),
      },
      Images: {
        Avatar: {
          Full: readStringField(avatar, "full"),
        },
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
    throw new Error(`invalid trakt oauth2 payload field ${key}`);
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
