// Ported from pocketbase/tools/auth/instagram.go (provider defaults only).

import { Providers, wrapFactory } from "./auth.ts";
import { BaseProvider } from "./base_provider.ts";

export const NameInstagram = "instagram2";

export class Instagram extends BaseProvider {
  constructor() {
    super();
    this.setDefaults({
      displayName: "Instagram",
      pkce: true,
      scopes: ["instagram_business_basic"],
      authURL: "https://www.instagram.com/oauth/authorize",
      tokenURL: "https://api.instagram.com/oauth/access_token",
      userInfoURL:
        "https://graph.instagram.com/me?fields=id,username,account_type,user_id,name,profile_picture_url,followers_count,follows_count,media_count",
    });
  }
}

Providers[NameInstagram] = wrapFactory(() => new Instagram());
