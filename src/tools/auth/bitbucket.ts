// Ported from pocketbase/tools/auth/bitbucket.go (provider defaults only).

import { Providers, wrapFactory } from "./auth.ts";
import { BaseProvider } from "./base_provider.ts";

// NameBitbucket is the unique name of the Bitbucket provider.
export const NameBitbucket = "bitbucket";

// Bitbucket is an auth provider for Bitbucket.
export class Bitbucket extends BaseProvider {
  constructor() {
    super();
    this.setDefaults({
      displayName: "Bitbucket",
      pkce: false,
      scopes: ["account"],
      authURL: "https://bitbucket.org/site/oauth2/authorize",
      tokenURL: "https://bitbucket.org/site/oauth2/access_token",
      userInfoURL: "https://api.bitbucket.org/2.0/user",
    });
  }
}

Providers[NameBitbucket] = wrapFactory(() => new Bitbucket());
