// Ported from pocketbase/tools/auth/base_provider.go (minimal provider state for validation tests).

import type { AuthCodeOption } from "./oauth2.ts";
import { DateTime } from "../types/index.ts";
import { AuthUser, type OAuth2Token, type Provider } from "./auth.ts";

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

  Client(_token: OAuth2Token | null): (input: Request | URL | string, init?: RequestInit) => Promise<Response> {
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

  async FetchToken(code: string, ...opts: AuthCodeOption[]): Promise<OAuth2Token> {
    if (!this.#tokenURL) {
      throw new Error("missing OAuth2 token url");
    }

    const params = new URLSearchParams();
    params.set("grant_type", "authorization_code");
    params.set("code", code);
    if (this.#redirectURL) {
      params.set("redirect_uri", this.#redirectURL);
    }
    if (this.#clientId) {
      params.set("client_id", this.#clientId);
    }
    if (this.#clientSecret) {
      params.set("client_secret", this.#clientSecret);
    }

    for (const opt of opts) {
      if (!opt) {
        continue;
      }
      params.set(opt.key, opt.value);
    }

    const res = await fetch(this.#tokenURL, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
      signal: resolveAbortSignal(this.#ctx),
    });

    const raw = await res.text();
    if (!res.ok) {
      throw new Error(`failed to fetch OAuth2 token (${res.status}): ${raw}`);
    }

    let payload: Record<string, unknown> = {};
    try {
      payload = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    } catch {
      payload = {};
    }

    const token: OAuth2Token = { ...payload };
    const accessToken = resolveTokenString(payload, "accessToken", "access_token");
    if (accessToken) {
      token.accessToken = accessToken;
    }
    const refreshToken = resolveTokenString(payload, "refreshToken", "refresh_token");
    if (refreshToken) {
      token.refreshToken = refreshToken;
    }
    const expiresIn = typeof payload.expires_in === "number" ? payload.expires_in : null;
    if (expiresIn && Number.isFinite(expiresIn)) {
      token.expiry = new Date(Date.now() + expiresIn * 1000);
    }

    return token;
  }

  async FetchRawUserInfo(token: OAuth2Token): Promise<Uint8Array> {
    if (!this.#userInfoURL) {
      throw new Error("missing OAuth2 user info url");
    }

    const headers = new Headers();
    const accessToken = resolveTokenString(token, "accessToken", "access_token");
    if (accessToken) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }

    const res = await fetch(this.#userInfoURL, {
      headers,
      signal: resolveAbortSignal(this.#ctx),
    });

    const data = new Uint8Array(await res.arrayBuffer());
    if (!res.ok) {
      const decoded = new TextDecoder().decode(data);
      throw new Error(`failed to fetch OAuth2 user profile via ${this.#userInfoURL} (${res.status}):\\n${decoded}`);
    }

    return data;
  }

  // PocketBun deviation: provide a generic OAuth2 user mapping fallback until provider-specific
  // FetchAuthUser implementations are ported.
  async FetchAuthUser(token: OAuth2Token): Promise<AuthUser> {
    const raw = await this.FetchRawUserInfo(token);
    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(new TextDecoder().decode(raw)) as Record<string, unknown>;
    } catch {
      payload = {};
    }

    const user = new AuthUser();
    user.RawUser = payload ?? {};
    user.Id = pickString(payload, "id", "sub", "user_id", "uid");
    user.Name = pickString(payload, "name", "full_name", "display_name");
    user.Username = pickString(payload, "username", "login", "preferred_username", "screen_name");
    user.Email = pickString(payload, "email", "email_address", "emailAddress");
    user.AvatarURL = pickString(payload, "avatar_url", "avatarURL", "picture", "profile_image_url", "profileImageURL");

    const accessToken = resolveTokenString(token, "accessToken", "access_token");
    if (accessToken) {
      user.AccessToken = accessToken;
    }
    const refreshToken = resolveTokenString(token, "refreshToken", "refresh_token");
    if (refreshToken) {
      user.RefreshToken = refreshToken;
    }

    const expiry = resolveTokenExpiry(token);
    if (expiry) {
      user.Expiry = expiry;
    }

    return user;
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

function resolveAbortSignal(ctx: unknown): AbortSignal | undefined {
  if (!ctx) {
    return undefined;
  }
  return ctx instanceof AbortSignal ? ctx : undefined;
}

function resolveTokenString(token: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = token[key];
    if (typeof value === "string" && value) {
      return value;
    }
  }
  return "";
}

function resolveTokenExpiry(token: OAuth2Token): DateTime | null {
  const raw = token.expiry;
  if (!raw) {
    return null;
  }
  if (raw instanceof DateTime) {
    return raw;
  }
  if (raw instanceof Date) {
    return new DateTime(raw);
  }
  if (typeof raw === "number") {
    return new DateTime(new Date(raw));
  }
  if (typeof raw === "string") {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      return new DateTime(parsed);
    }
  }
  return null;
}

function pickString(data: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "string" && value) {
      return value;
    }
  }
  return "";
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
