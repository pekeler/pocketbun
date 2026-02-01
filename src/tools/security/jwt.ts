// Ported from pocketbase/tools/security/jwt.go

import { createHmac, timingSafeEqual } from "node:crypto";

export type JwtClaims = Record<string, unknown>;

export function parseUnverifiedJWT(token: string): JwtClaims {
  const { payload } = decodeToken(token);
  validateClaims(payload);
  return payload;
}

export function decodeUnverifiedJWT(token: string): JwtClaims {
  const { payload } = decodeToken(token);
  return payload;
}

export function parseJWT(token: string, verificationKey: string): JwtClaims {
  const { header, payload, signature, signingInput } = decodeToken(token);

  if (header.alg !== "HS256") {
    throw new Error("unsupported jwt algorithm");
  }

  const expected = signHmac(signingInput, verificationKey);
  if (!safeEqual(expected, signature)) {
    throw new Error("invalid jwt signature");
  }

  validateClaims(payload);
  return payload;
}

export function newJWT(payload: JwtClaims, signingKey: string, durationSeconds: number): string {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const claims: JwtClaims = {
    exp: nowSeconds + durationSeconds,
    ...payload,
  };

  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(claims));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = base64UrlEncode(signHmac(signingInput, signingKey));
  return `${signingInput}.${signature}`;
}

function decodeToken(token: string): {
  header: Record<string, unknown>;
  payload: JwtClaims;
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
  const header = parseJson(headerPart);
  const payload = parseJson(payloadPart);
  const signature = base64UrlDecode(signaturePart);
  return {
    header,
    payload,
    signature,
    signingInput: `${headerPart}.${payloadPart}`,
  };
}

function parseJson(part: string): Record<string, unknown> {
  const decoded = base64UrlDecode(part).toString("utf8");
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

function validateClaims(claims: JwtClaims): void {
  const nowSeconds = Math.floor(Date.now() / 1000);

  const exp = normalizeNumericClaim(claims.exp);
  if (exp !== null && nowSeconds >= exp) {
    throw new Error("token is expired");
  }

  const nbf = normalizeNumericClaim(claims.nbf);
  if (nbf !== null && nowSeconds < nbf) {
    throw new Error("token not active yet");
  }

  const iat = normalizeNumericClaim(claims.iat);
  if (iat !== null && iat > nowSeconds) {
    throw new Error("token used before issued");
  }
}

function normalizeNumericClaim(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function signHmac(input: string, key: string): Buffer {
  return createHmac("sha256", key).update(input).digest();
}

function safeEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

function base64UrlEncode(input: string | Buffer): string {
  const buffer = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buffer.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function base64UrlDecode(input: string): Buffer {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(normalized + padding, "base64");
}
