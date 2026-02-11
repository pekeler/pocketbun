// Ported from pocketbase/tools/auth/box.go

import { ParseDateTime } from "../types/index.ts";
import { AuthUser, type OAuth2Token, Providers, wrapFactory } from "./auth.ts";
import { BaseProvider } from "./base_provider.ts";

// NameBox is the unique name of the Box provider.
export const NameBox = "box";

// Box is an auth provider for Box.
export class Box extends BaseProvider {
  constructor() {
    super();
    this.setDefaults({
      displayName: "Box",
      pkce: true,
      scopes: ["root_readonly"],
      authURL: "https://account.box.com/api/oauth2/authorize",
      tokenURL: "https://api.box.com/oauth2/token",
      userInfoURL: "https://api.box.com/2.0/users/me",
    });
  }

  // FetchAuthUser returns an AuthUser instance based on the Box's user API.
  //
  // API reference: https://developer.box.com/reference/get-users-me/
  override async FetchAuthUser(token: OAuth2Token): Promise<AuthUser> {
    const data = await this.FetchRawUserInfo(token);
    const text = new TextDecoder().decode(data);
    const rawUser = parseRawUser(text);
    const extracted = parseBoxUser(text);

    if (extracted.Status !== "active") {
      throw new Error(`Box user account is not active (status: ${JSON.stringify(extracted.Status)})`);
    }

    const user = new AuthUser({
      Id: extracted.Id,
      Name: extracted.Name,
      AvatarURL: extracted.AvatarURL,
      Email: extracted.Login, // Box requires verified email for OAuth authorization.
      RawUser: rawUser,
      AccessToken: resolveTokenString(token, "accessToken", "access_token"),
      RefreshToken: resolveTokenString(token, "refreshToken", "refresh_token"),
    });
    user.Expiry = ParseDateTime(token.expiry ?? null);

    return user;
  }
}

Providers[NameBox] = wrapFactory(() => new Box());

function parseRawUser(raw: string): Record<string, unknown> {
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("invalid box oauth2 user payload");
  }

  return parsed as Record<string, unknown>;
}

function parseBoxUser(raw: string): {
  Id: string;
  Name: string;
  Login: string;
  AvatarURL: string;
  Status: string;
} {
  const payload = parseRawUser(raw);
  return {
    Id: readStringField(payload, "id"),
    Name: readStringField(payload, "name"),
    Login: readStringField(payload, "login"),
    AvatarURL: readStringField(payload, "avatar_url"),
    Status: readStringField(payload, "status"),
  };
}

function readStringField(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (value == null) {
    return "";
  }
  if (typeof value !== "string") {
    throw new Error(`invalid box oauth2 payload field ${key}`);
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
