// Ported from pocketbase/tools/auth/oidc.go

import { toBoolValue, toStringValue } from "../../internal/compat/cast.ts";
import { Equal } from "../security/crypto.ts";
import { decodeUnverifiedJWT } from "../security/jwt.ts";
import { ParseDateTime } from "../types/index.ts";
import { AuthUser, type OAuth2Token, Providers, wrapFactory } from "./auth.ts";
import { BaseProvider } from "./base_provider.ts";
import { ValidateTokenSignature } from "./internal/jwk/jwk.ts";

// NameOIDC is the unique name of the OpenID Connect (OIDC) provider.
export const NameOIDC = "oidc";

// idTokenLeeway is the optional leeway for the id_token timestamp fields validation.
//
// It can be changed externally using the PB_ID_TOKEN_LEEWAY env variable
// (the value must be in seconds, e.g. "PB_ID_TOKEN_LEEWAY=60" for 1 minute).
const idTokenLeewayMs = resolveIdTokenLeewayMs();

// OIDC allows authentication via OpenID Connect (OIDC) OAuth2 provider.
//
// If specified the user data is fetched from the userInfoURL.
// Otherwise - from the id_token payload.
//
// The provider support the following Extra config options:
//   - "jwksURL" - url to the keys to validate the id_token signature (optional and used only when reading the user data from the id_token)
//   - "issuers" - list of valid issuers for the iss id_token claim (optioanl and used only when reading the user data from the id_token)
export class OIDC extends BaseProvider {
  constructor() {
    super();
    this.setDefaults({
      displayName: "OIDC",
      pkce: true,
      scopes: ["openid", "email", "profile"],
    });
  }

  // FetchAuthUser returns an AuthUser instance based the provider's user api.
  //
  // API reference: https://openid.net/specs/openid-connect-core-1_0.html#StandardClaims
  override async FetchAuthUser(token: OAuth2Token): Promise<AuthUser> {
    const data = await this.FetchRawUserInfo(token);
    const text = new TextDecoder().decode(data);
    const rawUser = parseRawUser(text);
    const extracted = parseOIDCUser(text);

    const user = new AuthUser({
      Id: extracted.Id,
      Name: extracted.Name,
      Username: extracted.Username,
      AvatarURL: extracted.Picture,
      RawUser: rawUser,
      AccessToken: resolveTokenString(token, "accessToken", "access_token"),
      RefreshToken: resolveTokenString(token, "refreshToken", "refresh_token"),
    });
    user.Expiry = ParseDateTime(token.expiry ?? null);

    if (toBoolValue(extracted.EmailVerified)) {
      user.Email = extracted.Email;
    }

    return user;
  }

  // FetchRawUserInfo implements Provider.FetchRawUserInfo interface method.
  //
  // It either fetch the data from p.userInfoURL, or if not set - returns the id_token claims.
  override async FetchRawUserInfo(token: OAuth2Token): Promise<Uint8Array> {
    if (this.UserInfoURL()) {
      return super.FetchRawUserInfo(token);
    }

    const claims = await this.parseIdToken(token);

    return new TextEncoder().encode(JSON.stringify(claims));
  }

  private async parseIdToken(token: OAuth2Token): Promise<Record<string, unknown>> {
    const idToken = resolveTokenString(token, "id_token", "idToken");
    if (!idToken) {
      throw new Error("empty id_token");
    }

    const claims = parseIDTokenClaims(idToken);
    validateCommonClaims(claims, this.ClientId(), idTokenLeewayMs);

    // validate iss (if "issuers" extra config is set)
    const issuers = toStringSlice(this.Extra()?.issuers);
    if (issuers.length > 0) {
      let isIssValid = false;
      const claimIssuer = typeof claims.iss === "string" ? claims.iss : "";

      for (const issuer of issuers) {
        if (Equal(claimIssuer, issuer)) {
          isIssValid = true;
          break;
        }
      }

      if (!isIssValid) {
        throw new Error(`iss must be one of ${JSON.stringify(issuers)}, got ${JSON.stringify(claims.iss)}`);
      }
    }

    // validate signature (if "jwksURL" extra config is set)
    //
    // note: this step could be technically considered optional because we trust
    // the token which is a result of direct TLS communication with the provider
    // (see also https://openid.net/specs/openid-connect-core-1_0.html#IDTokenValidation)
    const jwksURL = toStringValue(this.Extra()?.jwksURL);
    if (jwksURL) {
      try {
        await ValidateTokenSignature(this.Context(), idToken, jwksURL);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`id_token validation failed: ${message}`);
      }
    }

    return claims;
  }
}

Providers[NameOIDC] = wrapFactory(() => new OIDC());
Providers[NameOIDC + "2"] = wrapFactory(() => new OIDC());
Providers[NameOIDC + "3"] = wrapFactory(() => new OIDC());

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

function parseRawUser(raw: string): Record<string, unknown> {
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("invalid oidc oauth2 user payload");
  }

  return parsed as Record<string, unknown>;
}

function parseOIDCUser(raw: string): {
  Id: string;
  Name: string;
  Username: string;
  Picture: string;
  Email: string;
  EmailVerified: unknown;
} {
  const payload = parseRawUser(raw);
  return {
    Id: readStringField(payload, "sub"),
    Name: readStringField(payload, "name"),
    Username: readStringField(payload, "preferred_username"),
    Picture: readStringField(payload, "picture"),
    Email: readStringField(payload, "email"),
    EmailVerified: payload.email_verified,
  };
}

function parseIDTokenClaims(idToken: string): Record<string, unknown> {
  const claims = decodeUnverifiedJWT(idToken);
  if (!claims || typeof claims !== "object" || Array.isArray(claims)) {
    throw new Error("invalid id_token claims");
  }

  return claims as Record<string, unknown>;
}

function validateCommonClaims(claims: Record<string, unknown>, clientId: string, leewayMs: number): void {
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

  if (!hasAudience(claims.aud, clientId)) {
    throw new Error(`aud must include ${JSON.stringify(clientId)}, got ${JSON.stringify(claims.aud)}`);
  }
}

function hasAudience(rawAudience: unknown, clientId: string): boolean {
  const audiences = parseAudience(rawAudience);
  for (const audience of audiences) {
    if (Equal(audience, clientId)) {
      return true;
    }
  }

  return false;
}

function parseAudience(rawAudience: unknown): string[] {
  if (typeof rawAudience === "string") {
    return [rawAudience];
  }

  if (Array.isArray(rawAudience)) {
    const result: string[] = [];
    for (const entry of rawAudience) {
      if (typeof entry !== "string") {
        throw new Error("invalid aud claim type");
      }
      result.push(entry);
    }
    return result;
  }

  if (rawAudience == null) {
    return [];
  }

  throw new Error("invalid aud claim type");
}

function readStringField(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (value == null) {
    return "";
  }
  if (typeof value !== "string") {
    throw new Error(`invalid oidc oauth2 payload field ${key}`);
  }
  return value;
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

function toStringSlice(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => toStringValue(item));
  }
  if (value == null) {
    return [];
  }

  return [toStringValue(value)];
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
