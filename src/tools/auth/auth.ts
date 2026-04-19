// Ported from pocketbase/tools/auth/auth.go

import { DateTime } from "../types/index.ts";

export type OAuth2Token = {
  accessToken?: string;
  refreshToken?: string;
  expiry?: Date | DateTime | string | number | null;
  tokenType?: string;
  [key: string]: unknown;
};

// AuthUser defines a standardized OAuth2 user data structure.
export class AuthUser {
  Expiry: DateTime;
  RawUser: Record<string, unknown>;
  Id: string;
  Name: string;
  Username: string;
  Email: string;
  AvatarURL: string;
  AccessToken: string;
  RefreshToken: string;
  AvatarUrl: string;

  constructor(data: Partial<AuthUser> = {}) {
    this.Expiry = data.Expiry instanceof DateTime ? data.Expiry : new DateTime();
    this.RawUser = data.RawUser ?? {};
    this.Id = data.Id ?? "";
    this.Name = data.Name ?? "";
    this.Username = data.Username ?? "";
    this.Email = data.Email ?? "";
    this.AvatarURL = data.AvatarURL ?? "";
    this.AccessToken = data.AccessToken ?? "";
    this.RefreshToken = data.RefreshToken ?? "";
    this.AvatarUrl = data.AvatarUrl ?? this.AvatarURL;
  }

  toJSON(): Record<string, unknown> {
    return {
      expiry: this.Expiry,
      rawUser: this.RawUser,
      id: this.Id,
      name: this.Name,
      username: this.Username,
      email: this.Email,
      avatarURL: this.AvatarURL,
      accessToken: this.AccessToken,
      refreshToken: this.RefreshToken,
      avatarUrl: this.AvatarURL,
    };
  }
}

// ProviderFactoryFunc defines a function for initializing a new OAuth2 provider.
export type ProviderFactoryFunc = () => Provider;

// Providers defines a map with all of the available OAuth2 providers.
//
// To register a new provider append a new entry in the map.
export const Providers: Record<string, ProviderFactoryFunc> = {};

export function newProviderByName(name: string): Provider {
  const factory = Providers[name];
  if (!factory) {
    throw new Error(`missing provider ${name}`);
  }
  return factory();
}

// Provider defines a common interface for an OAuth2 client.
export interface Provider {
  Logo(): string;
  Order(): number;
  Context(): unknown;
  SetContext(ctx: unknown): void;
  PKCE(): boolean;
  SetPKCE(enable: boolean): void;
  DisplayName(): string;
  SetDisplayName(displayName: string): void;
  Scopes(): string[] | null;
  SetScopes(scopes: string[] | null): void;
  ClientId(): string;
  SetClientId(clientId: string): void;
  ClientSecret(): string;
  SetClientSecret(secret: string): void;
  RedirectURL(): string;
  SetRedirectURL(url: string): void;
  AuthURL(): string;
  SetAuthURL(url: string): void;
  TokenURL(): string;
  SetTokenURL(url: string): void;
  UserInfoURL(): string;
  SetUserInfoURL(url: string): void;
  Extra(): Record<string, unknown> | null;
  SetExtra(data: Record<string, unknown> | null): void;
  Client(token: OAuth2Token | null): (input: Request | URL | string, init?: RequestInit) => Promise<Response>;
  BuildAuthURL(state: string, ...opts: import("./oauth2.ts").AuthCodeOption[]): string;
  FetchToken(code: string, ...opts: import("./oauth2.ts").AuthCodeOption[]): Promise<OAuth2Token>;
  FetchRawUserInfo(token: OAuth2Token): Promise<Uint8Array>;
  FetchAuthUser(token: OAuth2Token): Promise<AuthUser>;
}

// wrapFactory is a helper that wraps a Provider specific factory
// function and returns its result as Provider interface.
export function wrapFactory<T extends Provider>(factory: () => T): ProviderFactoryFunc {
  return () => factory();
}
