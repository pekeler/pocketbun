// Ported from pocketbase/tools/auth/mailcow.go (provider defaults only).

import { Providers, wrapFactory } from "./auth.ts";
import { BaseProvider } from "./base_provider.ts";

export const NameMailcow = "mailcow";

export class Mailcow extends BaseProvider {
  constructor() {
    super();
    this.setDefaults({
      displayName: "mailcow",
      pkce: true,
      scopes: ["profile"],
    });
  }
}

Providers[NameMailcow] = wrapFactory(() => new Mailcow());
