// Ported from pocketbase/tools/auth/kakao.go (provider defaults only).

import { BaseProvider } from "./base_provider.ts";
import { Providers, wrapFactory } from "./auth.ts";

export const NameKakao = "kakao";

export class Kakao extends BaseProvider {
  constructor() {
    super();
    this.setDefaults({
      displayName: "Kakao",
      pkce: true,
      scopes: ["account_email", "profile_nickname", "profile_image"],
      authURL: "https://kauth.kakao.com/oauth/authorize",
      tokenURL: "https://kauth.kakao.com/oauth/token",
      userInfoURL: "https://kapi.kakao.com/v2/user/me",
    });
  }
}

Providers[NameKakao] = wrapFactory(() => new Kakao());
