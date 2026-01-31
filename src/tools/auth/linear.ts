// Ported from pocketbase/tools/auth/linear.go (provider defaults only).

import { BaseProvider } from "./base_provider.ts";
import { Providers, wrapFactory } from "./auth.ts";

export const NameLinear = "linear";

export class Linear extends BaseProvider {
  constructor() {
    super();
    this.setDefaults({
      displayName: "Linear",
      pkce: false,
      scopes: ["read"],
      authURL: "https://linear.app/oauth/authorize",
      tokenURL: "https://api.linear.app/oauth/token",
      userInfoURL: "https://api.linear.app/graphql",
    });
  }
}

Providers[NameLinear] = wrapFactory(() => new Linear());
