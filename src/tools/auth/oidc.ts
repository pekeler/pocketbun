// Ported from pocketbase/tools/auth/oidc.go (provider defaults only).

import { Providers, wrapFactory } from "./auth.ts";
import { BaseProvider } from "./base_provider.ts";

export const NameOIDC = "oidc";

export class OIDC extends BaseProvider {
  constructor() {
    super();
    this.setDefaults({
      displayName: "OIDC",
      pkce: true,
      scopes: ["openid", "email", "profile"],
    });
  }
}

Providers[NameOIDC] = wrapFactory(() => new OIDC());
Providers[NameOIDC + "2"] = wrapFactory(() => new OIDC());
Providers[NameOIDC + "3"] = wrapFactory(() => new OIDC());
