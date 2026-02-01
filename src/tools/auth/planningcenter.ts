// Ported from pocketbase/tools/auth/planningcenter.go (provider defaults only).

import { Providers, wrapFactory } from "./auth.ts";
import { BaseProvider } from "./base_provider.ts";

// NamePlanningcenter is the unique name of the Planningcenter provider.
export const NamePlanningcenter = "planningcenter";

// Planningcenter allows authentication via Planningcenter OAuth2.
export class Planningcenter extends BaseProvider {
  constructor() {
    super();
    this.setDefaults({
      displayName: "Planning Center",
      pkce: true,
      scopes: ["people"],
      authURL: "https://api.planningcenteronline.com/oauth/authorize",
      tokenURL: "https://api.planningcenteronline.com/oauth/token",
      userInfoURL: "https://api.planningcenteronline.com/people/v2/me",
    });
  }
}

Providers[NamePlanningcenter] = wrapFactory(() => new Planningcenter());
