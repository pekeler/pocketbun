// Ported from pocketbase/tools/auth/monday.go (provider defaults only).

import { BaseProvider } from "./base_provider.ts";
import { Providers, wrapFactory } from "./auth.ts";

export const NameMonday = "monday";

export class Monday extends BaseProvider {
  constructor() {
    super();
    this.setDefaults({
      displayName: "monday.com",
      pkce: true,
      scopes: ["me:read"],
      authURL: "https://auth.monday.com/oauth2/authorize",
      tokenURL: "https://auth.monday.com/oauth2/token",
      userInfoURL: "https://api.monday.com/v2",
    });
  }
}

Providers[NameMonday] = wrapFactory(() => new Monday());
