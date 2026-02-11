// Ported from pocketbase/tools/auth/twitch.go

import { ParseDateTime } from "../types/index.ts";
import { AuthUser, type OAuth2Token, Providers, wrapFactory } from "./auth.ts";
import { BaseProvider } from "./base_provider.ts";

// NameTwitch is the unique name of the Twitch provider.
export const NameTwitch = "twitch";

// Twitch allows authentication via Twitch OAuth2.
export class Twitch extends BaseProvider {
  constructor() {
    super();
    this.setDefaults({
      displayName: "Twitch",
      pkce: true,
      scopes: ["user:read:email"],
      authURL: "https://id.twitch.tv/oauth2/authorize",
      tokenURL: "https://id.twitch.tv/oauth2/token",
      userInfoURL: "https://api.twitch.tv/helix/users",
    });
  }

  // FetchAuthUser returns an AuthUser instance based the Twitch's user api.
  //
  // API reference: https://dev.twitch.tv/docs/api/reference#get-users
  override async FetchAuthUser(token: OAuth2Token): Promise<AuthUser> {
    const data = await this.FetchRawUserInfo(token);
    const text = new TextDecoder().decode(data);
    const rawUser = parseRawUser(text);
    const extracted = parseTwitchUser(text);

    if (extracted.Data.length === 0) {
      throw new Error("failed to fetch AuthUser data");
    }

    const entry = extracted.Data[0];
    if (!entry) {
      throw new Error("failed to fetch AuthUser data");
    }

    const user = new AuthUser({
      Id: entry.Id,
      Name: entry.DisplayName,
      Username: entry.Login,
      Email: entry.Email,
      AvatarURL: entry.ProfileImageURL,
      RawUser: rawUser,
      AccessToken: resolveTokenString(token, "accessToken", "access_token"),
      RefreshToken: resolveTokenString(token, "refreshToken", "refresh_token"),
    });
    user.Expiry = ParseDateTime(token.expiry ?? null);

    return user;
  }

  // FetchRawUserInfo implements Provider.FetchRawUserInfo interface method.
  //
  // This differs from BaseProvider because Twitch requires the Client-Id header.
  override async FetchRawUserInfo(token: OAuth2Token): Promise<Uint8Array> {
    const userInfoURL = this.UserInfoURL();
    if (!userInfoURL) {
      throw new Error("missing OAuth2 user info url");
    }

    const headers = new Headers();
    headers.set("Client-Id", this.ClientId());

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

Providers[NameTwitch] = wrapFactory(() => new Twitch());

function parseRawUser(raw: string): Record<string, unknown> {
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("invalid twitch oauth2 user payload");
  }

  return parsed as Record<string, unknown>;
}

function parseTwitchUser(raw: string): {
  Data: Array<{
    Id: string;
    Login: string;
    DisplayName: string;
    Email: string;
    ProfileImageURL: string;
  }>;
} {
  const payload = parseRawUser(raw);
  const data = readObjectArrayField(payload, "data", "invalid twitch oauth2 payload field data");

  return {
    Data: data.map((entry) => ({
      Id: readStringField(entry, "id"),
      Login: readStringField(entry, "login"),
      DisplayName: readStringField(entry, "display_name"),
      Email: readStringField(entry, "email"),
      ProfileImageURL: readStringField(entry, "profile_image_url"),
    })),
  };
}

function readObjectArrayField(
  payload: Record<string, unknown>,
  key: string,
  typeError: string,
): Array<Record<string, unknown>> {
  const value = payload[key];
  if (value == null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error(typeError);
  }

  const result: Array<Record<string, unknown>> = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(typeError);
    }
    result.push(entry as Record<string, unknown>);
  }

  return result;
}

function readStringField(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (value == null) {
    return "";
  }
  if (typeof value !== "string") {
    throw new Error(`invalid twitch oauth2 payload field ${key}`);
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
