// Ported from pocketbase/tools/auth/bitbucket.go

import { ParseDateTime } from "../types/index.ts";
import { AuthUser, type OAuth2Token, Providers, wrapFactory } from "./auth.ts";
import { BaseProvider } from "./base_provider.ts";

// NameBitbucket is the unique name of the Bitbucket provider.
export const NameBitbucket = "bitbucket";

// Bitbucket is an auth provider for Bitbucket.
export class Bitbucket extends BaseProvider {
  constructor() {
    super();
    this.setDefaults({
      displayName: "Bitbucket",
      pkce: false,
      scopes: ["account"],
      authURL: "https://bitbucket.org/site/oauth2/authorize",
      tokenURL: "https://bitbucket.org/site/oauth2/access_token",
      userInfoURL: "https://api.bitbucket.org/2.0/user",
    });
  }

  // FetchAuthUser returns an AuthUser instance based on the Bitbucket's user API.
  //
  // API reference: https://developer.atlassian.com/cloud/bitbucket/rest/api-group-users/#api-user-get
  override async FetchAuthUser(token: OAuth2Token): Promise<AuthUser> {
    const data = await this.FetchRawUserInfo(token);
    const text = new TextDecoder().decode(data);
    const rawUser = parseRawUser(text);
    const extracted = parseBitbucketUser(text);

    if (extracted.AccountStatus !== "active") {
      throw new Error("the Bitbucket user is not active");
    }

    const email = await this.fetchPrimaryEmail(token);

    const user = new AuthUser({
      Id: extracted.UUID,
      Name: extracted.DisplayName,
      Username: extracted.Username,
      Email: email,
      AvatarURL: extracted.Links.Avatar.Href,
      RawUser: rawUser,
      AccessToken: resolveTokenString(token, "accessToken", "access_token"),
      RefreshToken: resolveTokenString(token, "refreshToken", "refresh_token"),
    });
    user.Expiry = ParseDateTime(token.expiry ?? null);

    return user;
  }

  // fetchPrimaryEmail sends an API request to retrieve the first
  // verified primary email.
  //
  // NB! This method can succeed and still return an empty email.
  // Error responses that are result of insufficient scopes permissions are ignored.
  //
  // API reference: https://developer.atlassian.com/cloud/bitbucket/rest/api-group-users/#api-user-emails-get
  private async fetchPrimaryEmail(token: OAuth2Token): Promise<string> {
    const userInfoURL = this.UserInfoURL();
    if (!userInfoURL) {
      return "";
    }

    const headers = new Headers();
    const accessToken = resolveTokenString(token, "accessToken", "access_token");
    if (accessToken) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }

    const response = await this.Client(token)(`${userInfoURL}/emails`, {
      headers,
    });

    // Ignore common HTTP errors caused by insufficient scope permissions
    // (the email field is optional, aka. return the auth user without it).
    if (response.status >= 400) {
      return "";
    }

    const values = parseBitbucketEmails(await response.text());
    for (const value of values) {
      if (value.IsPrimary) {
        return value.Email;
      }
    }

    return "";
  }
}

Providers[NameBitbucket] = wrapFactory(() => new Bitbucket());

function parseRawUser(raw: string): Record<string, unknown> {
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("invalid bitbucket oauth2 user payload");
  }

  return parsed as Record<string, unknown>;
}

function parseBitbucketUser(raw: string): {
  UUID: string;
  Username: string;
  DisplayName: string;
  AccountStatus: string;
  Links: {
    Avatar: {
      Href: string;
    };
  };
} {
  const payload = parseRawUser(raw);
  return {
    UUID: readStringField(payload, "uuid"),
    Username: readStringField(payload, "username"),
    DisplayName: readStringField(payload, "display_name"),
    AccountStatus: readStringField(payload, "account_status"),
    Links: {
      Avatar: {
        Href: readAvatarHref(payload),
      },
    },
  };
}

function parseBitbucketEmails(raw: string): Array<{
  Email: string;
  IsPrimary: boolean;
}> {
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("invalid bitbucket oauth2 emails payload");
  }

  const values = (parsed as Record<string, unknown>).values;
  if (!Array.isArray(values)) {
    throw new Error("invalid bitbucket oauth2 emails payload field values");
  }

  return values.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error("invalid bitbucket oauth2 emails payload entry");
    }

    const row = entry as Record<string, unknown>;
    return {
      Email: readStringField(row, "email"),
      IsPrimary: readBoolField(row, "is_primary"),
    };
  });
}

function readAvatarHref(payload: Record<string, unknown>): string {
  const links = payload.links;
  if (links == null) {
    return "";
  }
  if (!links || typeof links !== "object" || Array.isArray(links)) {
    throw new Error("invalid bitbucket oauth2 payload field links");
  }

  const avatar = (links as Record<string, unknown>).avatar;
  if (avatar == null) {
    return "";
  }
  if (!avatar || typeof avatar !== "object" || Array.isArray(avatar)) {
    throw new Error("invalid bitbucket oauth2 payload field links.avatar");
  }

  const href = (avatar as Record<string, unknown>).href;
  if (href == null) {
    return "";
  }
  if (typeof href !== "string") {
    throw new Error("invalid bitbucket oauth2 payload field links.avatar.href");
  }

  return href;
}

function readStringField(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (value == null) {
    return "";
  }
  if (typeof value !== "string") {
    throw new Error(`invalid bitbucket oauth2 payload field ${key}`);
  }
  return value;
}

function readBoolField(payload: Record<string, unknown>, key: string): boolean {
  const value = payload[key];
  if (value == null) {
    return false;
  }
  if (typeof value !== "boolean") {
    throw new Error(`invalid bitbucket oauth2 payload field ${key}`);
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
