// Ported from pocketbase/tools/auth/gitlab.go (provider defaults only).

import { BaseProvider } from "./base_provider.ts";
import { Providers, wrapFactory } from "./auth.ts";

export const NameGitlab = "gitlab";

export class Gitlab extends BaseProvider {
  constructor() {
    super();
    this.setDefaults({
      displayName: "GitLab",
      pkce: true,
      scopes: ["read_user"],
      authURL: "https://gitlab.com/oauth/authorize",
      tokenURL: "https://gitlab.com/oauth/token",
      userInfoURL: "https://gitlab.com/api/v4/user",
    });
  }
}

Providers[NameGitlab] = wrapFactory(() => new Gitlab());
