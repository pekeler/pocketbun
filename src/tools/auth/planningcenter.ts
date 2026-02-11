// Ported from pocketbase/tools/auth/planningcenter.go

import { ParseDateTime } from "../types/index.ts";
import { AuthUser, type OAuth2Token, Providers, wrapFactory } from "./auth.ts";
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

  // FetchAuthUser returns an AuthUser instance based on the Planningcenter's user api.
  //
  // API reference: https://developer.planning.center/docs/#/overview/authentication
  override async FetchAuthUser(token: OAuth2Token): Promise<AuthUser> {
    const data = await this.FetchRawUserInfo(token);
    const text = new TextDecoder().decode(data);
    const rawUser = parseRawUser(text);
    const extracted = parsePlanningcenterUser(text);

    if (extracted.Data.Attributes.Status !== "active") {
      throw new Error("the user is not active");
    }

    const user = new AuthUser({
      Id: extracted.Data.Id,
      Name: extracted.Data.Attributes.Name,
      AvatarURL: extracted.Data.Attributes.AvatarURL,
      RawUser: rawUser,
      AccessToken: resolveTokenString(token, "accessToken", "access_token"),
      RefreshToken: resolveTokenString(token, "refreshToken", "refresh_token"),
    });
    user.Expiry = ParseDateTime(token.expiry ?? null);

    return user;
  }
}

Providers[NamePlanningcenter] = wrapFactory(() => new Planningcenter());

function parseRawUser(raw: string): Record<string, unknown> {
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("invalid planningcenter oauth2 user payload");
  }

  return parsed as Record<string, unknown>;
}

function parsePlanningcenterUser(raw: string): {
  Data: {
    Id: string;
    Attributes: {
      Status: string;
      Name: string;
      AvatarURL: string;
    };
  };
} {
  const payload = parseRawUser(raw);
  const data = readObjectField(payload, "data", "invalid planningcenter oauth2 payload field data");
  const attributes = readObjectField(data, "attributes", "invalid planningcenter oauth2 payload field data.attributes");

  return {
    Data: {
      Id: readStringField(data, "id"),
      Attributes: {
        Status: readStringField(attributes, "status"),
        Name: readStringField(attributes, "name"),
        AvatarURL: readStringField(attributes, "avatar"),
      },
    },
  };
}

function readObjectField(payload: Record<string, unknown>, key: string, typeError: string): Record<string, unknown> {
  const value = payload[key];
  if (value == null) {
    return {};
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(typeError);
  }
  return value as Record<string, unknown>;
}

function readStringField(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (value == null) {
    return "";
  }
  if (typeof value !== "string") {
    throw new Error(`invalid planningcenter oauth2 payload field ${key}`);
  }
  return value;
}

function resolveTokenString(token: OAuth2Token, ...keys: string[]): string {
  for (const key of keys) {
    const value = token[key];
    if (typeof value === "string" && value) {
      return value;
    }
  }

  return "";
}
