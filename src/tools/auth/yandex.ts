// Ported from pocketbase/tools/auth/yandex.go (provider defaults only).

import { Providers, wrapFactory } from "./auth.ts";
import { BaseProvider } from "./base_provider.ts";

export const NameYandex = "yandex";

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
