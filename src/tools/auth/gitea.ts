// Ported from pocketbase/tools/auth/gitea.go (provider defaults only).

import { BaseProvider } from "./base_provider.ts";
import { Providers, wrapFactory } from "./auth.ts";

export const NameGitea = "gitea";

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
