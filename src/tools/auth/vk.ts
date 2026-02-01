// Ported from pocketbase/tools/auth/vk.go (provider defaults only).

import { Providers, wrapFactory } from "./auth.ts";
import { BaseProvider } from "./base_provider.ts";

export const NameVK = "vk";

export class VK extends BaseProvider {
  constructor() {
    super();
    this.setDefaults({
      displayName: "ВКонтакте",
      pkce: false,
      scopes: ["email"],
      authURL: "https://oauth.vk.com/authorize",
      tokenURL: "https://oauth.vk.com/access_token",
      userInfoURL: "https://api.vk.com/method/users.get?fields=photo_max,screen_name&v=5.131",
    });
  }
}

Providers[NameVK] = wrapFactory(() => new VK());
