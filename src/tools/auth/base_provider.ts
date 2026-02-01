// Ported from pocketbase/tools/auth/base_provider.go (minimal provider state for validation tests).

import type { Provider } from "./auth.ts";
import type { AuthCodeOption } from "./oauth2.ts";

export class BaseProvider implements Provider {
  #ctx: unknown = null;
  #clientId = "";
  #clientSecret = "";
  #displayName = "";
  #redirectURL = "";
  #authURL = "";
  #tokenURL = "";
  #userInfoURL = "";
  #scopes: string[] | null = null;
  #pkce = false;
  #extra: Record<string, unknown> | null = null;

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

  Scopes(): string[] | null {
    return this.#scopes;
  }

  SetScopes(scopes: string[] | null): void {
    this.#scopes = Array.isArray(scopes) ? scopes : null;
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

  Extra(): Record<string, unknown> | null {
    if (!this.#extra) {
      return null;
    }
    return { ...this.#extra };
  }

  SetExtra(data: Record<string, unknown> | null): void {
    this.#extra = data ? { ...data } : null;
  }

  Client(_token: unknown): (input: Request | URL | string, init?: RequestInit) => Promise<Response> {
    return fetch;
  }

  BuildAuthURL(state: string, ...opts: AuthCodeOption[]): string {
    return buildAuthURL(
      this.#authURL,
      {
        response_type: "code",
        client_id: this.#clientId,
        redirect_uri: this.#redirectURL,
        scope: this.#scopes ? this.#scopes.join(" ") : "",
        state,
      },
      opts,
    );
  }

  protected oauth2Config(): {
    RedirectURL: string;
    ClientID: string;
    ClientSecret: string;
    Scopes: string[];
    Endpoint: { AuthURL: string; TokenURL: string };
    AuthCodeURL: (state: string, ...opts: AuthCodeOption[]) => string;
  } {
    return {
      RedirectURL: this.#redirectURL,
      ClientID: this.#clientId,
      ClientSecret: this.#clientSecret,
      Scopes: this.#scopes ? [...this.#scopes] : [],
      Endpoint: {
        AuthURL: this.#authURL,
        TokenURL: this.#tokenURL,
      },
      AuthCodeURL: (state: string, ...opts: AuthCodeOption[]) =>
        buildAuthURL(
          this.#authURL,
          {
            response_type: "code",
            client_id: this.#clientId,
            redirect_uri: this.#redirectURL,
            scope: this.#scopes ? this.#scopes.join(" ") : "",
            state,
          },
          opts,
        ),
    };
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

function buildAuthURL(baseURL: string, baseParams: Record<string, string>, options: AuthCodeOption[]): string {
  const params: Record<string, string> = {};

  for (const [key, value] of Object.entries(baseParams)) {
    if (value !== "") {
      params[key] = value;
    }
  }

  for (const opt of options) {
    if (!opt) {
      continue;
    }
    params[opt.key] = opt.value;
  }

  const entries = Object.entries(params).sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) {
    return baseURL;
  }

  const query = entries.map(([key, value]) => `${encodeQueryComponent(key)}=${encodeQueryComponent(value)}`).join("&");

  return `${baseURL}?${query}`;
}

function encodeQueryComponent(value: string): string {
  return encodeURIComponent(value).replace(/%20/g, "+");
}
