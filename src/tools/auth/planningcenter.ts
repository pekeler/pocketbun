// Ported from pocketbase/tools/auth/planningcenter.go (provider defaults only).

import { BaseProvider } from "./base_provider.ts";
import { Providers, wrapFactory } from "./auth.ts";

export const NamePlanningcenter = "planningcenter";

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
