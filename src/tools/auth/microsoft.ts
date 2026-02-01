// Ported from pocketbase/tools/auth/microsoft.go (provider defaults only).

import { Providers, wrapFactory } from "./auth.ts";
import { BaseProvider } from "./base_provider.ts";

// NameMicrosoft is the unique name of the Microsoft provider.
export const NameMicrosoft = "microsoft";

// Microsoft allows authentication via AzureADEndpoint OAuth2.
export class Microsoft extends BaseProvider {
  constructor() {
    super();
    this.setDefaults({
      displayName: "Microsoft",
      pkce: true,
      scopes: ["User.Read"],
      authURL: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
      tokenURL: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      userInfoURL: "https://graph.microsoft.com/v1.0/me",
    });
  }
}

Providers[NameMicrosoft] = wrapFactory(() => new Microsoft());
