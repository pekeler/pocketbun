// Ported from pocketbase/tools/auth/notion.go (provider defaults only).

import { Providers, wrapFactory } from "./auth.ts";
import { BaseProvider } from "./base_provider.ts";

// NameNotion is the unique name of the Notion provider.
export const NameNotion = "notion";

// Notion allows authentication via Notion OAuth2.
export class Notion extends BaseProvider {
  constructor() {
    super();
    this.setDefaults({
      displayName: "Notion",
      pkce: true,
      authURL: "https://api.notion.com/v1/oauth/authorize",
      tokenURL: "https://api.notion.com/v1/oauth/token",
      userInfoURL: "https://api.notion.com/v1/users/me",
    });
  }
}

Providers[NameNotion] = wrapFactory(() => new Notion());
