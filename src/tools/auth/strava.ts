// Ported from pocketbase/tools/auth/strava.go

import { ParseDateTime } from "../types/index.ts";
import { AuthUser, type OAuth2Token, Providers, wrapFactory } from "./auth.ts";
import { BaseProvider } from "./base_provider.ts";

// NameStrava is the unique name of the Strava provider.
export const NameStrava = "strava";

// Strava allows authentication via Strava OAuth2.
export class Strava extends BaseProvider {
  constructor() {
    super();
    this.setDefaults({
      displayName: "Strava",
      pkce: true,
      scopes: ["profile:read_all"],
      authURL: "https://www.strava.com/oauth/authorize",
      tokenURL: "https://www.strava.com/api/v3/oauth/token",
      userInfoURL: "https://www.strava.com/api/v3/athlete",
    });
  }

  // FetchAuthUser returns an AuthUser instance based on the Strava's user api.
  //
  // API reference: https://developers.strava.com/docs/authentication/
  override async FetchAuthUser(token: OAuth2Token): Promise<AuthUser> {
    const data = await this.FetchRawUserInfo(token);
    const text = new TextDecoder().decode(data);
    const rawUser = parseRawUser(text);
    const extracted = parseStravaUser(text);

    const user = new AuthUser({
      Name: `${extracted.FirstName} ${extracted.LastName}`,
      Username: extracted.Username,
      AvatarURL: extracted.ProfileImageURL,
      RawUser: rawUser,
      AccessToken: resolveTokenString(token, "accessToken", "access_token"),
      RefreshToken: resolveTokenString(token, "refreshToken", "refresh_token"),
    });
    user.Expiry = ParseDateTime(token.expiry ?? null);

    if (extracted.Id !== 0) {
      user.Id = extracted.Id.toString();
    }

    return user;
  }
}

Providers[NameStrava] = wrapFactory(() => new Strava());

function parseRawUser(raw: string): Record<string, unknown> {
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("invalid strava oauth2 user payload");
  }

  return parsed as Record<string, unknown>;
}

function parseStravaUser(raw: string): {
  Id: number;
  FirstName: string;
  LastName: string;
  Username: string;
  ProfileImageURL: string;
} {
  const payload = parseRawUser(raw);
  return {
    Id: readIntField(payload, "id"),
    FirstName: readStringField(payload, "firstname"),
    LastName: readStringField(payload, "lastname"),
    Username: readStringField(payload, "username"),
    ProfileImageURL: readStringField(payload, "profile"),
  };
}

function readStringField(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (value == null) {
    return "";
  }
  if (typeof value !== "string") {
    throw new Error(`invalid strava oauth2 payload field ${key}`);
  }
  return value;
}

function readIntField(payload: Record<string, unknown>, key: string): number {
  const value = payload[key];
  if (value == null) {
    return 0;
  }
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value)) {
    throw new Error(`invalid strava oauth2 payload field ${key}`);
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
