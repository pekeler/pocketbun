// Ported from pocketbase/tools/auth/google.go (provider defaults only).

import { Providers, wrapFactory } from "./auth.ts";
import { BaseProvider } from "./base_provider.ts";

export const NameGoogle = "google";

export class Google extends BaseProvider {
  constructor() {
    super();
    this.setDefaults({
      displayName: "Google",
      pkce: true,
      scopes: ["https://www.googleapis.com/auth/userinfo.profile", "https://www.googleapis.com/auth/userinfo.email"],
      authURL: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenURL: "https://oauth2.googleapis.com/token",
      userInfoURL: "https://www.googleapis.com/oauth2/v3/userinfo",
    });
  }
}

Providers[NameGoogle] = wrapFactory(() => new Google());
