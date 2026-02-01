// Ported from pocketbase/tools/auth/gitea.go (provider defaults only).

import { Providers, wrapFactory } from "./auth.ts";
import { BaseProvider } from "./base_provider.ts";

// NameGitea is the unique name of the Gitea provider.
export const NameGitea = "gitea";

// Gitea allows authentication via Gitea OAuth2.
export class Gitea extends BaseProvider {
  constructor() {
    super();
    this.setDefaults({
      displayName: "Gitea",
      pkce: true,
      scopes: ["read:user", "user:email"],
      authURL: "https://gitea.com/login/oauth/authorize",
      tokenURL: "https://gitea.com/login/oauth/access_token",
      userInfoURL: "https://gitea.com/api/v1/user",
    });
  }
}

Providers[NameGitea] = wrapFactory(() => new Gitea());
