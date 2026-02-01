// Ported from pocketbase/tools/auth/oidc.go (provider defaults only).

import { Providers, wrapFactory } from "./auth.ts";
import { BaseProvider } from "./base_provider.ts";

// NameOIDC is the unique name of the OpenID Connect (OIDC) provider.
export const NameOIDC = "oidc";

// OIDC allows authentication via OpenID Connect (OIDC) OAuth2 provider.
//
// If specified the user data is fetched from the userInfoURL.
// Otherwise - from the id_token payload.
//
// The provider support the following Extra config options:
//   - "jwksURL" - url to the keys to validate the id_token signature (optional and used only when reading the user data from the id_token)
//   - "issuers" - list of valid issuers for the iss id_token claim (optioanl and used only when reading the user data from the id_token)
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
