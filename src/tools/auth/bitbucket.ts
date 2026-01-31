// Ported from pocketbase/tools/auth/bitbucket.go (provider defaults only).

import { BaseProvider } from "./base_provider.ts";
import { Providers, wrapFactory } from "./auth.ts";

export const NameBitbucket = "bitbucket";

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
