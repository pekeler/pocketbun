// Ported from pocketbase/tools/auth/wakatime.go (provider defaults only).

import { Providers, wrapFactory } from "./auth.ts";
import { BaseProvider } from "./base_provider.ts";

// NameWakatime is the unique name of the Wakatime provider.
export const NameWakatime = "wakatime";

// Wakatime is an auth provider for Wakatime.
export class Wakatime extends BaseProvider {
  constructor() {
    super();
    this.setDefaults({
      displayName: "WakaTime",
      pkce: true,
      scopes: ["email"],
      authURL: "https://wakatime.com/oauth/authorize",
      tokenURL: "https://wakatime.com/oauth/token",
      userInfoURL: "https://wakatime.com/api/v1/users/current",
    });
  }
}

Providers[NameWakatime] = wrapFactory(() => new Wakatime());
