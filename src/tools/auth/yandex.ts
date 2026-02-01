// Ported from pocketbase/tools/auth/yandex.go (provider defaults only).

import { Providers, wrapFactory } from "./auth.ts";
import { BaseProvider } from "./base_provider.ts";

// NameYandex is the unique name of the Yandex provider.
export const NameYandex = "yandex";

// Yandex allows authentication via Yandex OAuth2.
export class Yandex extends BaseProvider {
  constructor() {
    super();
    this.setDefaults({
      displayName: "Yandex",
      pkce: true,
      scopes: ["login:email", "login:avatar", "login:info"],
      authURL: "https://oauth.yandex.ru/authorize",
      tokenURL: "https://oauth.yandex.ru/token",
      userInfoURL: "https://login.yandex.ru/info",
    });
  }
}

Providers[NameYandex] = wrapFactory(() => new Yandex());
