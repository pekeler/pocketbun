// Ported from pocketbase/tools/auth/lark.go (provider defaults only).

import { Providers, wrapFactory } from "./auth.ts";
import { BaseProvider } from "./base_provider.ts";

// NameLark is the unique name of the Lark provider.
export const NameLark = "lark";

// Lark allows authentication via Lark OAuth2.
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
