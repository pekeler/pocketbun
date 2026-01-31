// Ported from pocketbase/tools/auth/twitter.go (provider defaults only).

import { BaseProvider } from "./base_provider.ts";
import { Providers, wrapFactory } from "./auth.ts";

export const NameTwitter = "twitter";

export class Twitter extends BaseProvider {
  constructor() {
    super();
    this.setDefaults({
      displayName: "X/Twitter",
      pkce: true,
      scopes: ["users.read", "users.email", "tweet.read"],
      authURL: "https://x.com/i/oauth2/authorize",
      tokenURL: "https://api.x.com/2/oauth2/token",
      userInfoURL:
        "https://api.x.com/2/users/me?user.fields=id,name,username,profile_image_url,confirmed_email",
    });
  }
}

Providers[NameTwitter] = wrapFactory(() => new Twitter());
