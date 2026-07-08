// Ported from pocketbase/tools/auth/microsoft.go

import { toBoolValue, toStringValue } from "../../internal/compat/cast.ts";
import { decodeUnverifiedJWT } from "../security/jwt.ts";
import { ParseDateTime } from "../types/index.ts";
import { AuthUser, type OAuth2Token, Providers, wrapFactory } from "./auth.ts";
import { BaseProvider } from "./base_provider.ts";

// NameMicrosoft is the unique name of the Microsoft provider.
export const NameMicrosoft = "microsoft";

// extraIdTokenEmailClaim is the name of the extra map entry that
// specifies which email extraction method to use
const extraIdTokenEmailClaim = "idTokenEmailClaim";

// idTokenLeeway is the optional leeway for the id_token timestamp fields validation.
//
// It can be changed externally using the PB_ID_TOKEN_LEEWAY env variable
// (the value must be in seconds, e.g. "PB_ID_TOKEN_LEEWAY=60" for 1 minute).
const idTokenLeewayMs = resolveIdTokenLeewayMs();

// Microsoft allows authentication via Azure AD/Entra ID OAuth2.
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

  // SetExtra implements Provider.SetExtra() interface method.
  //
  // If the [extraIdTokenEmailClaim] data is set it will also add "openid"
  // to the list of default scopes in order to be able to get an id_token.
  override SetExtra(data: Record<string, unknown> | null): void {
    super.SetExtra(data);

    if (toStringValue(data?.[extraIdTokenEmailClaim]) !== "") {
      const scopes = this.Scopes() ?? [];
      if (!scopes.includes("openid")) {
        this.SetScopes([...scopes, "openid"]);
      }
    }
  }

  // FetchAuthUser returns an AuthUser instance based on the Microsoft's user api.
  //
  // Graph explorer:  https://developer.microsoft.com/en-us/graph/graph-explorer
  // API reference:   https://learn.microsoft.com/en-us/graph/api/user-get
  // Optional claims: https://learn.microsoft.com/en-us/entra/identity-platform/optional-claims-reference
  override async FetchAuthUser(token: OAuth2Token): Promise<AuthUser> {
    // @todo with the future update to v2 endpoint consider skipping the request
    // if id_token is available (we need to make sure that the graph's id is the same as id_token's sub!)
    const data = await this.FetchRawUserInfo(token);
    const text = new TextDecoder().decode(data);
    const rawUser = parseRawUser(text);
    const extracted = parseMicrosoftUser(text);

    const user = new AuthUser({
      Id: extracted.Id,
      Name: extracted.Name,
      RawUser: rawUser,
      AccessToken: resolveTokenString(token, "accessToken", "access_token"),
      RefreshToken: resolveTokenString(token, "refreshToken", "refresh_token"),
    });
    user.Expiry = ParseDateTime(token.expiry ?? null);

    // decide which email to trust and assign
    switch (this.Extra()?.[extraIdTokenEmailClaim]) {
      case "any_verified":
        user.Email = this.extractIdTokenVerifiedPrimaryEmail(token);
        if (user.Email === "") {
          user.Email = this.extractIdTokenVerifiedXmsEdovEmail(token);
        }
        break;
      case "verified_primary_email":
        user.Email = this.extractIdTokenVerifiedPrimaryEmail(token);
        break;
      case "email_and_xms_edov":
        user.Email = this.extractIdTokenVerifiedXmsEdovEmail(token);
        break;
      case "email":
        user.Email = this.extractIdTokenEmail(token);
        break;
      default:
        // This is kept to avoid introducing breaking changes and generally
        // it is considered safe because the provider was originally created
        // for single-tenants apps. Furthermore the value is expected to be
        // synced with the id_token's `email` claim which since 2023
        // by *default* would be empty if it is unverified.
        user.Email = extracted.Mail;
        break;
    }

    return user;
  }

  private extractIdTokenClaims(trustedIdToken: OAuth2Token): Record<string, unknown> {
    const idToken = resolveTokenString(trustedIdToken, "id_token", "idToken");
    if (idToken === "") {
      throw new Error("empty id_token");
    }

    const claims = decodeUnverifiedJWT(idToken);
    validateIdTokenClaims(claims, idTokenLeewayMs);

    return claims;
  }

  private extractIdTokenVerifiedPrimaryEmail(trustedIdToken: OAuth2Token): string {
    try {
      const claims = this.extractIdTokenClaims(trustedIdToken);
      return readOptionalStringClaim(claims, "verified_primary_email");
    } catch {
      return "";
    }
  }

  private extractIdTokenVerifiedXmsEdovEmail(trustedIdToken: OAuth2Token): string {
    try {
      const claims = this.extractIdTokenClaims(trustedIdToken);
      if (!toBoolValue(claims.xms_edov)) {
        return "";
      }
      return readOptionalStringClaim(claims, "email");
    } catch {
      return "";
    }
  }

  private extractIdTokenEmail(trustedIdToken: OAuth2Token): string {
    try {
      const claims = this.extractIdTokenClaims(trustedIdToken);
      return readOptionalStringClaim(claims, "email");
    } catch {
      return "";
    }
  }
}

Providers[NameMicrosoft] = wrapFactory(() => new Microsoft());

function parseRawUser(raw: string): Record<string, unknown> {
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("invalid microsoft oauth2 user payload");
  }

  return parsed as Record<string, unknown>;
}

function parseMicrosoftUser(raw: string): {
  Id: string;
  Name: string;
  Mail: string;
} {
  const payload = parseRawUser(raw);
  return {
    Id: readStringField(payload, "id"),
    Name: readStringField(payload, "displayName"),
    Mail: readStringField(payload, "mail"),
  };
}

function readStringField(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (value == null) {
    return "";
  }
  if (typeof value !== "string") {
    throw new Error(`invalid microsoft oauth2 payload field ${key}`);
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

function resolveIdTokenLeewayMs(): number {
  const raw = process.env.PB_ID_TOKEN_LEEWAY;
  if (!raw) {
    return 5 * 60 * 1000;
  }

  const parsed = Number.parseInt(raw, 10);
  if (Number.isInteger(parsed)) {
    return parsed * 1000;
  }

  return 5 * 60 * 1000;
}

function validateIdTokenClaims(claims: Record<string, unknown>, leewayMs: number): void {
  const nowSeconds = Date.now() / 1000;
  const leewaySeconds = leewayMs / 1000;

  const exp = readNumericClaim(claims, "exp");
  if (exp !== null && nowSeconds > exp + leewaySeconds) {
    throw new Error("token is expired");
  }

  const nbf = readNumericClaim(claims, "nbf");
  if (nbf !== null && nowSeconds + leewaySeconds < nbf) {
    throw new Error("token not active yet");
  }

  const iat = readNumericClaim(claims, "iat");
  if (iat !== null && nowSeconds + leewaySeconds < iat) {
    throw new Error("token used before issued");
  }
}

function readNumericClaim(payload: Record<string, unknown>, key: string): number | null {
  const value = payload[key];
  if (value == null) {
    return null;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`invalid ${key} claim type`);
  }
  return value;
}

function readOptionalStringClaim(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  return typeof value === "string" ? value : "";
}
