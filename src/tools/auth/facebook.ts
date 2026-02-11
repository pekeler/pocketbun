// Ported from pocketbase/tools/auth/facebook.go

import { ParseDateTime } from "../types/index.ts";
import { AuthUser, type OAuth2Token, Providers, wrapFactory } from "./auth.ts";
import { BaseProvider } from "./base_provider.ts";

// NameFacebook is the unique name of the Facebook provider.
export const NameFacebook = "facebook";

// Facebook allows authentication via Facebook OAuth2.
export class Facebook extends BaseProvider {
  constructor() {
    super();
    this.setDefaults({
      displayName: "Facebook",
      pkce: true,
      scopes: ["email"],
      authURL: "https://www.facebook.com/dialog/oauth",
      tokenURL: "https://graph.facebook.com/oauth/access_token",
      userInfoURL: "https://graph.facebook.com/me?fields=name,email,picture.type(large)",
    });
  }

  // FetchAuthUser returns an AuthUser instance based on the Facebook's user api.
  //
  // API reference: https://developers.facebook.com/docs/graph-api/reference/user/
  override async FetchAuthUser(token: OAuth2Token): Promise<AuthUser> {
    const data = await this.FetchRawUserInfo(token);
    const text = new TextDecoder().decode(data);
    const rawUser = parseRawUser(text);
    const extracted = parseFacebookUser(text);

    const user = new AuthUser({
      Id: extracted.Id,
      Name: extracted.Name,
      Email: extracted.Email,
      AvatarURL: extracted.Picture.Data.Url,
      RawUser: rawUser,
      AccessToken: resolveTokenString(token, "accessToken", "access_token"),
      RefreshToken: resolveTokenString(token, "refreshToken", "refresh_token"),
    });
    user.Expiry = ParseDateTime(token.expiry ?? null);

    return user;
  }
}

Providers[NameFacebook] = wrapFactory(() => new Facebook());

function parseRawUser(raw: string): Record<string, unknown> {
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("invalid facebook oauth2 user payload");
  }

  return parsed as Record<string, unknown>;
}

function parseFacebookUser(raw: string): {
  Id: string;
  Name: string;
  Email: string;
  Picture: {
    Data: {
      Url: string;
    };
  };
} {
  const payload = parseRawUser(raw);
  return {
    Id: readStringField(payload, "id"),
    Name: readStringField(payload, "name"),
    Email: readStringField(payload, "email"),
    Picture: {
      Data: {
        Url: readPictureUrl(payload),
      },
    },
  };
}

function readPictureUrl(payload: Record<string, unknown>): string {
  const picture = payload.picture;
  if (picture == null) {
    return "";
  }
  if (!picture || typeof picture !== "object" || Array.isArray(picture)) {
    throw new Error("invalid facebook oauth2 payload field picture");
  }

  const data = (picture as Record<string, unknown>).data;
  if (data == null) {
    return "";
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("invalid facebook oauth2 payload field picture.data");
  }

  const url = (data as Record<string, unknown>).url;
  if (url == null) {
    return "";
  }
  if (typeof url !== "string") {
    throw new Error("invalid facebook oauth2 payload field picture.data.url");
  }

  return url;
}

function readStringField(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (value == null) {
    return "";
  }
  if (typeof value !== "string") {
    throw new Error(`invalid facebook oauth2 payload field ${key}`);
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
