// Ported from pocketbase/tools/auth/box.go (provider defaults only).

import { Providers, wrapFactory } from "./auth.ts";
import { BaseProvider } from "./base_provider.ts";

export const NameBox = "box";

export class Box extends BaseProvider {
  constructor() {
    super();
    this.setDefaults({
      displayName: "Box",
      pkce: true,
      scopes: ["root_readonly"],
      authURL: "https://account.box.com/api/oauth2/authorize",
      tokenURL: "https://api.box.com/oauth2/token",
      userInfoURL: "https://api.box.com/2.0/users/me",
    });
  }
}

Providers[NameBox] = wrapFactory(() => new Box());
