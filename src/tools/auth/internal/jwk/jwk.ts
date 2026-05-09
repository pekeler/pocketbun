// Ported from pocketbase/tools/auth/internal/jwk/jwk.go

import { createPublicKey, type KeyObject, verify } from "node:crypto";

export class JWK {
  Kty = "";
  Kid = "";
  Use = "";
  Alg = "";
  E = "";
  N = "";
  Crv = "";
  X = "";

  // PublicKey reconstructs and returns the public key from the current JWK.
  PublicKey(): KeyObject {
    switch (this.Kty) {
      case "RSA": {
        decodeBase64Url(this.E);
        decodeBase64Url(this.N);
        return createPublicKey({ key: this.toJSON(), format: "jwk" });
      }
      case "OKP": {
        if (this.Crv !== "Ed25519") {
          throw new Error(`unsupported OKP curve (must be Ed25519): ${JSON.stringify(this.Crv)}`);
        }

        const x = decodeBase64Url(this.X);
        if (x.length !== 32) {
          throw new Error(`invalid Ed25519 key length: ${x.length}`);
        }

        return createPublicKey({ key: this.toJSON(), format: "jwk" });
      }
      default:
        throw new Error(`unsupported kty (must be RSA or OKP): ${JSON.stringify(this.Kty)}`);
    }
  }

  toJSON(): Record<string, string> {
    return {
      kty: this.Kty,
      kid: this.Kid,
      use: this.Use,
      alg: this.Alg,
      e: this.E,
      n: this.N,
      crv: this.Crv,
      x: this.X,
    };
  }
}

// Fetch retrieves the JSON Web Key Set located at jwksURL and returns
// the first key that matches the specified kid.
export async function Fetch(ctx: unknown, jwksURL: string, kid: string): Promise<JWK> {
  const res = await fetch(jwksURL, { method: "GET", signal: resolveAbortSignal(ctx) });
  const rawBody = await res.text();

  // fetch doesn't treat non 2xx responses as error
  if (res.status >= 400) {
    throw new Error(`failed to fetch JSON Web Key Set from ${jwksURL} (${res.status}):\n${rawBody}`);
  }

  const jwks = JSON.parse(rawBody) as { keys?: unknown };

  const keys = Array.isArray(jwks.keys) ? jwks.keys : [];
  for (const rawKey of keys) {
    const parsed = parseJWK(rawKey);
    if (parsed.Kid === kid && parsed.Alg !== "") {
      return parsed;
    }
  }

  throw new Error(`missing JWK with kid ${JSON.stringify(kid)} and non-empty alg`);
}

// ValidateTokenSignature validates the signature of a token with the
// public key retrieved from a remote JWKS.
export async function ValidateTokenSignature(ctx: unknown, token: string, jwksURL: string): Promise<void> {
  const { header, signature, signingInput } = parseJwtHeader(token);

  const kid = typeof header.kid === "string" ? header.kid : "";
  if (!kid) {
    throw new Error("missing kid header value");
  }

  const key = await Fetch(ctx, jwksURL, kid);

  const alg = typeof header.alg === "string" ? header.alg : "";
  if (!alg || (key.Alg && key.Alg !== alg)) {
    throw new Error("invalid jwt algorithm");
  }

  const publicKey = key.PublicKey();
  const valid = verifySignature(alg, Buffer.from(signingInput, "utf8"), publicKey, signature);

  if (!valid) {
    throw new Error("the parsed token is invalid");
  }
}

function resolveAbortSignal(ctx: unknown): AbortSignal | undefined {
  if (!ctx) {
    return undefined;
  }
  return ctx instanceof AbortSignal ? ctx : undefined;
}

function parseJWK(raw: unknown): JWK {
  const value = (raw ?? {}) as Record<string, unknown>;
  const key = new JWK();
  key.Kty = pickString(value, "kty");
  key.Kid = pickString(value, "kid");
  key.Use = pickString(value, "use");
  key.Alg = pickString(value, "alg");
  key.E = pickString(value, "e");
  key.N = pickString(value, "n");
  key.Crv = pickString(value, "crv");
  key.X = pickString(value, "x");
  return key;
}

function pickString(value: Record<string, unknown>, key: string): string {
  const raw = value[key];
  return typeof raw === "string" ? raw : "";
}

function parseJwtHeader(token: string): {
  header: Record<string, unknown>;
  signature: Buffer;
  signingInput: string;
} {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("invalid jwt format");
  }

  const [headerPart, payloadPart, signaturePart] = parts;
  if (!headerPart || !payloadPart || !signaturePart) {
    throw new Error("invalid jwt format");
  }

  const header = parseJwtJson(headerPart);
  const signature = decodeBase64Url(signaturePart);

  return { header, signature, signingInput: `${headerPart}.${payloadPart}` };
}

function parseJwtJson(part: string): Record<string, unknown> {
  const decoded = decodeBase64Url(part).toString("utf8");
  try {
    const parsed = JSON.parse(decoded);
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // fallthrough
  }
  throw new Error("invalid jwt json");
}

function verifySignature(alg: string, data: Buffer, key: KeyObject, signature: Buffer): boolean {
  switch (alg) {
    case "RS256":
      return verify("RSA-SHA256", data, key, signature);
    case "EdDSA":
      return verify(null, data, key, signature);
    default:
      throw new Error(`unsupported jwt algorithm: ${alg}`);
  }
}

function decodeBase64Url(input: string): Buffer {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(normalized + padding, "base64");
}
