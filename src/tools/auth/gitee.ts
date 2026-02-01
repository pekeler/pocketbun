// Ported from pocketbase/tools/auth/gitee.go (provider defaults only).

import { Providers, wrapFactory } from "./auth.ts";
import { BaseProvider } from "./base_provider.ts";

// NameGitee is the unique name of the Gitee provider.
export const NameGitee = "gitee";

// Gitee allows authentication via Gitee OAuth2.
export class Gitee extends BaseProvider {
  constructor() {
    super();
    this.setDefaults({
      displayName: "Gitee",
      pkce: true,
      scopes: ["user_info", "emails"],
      authURL: "https://gitee.com/oauth/authorize",
      tokenURL: "https://gitee.com/oauth/token",
      userInfoURL: "https://gitee.com/api/v5/user",
    });
  }
}

Providers[NameGitee] = wrapFactory(() => new Gitee());
