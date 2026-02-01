// Ported from pocketbase/tools/auth/apple.go (provider defaults only).

import { Providers, wrapFactory } from "./auth.ts";
import { BaseProvider } from "./base_provider.ts";

export const NameApple = "apple";

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
