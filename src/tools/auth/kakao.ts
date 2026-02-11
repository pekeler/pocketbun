// Ported from pocketbase/tools/auth/kakao.go

import { ParseDateTime } from "../types/index.ts";
import { AuthUser, type OAuth2Token, Providers, wrapFactory } from "./auth.ts";
import { BaseProvider } from "./base_provider.ts";

// NameKakao is the unique name of the Kakao provider.
export const NameKakao = "kakao";

// Kakao allows authentication via Kakao OAuth2.
export class Kakao extends BaseProvider {
  constructor() {
    super();
    this.setDefaults({
      displayName: "Kakao",
      pkce: true,
      scopes: ["account_email", "profile_nickname", "profile_image"],
      authURL: "https://kauth.kakao.com/oauth/authorize",
      tokenURL: "https://kauth.kakao.com/oauth/token",
      userInfoURL: "https://kapi.kakao.com/v2/user/me",
    });
  }

  // FetchAuthUser returns an AuthUser instance based on the Kakao's user api.
  //
  // API reference: https://developers.kakao.com/docs/latest/en/kakaologin/rest-api#req-user-info-response
  override async FetchAuthUser(token: OAuth2Token): Promise<AuthUser> {
    const data = await this.FetchRawUserInfo(token);
    const text = new TextDecoder().decode(data);
    const rawUser = parseRawUser(text);
    const extracted = parseKakaoUser(text);

    const user = new AuthUser({
      Id: extracted.Id.toString(),
      Username: extracted.Profile.Nickname,
      AvatarURL: extracted.Profile.ImageURL,
      RawUser: rawUser,
      AccessToken: resolveTokenString(token, "accessToken", "access_token"),
      RefreshToken: resolveTokenString(token, "refreshToken", "refresh_token"),
    });
    user.Expiry = ParseDateTime(token.expiry ?? null);

    if (extracted.KakaoAccount.IsEmailValid && extracted.KakaoAccount.IsEmailVerified) {
      user.Email = extracted.KakaoAccount.Email;
    }

    return user;
  }
}

Providers[NameKakao] = wrapFactory(() => new Kakao());

function parseRawUser(raw: string): Record<string, unknown> {
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("invalid kakao oauth2 user payload");
  }

  return parsed as Record<string, unknown>;
}

function parseKakaoUser(raw: string): {
  Profile: {
    Nickname: string;
    ImageURL: string;
  };
  KakaoAccount: {
    Email: string;
    IsEmailVerified: boolean;
    IsEmailValid: boolean;
  };
  Id: number;
} {
  const payload = parseRawUser(raw);
  const profile = readObjectField(payload, "properties", "invalid kakao oauth2 payload field properties");
  const kakaoAccount = readObjectField(payload, "kakao_account", "invalid kakao oauth2 payload field kakao_account");

  return {
    Profile: {
      Nickname: readStringField(profile, "nickname"),
      ImageURL: readStringField(profile, "profile_image"),
    },
    KakaoAccount: {
      Email: readStringField(kakaoAccount, "email"),
      IsEmailVerified: readBoolField(kakaoAccount, "is_email_verified"),
      IsEmailValid: readBoolField(kakaoAccount, "is_email_valid"),
    },
    Id: readIntField(payload, "id"),
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
    throw new Error(`invalid kakao oauth2 payload field ${key}`);
  }
  return value;
}

function readBoolField(payload: Record<string, unknown>, key: string): boolean {
  const value = payload[key];
  if (value == null) {
    return false;
  }
  if (typeof value !== "boolean") {
    throw new Error(`invalid kakao oauth2 payload field ${key}`);
  }
  return value;
}

function readIntField(payload: Record<string, unknown>, key: string): number {
  const value = payload[key];
  if (value == null) {
    return 0;
  }
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value)) {
    throw new Error(`invalid kakao oauth2 payload field ${key}`);
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
