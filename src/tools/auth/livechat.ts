// Ported from pocketbase/tools/auth/livechat.go (provider defaults only).

import { Providers, wrapFactory } from "./auth.ts";
import { BaseProvider } from "./base_provider.ts";

// NameLivechat is the unique name of the Livechat provider.
export const NameLivechat = "livechat";

// Livechat allows authentication via Livechat OAuth2.
export class Livechat extends BaseProvider {
  constructor() {
    super();
    this.setDefaults({
      displayName: "LiveChat",
      pkce: true,
      scopes: [],
      authURL: "https://accounts.livechat.com/",
      tokenURL: "https://accounts.livechat.com/token",
      userInfoURL: "https://accounts.livechat.com/v2/accounts/me",
    });
  }
}

Providers[NameLivechat] = wrapFactory(() => new Livechat());
