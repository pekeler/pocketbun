// Ported from pocketbase/tools/auth/discord.go

import { ParseDateTime } from "../types/index.ts";
import { AuthUser, type OAuth2Token, Providers, wrapFactory } from "./auth.ts";
import { BaseProvider } from "./base_provider.ts";

// NameDiscord is the unique name of the Discord provider.
export const NameDiscord = "discord";

// Discord allows authentication via Discord OAuth2.
export class Discord extends BaseProvider {
  constructor() {
    super();
    this.setDefaults({
      displayName: "Discord",
      pkce: true,
      scopes: ["identify", "email"],
      authURL: "https://discord.com/api/oauth2/authorize",
      tokenURL: "https://discord.com/api/oauth2/token",
      userInfoURL: "https://discord.com/api/users/@me",
    });
  }

  // FetchAuthUser returns an AuthUser instance from Discord's user api.
  //
  // API reference:  https://discord.com/developers/docs/resources/user#user-object
  override async FetchAuthUser(token: OAuth2Token): Promise<AuthUser> {
    const data = await this.FetchRawUserInfo(token);
    const text = new TextDecoder().decode(data);
    const rawUser = parseRawUser(text);
    const extracted = parseDiscordUser(text);

    // Build a full avatar URL using the avatar hash provided in the API response
    // https://discord.com/developers/docs/reference#image-formatting
    const avatarURL = `https://cdn.discordapp.com/avatars/${extracted.Id}/${extracted.Avatar}.png`;

    // Concatenate the user's username and discriminator into a single username string
    const username = `${extracted.Username}#${extracted.Discriminator}`;

    const user = new AuthUser({
      Id: extracted.Id,
      Name: username,
      Username: extracted.Username,
      AvatarURL: avatarURL,
      RawUser: rawUser,
      AccessToken: resolveTokenString(token, "accessToken", "access_token"),
      RefreshToken: resolveTokenString(token, "refreshToken", "refresh_token"),
    });
    user.Expiry = ParseDateTime(token.expiry ?? null);

    if (extracted.Verified) {
      user.Email = extracted.Email;
    }

    return user;
  }
}

Providers[NameDiscord] = wrapFactory(() => new Discord());

function parseRawUser(raw: string): Record<string, unknown> {
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("invalid discord oauth2 user payload");
  }

  return parsed as Record<string, unknown>;
}

function parseDiscordUser(raw: string): {
  Id: string;
  Username: string;
  Discriminator: string;
  Avatar: string;
  Email: string;
  Verified: boolean;
} {
  const payload = parseRawUser(raw);
  return {
    Id: readStringField(payload, "id"),
    Username: readStringField(payload, "username"),
    Discriminator: readStringField(payload, "discriminator"),
    Avatar: readStringField(payload, "avatar"),
    Email: readStringField(payload, "email"),
    Verified: readBoolField(payload, "verified"),
  };
}

function readStringField(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (value == null) {
    return "";
  }
  if (typeof value !== "string") {
    throw new Error(`invalid discord oauth2 payload field ${key}`);
  }
  return value;
}

function readBoolField(payload: Record<string, unknown>, key: string): boolean {
  const value = payload[key];
  if (value == null) {
    return false;
  }
  if (typeof value !== "boolean") {
    throw new Error(`invalid discord oauth2 payload field ${key}`);
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
