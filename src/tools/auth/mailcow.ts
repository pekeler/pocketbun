// Ported from pocketbase/tools/auth/mailcow.go (provider defaults only).

import { Providers, wrapFactory } from "./auth.ts";
import { BaseProvider } from "./base_provider.ts";

// NameMailcow is the unique name of the mailcow provider.
export const NameMailcow = "mailcow";

// Mailcow allows authentication via mailcow OAuth2.
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
