// Ported from pocketbase/tools/auth/lark.go

import { ParseDateTime } from "../types/index.ts";
import { AuthUser, type OAuth2Token, Providers, wrapFactory } from "./auth.ts";
import { BaseProvider } from "./base_provider.ts";

// NameLark is the unique name of the Lark provider.
export const NameLark = "lark";

// Lark allows authentication via Lark OAuth2.
export class Lark extends BaseProvider {
  constructor() {
    super();
    this.setDefaults({
      displayName: "Lark",
      pkce: true,
      // Lark has two domains with the same API: feishu.cn and larksuite.com.
      // The former is used in China and the latter is used in the other regions.
      // We choose feishu.cn as a default, matching the behavior of Lark's official SDK.
      // Endpoint URLs can be overridden from the frontend if needed.
      // SDK Reference: https://github.com/larksuite/oapi-sdk-go
      authURL: "https://accounts.feishu.cn/open-apis/authen/v1/authorize",
      tokenURL: "https://open.feishu.cn/open-apis/authen/v2/oauth/token",
      userInfoURL: "https://open.feishu.cn/open-apis/authen/v1/user_info",
    });
  }

  // FetchAuthUser returns an AuthUser instance based the Lark's user api.
  //
  // API reference: https://open.feishu.cn/document/server-docs/authentication-management/login-state-management/get
  override async FetchAuthUser(token: OAuth2Token): Promise<AuthUser> {
    const data = await this.FetchRawUserInfo(token);
    const text = new TextDecoder().decode(data);
    const rawUser = parseRawUser(text);
    const extracted = parseLarkUser(text);

    const user = new AuthUser({
      Id: extracted.Data.UnionId,
      Name: extracted.Data.Name,
      AvatarURL: extracted.Data.AvatarURL,
      RawUser: rawUser,
      AccessToken: resolveTokenString(token, "accessToken", "access_token"),
      RefreshToken: resolveTokenString(token, "refreshToken", "refresh_token"),
    });
    user.Expiry = ParseDateTime(token.expiry ?? null);

    return user;
  }
}

Providers[NameLark] = wrapFactory(() => new Lark());

function parseRawUser(raw: string): Record<string, unknown> {
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("invalid lark oauth2 user payload");
  }

  return parsed as Record<string, unknown>;
}

function parseLarkUser(raw: string): {
  Data: {
    UnionId: string;
    Name: string;
    AvatarURL: string;
  };
} {
  const payload = parseRawUser(raw);
  const data = readObjectField(payload, "data", "invalid lark oauth2 payload field data");

  return {
    Data: {
      UnionId: readStringField(data, "union_id"),
      Name: readStringField(data, "name"),
      AvatarURL: readStringField(data, "avatar_url"),
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
    throw new Error(`invalid lark oauth2 payload field ${key}`);
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
