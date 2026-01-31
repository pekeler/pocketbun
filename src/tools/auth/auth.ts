// Ported from pocketbase/tools/auth/auth.go

export type ProviderFactoryFunc = () => Provider;

export const Providers: Record<string, ProviderFactoryFunc> = {};

export function newProviderByName(name: string): Provider {
  const factory = Providers[name];
  if (!factory) {
    throw new Error(`missing provider ${name}`);
  }
  return factory();
}

export interface Provider {
  Context(): unknown;
  SetContext(ctx: unknown): void;
  PKCE(): boolean;
  SetPKCE(enable: boolean): void;
  DisplayName(): string;
  SetDisplayName(displayName: string): void;
  Scopes(): string[];
  SetScopes(scopes: string[]): void;
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
  Extra(): Record<string, unknown>;
  SetExtra(data: Record<string, unknown>): void;
}

export function wrapFactory<T extends Provider>(factory: () => T): ProviderFactoryFunc {
  return () => factory();
}
