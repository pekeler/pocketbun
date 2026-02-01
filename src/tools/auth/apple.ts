// Ported from pocketbase/tools/auth/apple.go (provider defaults only).

import { Providers, wrapFactory } from "./auth.ts";
import { BaseProvider } from "./base_provider.ts";

// NameApple is the unique name of the Apple provider.
export const NameApple = "apple";

// Apple allows authentication via Apple OAuth2.
//
// OIDC differences: https://bitbucket.org/openid/connect/src/master/How-Sign-in-with-Apple-differs-from-OpenID-Connect.md.
export class Apple extends BaseProvider {
  constructor() {
    super();
    this.setDefaults({
      displayName: "Apple",
      pkce: true,
      scopes: ["name", "email"],
      authURL: "https://appleid.apple.com/auth/authorize",
      tokenURL: "https://appleid.apple.com/auth/token",
    });
  }
}

Providers[NameApple] = wrapFactory(() => new Apple());
