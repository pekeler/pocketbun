// Ported from pocketbase/tools/auth/apple.go

import { toBoolValue } from "../../internal/compat/cast.ts";
import { decodeUnverifiedJWT } from "../security/jwt.ts";
import { ParseDateTime } from "../types/index.ts";
import { AuthUser, type OAuth2Token, Providers, wrapFactory } from "./auth.ts";
import { BaseProvider } from "./base_provider.ts";
import { ValidateTokenSignature } from "./internal/jwk/jwk.ts";

// NameApple is the unique name of the Apple provider.
export const NameApple = "apple";

// idTokenLeeway is the optional leeway for the id_token timestamp fields validation.
//
// It can be changed externally using the PB_ID_TOKEN_LEEWAY env variable
// (the value must be in seconds, e.g. "PB_ID_TOKEN_LEEWAY=60" for 1 minute).
const idTokenLeewayMs = resolveIdTokenLeewayMs();

// Apple allows authentication via Apple OAuth2.
//
// OIDC differences: https://bitbucket.org/openid/connect/src/master/How-Sign-in-with-Apple-differs-from-OpenID-Connect.md.
export class Apple extends BaseProvider {
  private jwksURL: string;

  constructor() {
    super();
    this.setDefaults({
      displayName: "Apple",
      pkce: true,
      scopes: ["name", "email"],
      authURL: "https://appleid.apple.com/auth/authorize",
      tokenURL: "https://appleid.apple.com/auth/token",
    });
    this.jwksURL = "https://appleid.apple.com/auth/keys";
  }

  // FetchAuthUser returns an AuthUser instance based on the provided token.
  //
  // API reference: https://developer.apple.com/documentation/signinwithapple/authenticating-users-with-sign-in-with-apple#Retrieve-the-users-information-from-Apple-ID-servers.
  override async FetchAuthUser(token: OAuth2Token): Promise<AuthUser> {
    const data = await this.FetchRawUserInfo(token);
    const text = new TextDecoder().decode(data);
    const rawUser = parseRawUser(text);
    const extracted = parseAppleUser(text);

    const user = new AuthUser({
      Id: extracted.Id,
      Name: extracted.Name,
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

  // FetchRawUserInfo implements Provider.FetchRawUserInfo interface.
  //
  // Note that Apple doesn't have a UserInfo endpoint and claims about
  // the users are included in the id_token (without the name - see #7090).
  override async FetchRawUserInfo(token: OAuth2Token): Promise<Uint8Array> {
    const idToken = resolveTokenString(token, "id_token", "idToken");

    const claims = await this.parseAndVerifyIdToken(idToken);

    return new TextEncoder().encode(JSON.stringify(claims));
  }

  private async parseAndVerifyIdToken(idToken: string): Promise<Record<string, unknown>> {
    if (!idToken) {
      throw new Error("empty id_token");
    }

    // extract the token claims
    // ---
    const claims = parseIDTokenClaims(idToken);

    // validate common claims per https://developer.apple.com/documentation/sign_in_with_apple/sign_in_with_apple_rest_api/verifying_a_user#3383769
    // ---
    validateAppleClaims(claims, this.ClientId(), idTokenLeewayMs);

    // validate id_token signature
    //
    // note: this step could be technically considered optional because we trust
    // the token which is a result of direct TLS communication with the provider
    // (see also https://openid.net/specs/openid-connect-core-1_0.html#IDTokenValidation)
    // ---
    try {
      await ValidateTokenSignature(this.Context(), idToken, this.jwksURL);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`id_token validation failed: ${message}`);
    }

    return claims;
  }
}

Providers[NameApple] = wrapFactory(() => new Apple());

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
    throw new Error("invalid apple oauth2 user payload");
  }

  return parsed as Record<string, unknown>;
}

function parseAppleUser(raw: string): {
  EmailVerified: unknown;
  Email: string;
  Id: string;
  Name: string;
} {
  const payload = parseRawUser(raw);
  return {
    EmailVerified: payload.email_verified, // could be string or bool
    Email: readStringField(payload, "email"),
    Id: readStringField(payload, "sub"),
    // not returned at the time of writing and it is usually
    // manually populated in apis.recordAuthWithOAuth2
    Name: readStringField(payload, "name"),
  };
}

function parseIDTokenClaims(idToken: string): Record<string, unknown> {
  const claims = decodeUnverifiedJWT(idToken);
  if (!claims || typeof claims !== "object" || Array.isArray(claims)) {
    throw new Error("invalid id_token claims");
  }

  return claims as Record<string, unknown>;
}

function validateAppleClaims(claims: Record<string, unknown>, clientId: string, leewayMs: number): void {
  const nowSeconds = Date.now() / 1000;
  const leewaySeconds = leewayMs / 1000;

  const exp = readRequiredNumericClaim(claims, "exp");
  if (nowSeconds > exp + leewaySeconds) {
    throw new Error("token is expired");
  }

  const iat = readNumericClaim(claims, "iat");
  if (iat !== null && nowSeconds + leewaySeconds < iat) {
    throw new Error("token used before issued");
  }

  const issuer = readStringField(claims, "iss");
  if (issuer !== "https://appleid.apple.com") {
    throw new Error(`iss must be https://appleid.apple.com, got ${JSON.stringify(claims.iss)}`);
  }

  if (!hasAudience(claims.aud, clientId)) {
    throw new Error(`aud must include ${JSON.stringify(clientId)}, got ${JSON.stringify(claims.aud)}`);
  }
}

function hasAudience(rawAudience: unknown, clientId: string): boolean {
  const audiences = parseAudience(rawAudience);
  for (const audience of audiences) {
    if (audience === clientId) {
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
    throw new Error(`invalid apple oauth2 payload field ${key}`);
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

function readRequiredNumericClaim(payload: Record<string, unknown>, key: string): number {
  const value = payload[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`missing or invalid ${key} claim`);
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
