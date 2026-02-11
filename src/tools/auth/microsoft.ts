// Ported from pocketbase/tools/auth/microsoft.go

import { ParseDateTime } from "../types/index.ts";
import { AuthUser, type OAuth2Token, Providers, wrapFactory } from "./auth.ts";
import { BaseProvider } from "./base_provider.ts";

// NameMicrosoft is the unique name of the Microsoft provider.
export const NameMicrosoft = "microsoft";

// Microsoft allows authentication via AzureADEndpoint OAuth2.
export class Microsoft extends BaseProvider {
  constructor() {
    super();
    this.setDefaults({
      displayName: "Microsoft",
      pkce: true,
      scopes: ["User.Read"],
      authURL: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
      tokenURL: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      userInfoURL: "https://graph.microsoft.com/v1.0/me",
    });
  }

  // FetchAuthUser returns an AuthUser instance based on the Microsoft's user api.
  //
  // API reference:  https://learn.microsoft.com/en-us/azure/active-directory/develop/userinfo
  // Graph explorer: https://developer.microsoft.com/en-us/graph/graph-explorer
  override async FetchAuthUser(token: OAuth2Token): Promise<AuthUser> {
    const data = await this.FetchRawUserInfo(token);
    const text = new TextDecoder().decode(data);
    const rawUser = parseRawUser(text);
    const extracted = parseMicrosoftUser(text);

    const user = new AuthUser({
      Id: extracted.Id,
      Name: extracted.Name,
      Email: extracted.Email,
      RawUser: rawUser,
      AccessToken: resolveTokenString(token, "accessToken", "access_token"),
      RefreshToken: resolveTokenString(token, "refreshToken", "refresh_token"),
    });
    user.Expiry = ParseDateTime(token.expiry ?? null);

    return user;
  }
}

Providers[NameMicrosoft] = wrapFactory(() => new Microsoft());

function parseRawUser(raw: string): Record<string, unknown> {
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("invalid microsoft oauth2 user payload");
  }

  return parsed as Record<string, unknown>;
}

function parseMicrosoftUser(raw: string): {
  Id: string;
  Name: string;
  Email: string;
} {
  const payload = parseRawUser(raw);
  return {
    Id: readStringField(payload, "id"),
    Name: readStringField(payload, "displayName"),
    Email: readStringField(payload, "mail"),
  };
}

function readStringField(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (value == null) {
    return "";
  }
  if (typeof value !== "string") {
    throw new Error(`invalid microsoft oauth2 payload field ${key}`);
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
