// Ported from pocketbase/tools/auth/lark.go (provider defaults only).

import { BaseProvider } from "./base_provider.ts";
import { Providers, wrapFactory } from "./auth.ts";

export const NameLark = "lark";

export class Lark extends BaseProvider {
  constructor() {
    super();
    this.setDefaults({
      displayName: "Lark",
      pkce: true,
      authURL: "https://accounts.feishu.cn/open-apis/authen/v1/authorize",
      tokenURL: "https://open.feishu.cn/open-apis/authen/v2/oauth/token",
      userInfoURL: "https://open.feishu.cn/open-apis/authen/v1/user_info",
    });
  }
}

Providers[NameLark] = wrapFactory(() => new Lark());
