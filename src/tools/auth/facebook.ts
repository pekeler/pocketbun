// Ported from pocketbase/tools/auth/facebook.go (provider defaults only).

import { Providers, wrapFactory } from "./auth.ts";
import { BaseProvider } from "./base_provider.ts";

export const NameFacebook = "facebook";

export class Facebook extends BaseProvider {
  constructor() {
    super();
    this.setDefaults({
      displayName: "Facebook",
      pkce: true,
      scopes: ["email"],
      authURL: "https://www.facebook.com/dialog/oauth",
      tokenURL: "https://graph.facebook.com/oauth/access_token",
      userInfoURL: "https://graph.facebook.com/me?fields=name,email,picture.type(large)",
    });
  }
}

Providers[NameFacebook] = wrapFactory(() => new Facebook());
