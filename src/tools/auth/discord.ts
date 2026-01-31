// Ported from pocketbase/tools/auth/discord.go (provider defaults only).

import { BaseProvider } from "./base_provider.ts";
import { Providers, wrapFactory } from "./auth.ts";

export const NameDiscord = "discord";

export class Discord extends BaseProvider {
  constructor() {
    super();
    this.setDefaults({
      displayName: "Discord",
      pkce: true,
      scopes: ["identify", "email"],
      authURL: "https://discord.com/api/oauth2/authorize",
      tokenURL: "https://discord.com/api/oauth2/token",
      userInfoURL: "https://discord.com/api/users/@me",
    });
  }
}

Providers[NameDiscord] = wrapFactory(() => new Discord());
