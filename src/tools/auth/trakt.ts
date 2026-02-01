// Ported from pocketbase/tools/auth/trakt.go (provider defaults only).

import { Providers, wrapFactory } from "./auth.ts";
import { BaseProvider } from "./base_provider.ts";

export const NameTrakt = "trakt";

export class Trakt extends BaseProvider {
  constructor() {
    super();
    this.setDefaults({
      displayName: "Trakt",
      pkce: true,
      authURL: "https://trakt.tv/oauth/authorize",
      tokenURL: "https://api.trakt.tv/oauth/token",
      userInfoURL: "https://api.trakt.tv/users/settings",
    });
  }
}

Providers[NameTrakt] = wrapFactory(() => new Trakt());
