// Ported from pocketbase/tools/auth/notion.go

import { ParseDateTime } from "../types/index.ts";
import { AuthUser, type OAuth2Token, Providers, wrapFactory } from "./auth.ts";
import { BaseProvider } from "./base_provider.ts";

// NameNotion is the unique name of the Notion provider.
export const NameNotion = "notion";

// Notion allows authentication via Notion OAuth2.
export class Notion extends BaseProvider {
  constructor() {
    super();
    this.setDefaults({
      displayName: "Notion",
      pkce: true,
      authURL: "https://api.notion.com/v1/oauth/authorize",
      tokenURL: "https://api.notion.com/v1/oauth/token",
      userInfoURL: "https://api.notion.com/v1/users/me",
    });
  }

  // FetchAuthUser returns an AuthUser instance based on the Notion's User api.
  // API reference: https://developers.notion.com/reference/get-self
  override async FetchAuthUser(token: OAuth2Token): Promise<AuthUser> {
    const data = await this.FetchRawUserInfo(token);
    const text = new TextDecoder().decode(data);
    const rawUser = parseRawUser(text);
    const extracted = parseNotionUser(text);

    const user = new AuthUser({
      Id: extracted.Bot.Owner.User.Id,
      Name: extracted.Bot.Owner.User.Name,
      Email: extracted.Bot.Owner.User.Person.Email,
      AvatarURL: extracted.Bot.Owner.User.AvatarURL,
      RawUser: rawUser,
      AccessToken: resolveTokenString(token, "accessToken", "access_token"),
      RefreshToken: resolveTokenString(token, "refreshToken", "refresh_token"),
    });
    user.Expiry = ParseDateTime(token.expiry ?? null);

    return user;
  }

  // FetchRawUserInfo implements Provider.FetchRawUserInfo interface method.
  //
  // This differs from BaseProvider because Notion requires a version header for all requests
  // (https://developers.notion.com/reference/versioning).
  override async FetchRawUserInfo(token: OAuth2Token): Promise<Uint8Array> {
    const userInfoURL = this.UserInfoURL();
    if (!userInfoURL) {
      throw new Error("missing OAuth2 user info url");
    }

    const headers = new Headers();
    headers.set("Notion-Version", "2022-06-28");

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

Providers[NameNotion] = wrapFactory(() => new Notion());

function parseRawUser(raw: string): Record<string, unknown> {
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("invalid notion oauth2 user payload");
  }

  return parsed as Record<string, unknown>;
}

function parseNotionUser(raw: string): {
  Bot: {
    Owner: {
      User: {
        AvatarURL: string;
        Id: string;
        Name: string;
        Person: {
          Email: string;
        };
      };
    };
  };
} {
  const payload = parseRawUser(raw);
  const bot = readObjectField(payload, "bot", "invalid notion oauth2 payload field bot");
  const owner = readObjectField(bot, "owner", "invalid notion oauth2 payload field bot.owner");
  const user = readObjectField(owner, "user", "invalid notion oauth2 payload field bot.owner.user");
  const person = readObjectField(user, "person", "invalid notion oauth2 payload field bot.owner.user.person");

  return {
    Bot: {
      Owner: {
        User: {
          AvatarURL: readStringField(user, "avatar_url"),
          Id: readStringField(user, "id"),
          Name: readStringField(user, "name"),
          Person: {
            Email: readStringField(person, "email"),
          },
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
    throw new Error(`invalid notion oauth2 payload field ${key}`);
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
