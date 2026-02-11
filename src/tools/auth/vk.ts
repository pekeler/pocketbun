// Ported from pocketbase/tools/auth/vk.go

import { ParseDateTime } from "../types/index.ts";
import { AuthUser, type OAuth2Token, Providers, wrapFactory } from "./auth.ts";
import { BaseProvider } from "./base_provider.ts";

// NameVK is the unique name of the VK provider.
export const NameVK = "vk";

// VK allows authentication via VK OAuth2.
export class VK extends BaseProvider {
  constructor() {
    super();
    this.setDefaults({
      displayName: "ВКонтакте",
      pkce: false, // VK currently doesn't support PKCE and throws an error if PKCE params are sent.
      scopes: ["email"],
      authURL: "https://oauth.vk.com/authorize",
      tokenURL: "https://oauth.vk.com/access_token",
      userInfoURL: "https://api.vk.com/method/users.get?fields=photo_max,screen_name&v=5.131",
    });
  }

  // FetchAuthUser returns an AuthUser instance based on VK's user api.
  //
  // API reference: https://dev.vk.com/method/users.get
  override async FetchAuthUser(token: OAuth2Token): Promise<AuthUser> {
    const data = await this.FetchRawUserInfo(token);
    const text = new TextDecoder().decode(data);
    const rawUser = parseRawUser(text);
    const extracted = parseVKUser(text);

    if (extracted.Response.length === 0) {
      throw new Error("missing response entry");
    }

    const entry = extracted.Response[0];
    if (!entry) {
      throw new Error("missing response entry");
    }

    const user = new AuthUser({
      Id: entry.Id.toString(),
      Name: `${entry.FirstName} ${entry.LastName}`.trim(),
      Username: entry.Username,
      AvatarURL: entry.AvatarURL,
      RawUser: rawUser,
      AccessToken: resolveTokenString(token, "accessToken", "access_token"),
      RefreshToken: resolveTokenString(token, "refreshToken", "refresh_token"),
    });
    user.Expiry = ParseDateTime(token.expiry ?? null);

    const email = token.email;
    if (typeof email === "string") {
      user.Email = email;
    } else if (typeof email === "number" || typeof email === "boolean" || typeof email === "bigint") {
      user.Email = `${email}`;
    } else if (email != null) {
      const serialized = JSON.stringify(email);
      if (typeof serialized === "string") {
        user.Email = serialized;
      }
    }

    return user;
  }
}

Providers[NameVK] = wrapFactory(() => new VK());

function parseRawUser(raw: string): Record<string, unknown> {
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("invalid vk oauth2 user payload");
  }

  return parsed as Record<string, unknown>;
}

function parseVKUser(raw: string): {
  Response: Array<{
    Id: number;
    FirstName: string;
    LastName: string;
    Username: string;
    AvatarURL: string;
  }>;
} {
  const payload = parseRawUser(raw);
  const response = readObjectArrayField(payload, "response", "invalid vk oauth2 payload field response");

  return {
    Response: response.map((entry) => ({
      Id: readIntField(entry, "id"),
      FirstName: readStringField(entry, "first_name"),
      LastName: readStringField(entry, "last_name"),
      Username: readStringField(entry, "screen_name"),
      AvatarURL: readStringField(entry, "photo_max"),
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
    throw new Error(`invalid vk oauth2 payload field ${key}`);
  }
  return value;
}

function readIntField(payload: Record<string, unknown>, key: string): number {
  const value = payload[key];
  if (value == null) {
    return 0;
  }
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value)) {
    throw new Error(`invalid vk oauth2 payload field ${key}`);
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
