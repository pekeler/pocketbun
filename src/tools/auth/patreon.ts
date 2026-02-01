// Ported from pocketbase/tools/auth/patreon.go (provider defaults only).

import { Providers, wrapFactory } from "./auth.ts";
import { BaseProvider } from "./base_provider.ts";

export const NamePatreon = "patreon";

export class Patreon extends BaseProvider {
  constructor() {
    super();
    this.setDefaults({
      displayName: "Patreon",
      pkce: true,
      scopes: ["identity", "identity[email]"],
      authURL: "https://www.patreon.com/oauth2/authorize",
      tokenURL: "https://www.patreon.com/api/oauth2/token",
      userInfoURL:
        "https://www.patreon.com/api/oauth2/v2/identity?fields%5Buser%5D=full_name,email,vanity,image_url,is_email_verified",
    });
  }
}

Providers[NamePatreon] = wrapFactory(() => new Patreon());
