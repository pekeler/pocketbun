// Ported from pocketbase/tools/auth/strava.go (provider defaults only).

import { Providers, wrapFactory } from "./auth.ts";
import { BaseProvider } from "./base_provider.ts";

// NameStrava is the unique name of the Strava provider.
export const NameStrava = "strava";

// Strava allows authentication via Strava OAuth2.
export class Strava extends BaseProvider {
  constructor() {
    super();
    this.setDefaults({
      displayName: "Strava",
      pkce: true,
      scopes: ["profile:read_all"],
      authURL: "https://www.strava.com/oauth/authorize",
      tokenURL: "https://www.strava.com/api/v3/oauth/token",
      userInfoURL: "https://www.strava.com/api/v3/athlete",
    });
  }
}

Providers[NameStrava] = wrapFactory(() => new Strava());
