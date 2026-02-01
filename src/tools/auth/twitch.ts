// Ported from pocketbase/tools/auth/twitch.go (provider defaults only).

import { Providers, wrapFactory } from "./auth.ts";
import { BaseProvider } from "./base_provider.ts";

// NameTwitch is the unique name of the Twitch provider.
export const NameTwitch = "twitch";

// Twitch allows authentication via Twitch OAuth2.
export class Twitch extends BaseProvider {
  constructor() {
    super();
    this.setDefaults({
      displayName: "Twitch",
      pkce: true,
      scopes: ["user:read:email"],
      authURL: "https://id.twitch.tv/oauth2/authorize",
      tokenURL: "https://id.twitch.tv/oauth2/token",
      userInfoURL: "https://api.twitch.tv/helix/users",
    });
  }
}

Providers[NameTwitch] = wrapFactory(() => new Twitch());
