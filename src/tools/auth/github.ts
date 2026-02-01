// Ported from pocketbase/tools/auth/github.go (provider defaults only).

import { Providers, wrapFactory } from "./auth.ts";
import { BaseProvider } from "./base_provider.ts";

// NameGithub is the unique name of the Github provider.
export const NameGithub = "github";

// Github allows authentication via Github OAuth2.
export class Github extends BaseProvider {
  constructor() {
    super();
    this.setDefaults({
      displayName: "GitHub",
      pkce: true,
      scopes: ["read:user", "user:email"],
      authURL: "https://github.com/login/oauth/authorize",
      tokenURL: "https://github.com/login/oauth/access_token",
      userInfoURL: "https://api.github.com/user",
    });
  }
}

Providers[NameGithub] = wrapFactory(() => new Github());
