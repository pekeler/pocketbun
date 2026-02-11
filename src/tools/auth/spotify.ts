// Ported from pocketbase/tools/auth/spotify.go

import { ParseDateTime } from "../types/index.ts";
import { AuthUser, type OAuth2Token, Providers, wrapFactory } from "./auth.ts";
import { BaseProvider } from "./base_provider.ts";

// NameSpotify is the unique name of the Spotify provider.
export const NameSpotify = "spotify";

// Spotify allows authentication via Spotify OAuth2.
export class Spotify extends BaseProvider {
  constructor() {
    super();
    this.setDefaults({
      displayName: "Spotify",
      pkce: true,
      scopes: ["user-read-private"],
      authURL: "https://accounts.spotify.com/authorize",
      tokenURL: "https://accounts.spotify.com/api/token",
      userInfoURL: "https://api.spotify.com/v1/me",
    });
  }

  // FetchAuthUser returns an AuthUser instance based on the Spotify's user api.
  //
  // API reference: https://developer.spotify.com/documentation/web-api/reference/#/operations/get-current-users-profile
  override async FetchAuthUser(token: OAuth2Token): Promise<AuthUser> {
    const data = await this.FetchRawUserInfo(token);
    const text = new TextDecoder().decode(data);
    const rawUser = parseRawUser(text);
    const extracted = parseSpotifyUser(text);

    const user = new AuthUser({
      Id: extracted.Id,
      Name: extracted.Name,
      RawUser: rawUser,
      AccessToken: resolveTokenString(token, "accessToken", "access_token"),
      RefreshToken: resolveTokenString(token, "refreshToken", "refresh_token"),
    });
    user.Expiry = ParseDateTime(token.expiry ?? null);

    if (extracted.Images.length > 0) {
      user.AvatarURL = extracted.Images[0]?.URL ?? "";
    }

    return user;
  }
}

Providers[NameSpotify] = wrapFactory(() => new Spotify());

function parseRawUser(raw: string): Record<string, unknown> {
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("invalid spotify oauth2 user payload");
  }

  return parsed as Record<string, unknown>;
}

function parseSpotifyUser(raw: string): {
  Id: string;
  Name: string;
  Images: Array<{ URL: string }>;
} {
  const payload = parseRawUser(raw);
  return {
    Id: readStringField(payload, "id"),
    Name: readStringField(payload, "display_name"),
    Images: readImages(payload, "images"),
  };
}

function readImages(payload: Record<string, unknown>, key: string): Array<{ URL: string }> {
  const value = payload[key];
  if (value == null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error(`invalid spotify oauth2 payload field ${key}`);
  }

  const result: Array<{ URL: string }> = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`invalid spotify oauth2 payload field ${key}`);
    }

    const row = entry as Record<string, unknown>;
    result.push({
      URL: readStringField(row, "url"),
    });
  }

  return result;
}

function readStringField(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (value == null) {
    return "";
  }
  if (typeof value !== "string") {
    throw new Error(`invalid spotify oauth2 payload field ${key}`);
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
