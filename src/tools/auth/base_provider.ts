// Ported from pocketbase/tools/auth/base_provider.go (minimal provider state for validation tests).

import type { Provider } from "./auth.ts";

export class BaseProvider implements Provider {
  #ctx: unknown = null;
  #clientId = "";
  #clientSecret = "";
  #displayName = "";
  #redirectURL = "";
  #authURL = "";
  #tokenURL = "";
  #userInfoURL = "";
  #scopes: string[] = [];
  #pkce = false;
  #extra: Record<string, unknown> = {};

  Context(): unknown {
    return this.#ctx;
  }

  SetContext(ctx: unknown): void {
    this.#ctx = ctx;
  }

  PKCE(): boolean {
    return this.#pkce;
  }

  SetPKCE(enable: boolean): void {
    this.#pkce = enable;
  }

  DisplayName(): string {
    return this.#displayName;
  }

  SetDisplayName(displayName: string): void {
    this.#displayName = displayName;
  }

  Scopes(): string[] {
    return [...this.#scopes];
  }

  SetScopes(scopes: string[]): void {
    this.#scopes = Array.isArray(scopes) ? [...scopes] : [];
  }

  ClientId(): string {
    return this.#clientId;
  }

  SetClientId(clientId: string): void {
    this.#clientId = clientId;
  }

  ClientSecret(): string {
    return this.#clientSecret;
  }

  SetClientSecret(secret: string): void {
    this.#clientSecret = secret;
  }

  RedirectURL(): string {
    return this.#redirectURL;
  }

  SetRedirectURL(url: string): void {
    this.#redirectURL = url;
  }

  AuthURL(): string {
    return this.#authURL;
  }

  SetAuthURL(url: string): void {
    this.#authURL = url;
  }

  TokenURL(): string {
    return this.#tokenURL;
  }

  SetTokenURL(url: string): void {
    this.#tokenURL = url;
  }

  UserInfoURL(): string {
    return this.#userInfoURL;
  }

  SetUserInfoURL(url: string): void {
    this.#userInfoURL = url;
  }

  Extra(): Record<string, unknown> {
    return { ...this.#extra };
  }

  SetExtra(data: Record<string, unknown>): void {
    this.#extra = data ? { ...data } : {};
  }

  protected setDefaults(options: {
    displayName?: string;
    pkce?: boolean;
    scopes?: string[];
    authURL?: string;
    tokenURL?: string;
    userInfoURL?: string;
  }): void {
    if (options.displayName != null) {
      this.#displayName = options.displayName;
    }
    if (options.pkce != null) {
      this.#pkce = options.pkce;
    }
    if (options.scopes != null) {
      this.#scopes = [...options.scopes];
    }
    if (options.authURL != null) {
      this.#authURL = options.authURL;
    }
    if (options.tokenURL != null) {
      this.#tokenURL = options.tokenURL;
    }
    if (options.userInfoURL != null) {
      this.#userInfoURL = options.userInfoURL;
    }
  }
}
