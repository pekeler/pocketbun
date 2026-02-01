// Ported from pocketbase/tools/auth/spotify.go (provider defaults only).

import { Providers, wrapFactory } from "./auth.ts";
import { BaseProvider } from "./base_provider.ts";

export const NameSpotify = "spotify";

export class Spotify extends BaseProvider {
  constructor() {
    super();
    this.setDefaults({
      displayName: "Spotify",
      pkce: true,
      scopes: ["user-read-private"],
      authURL: "https://accounts.spotify.com/authorize",
      tokenURL: "https://accounts.spotify.com/api/token",
      userInfoURL: "https://api.spotify.com/v1/me",
    });
  }
}

Providers[NameSpotify] = wrapFactory(() => new Spotify());
