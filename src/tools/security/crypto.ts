// Ported from pocketbase/tools/security/crypto.go

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

// S256Challenge creates base64 encoded sha256 challenge string derived from code.
// The padding of the result base64 string is stripped per [RFC 7636].
//
// [RFC 7636]: https://datatracker.ietf.org/doc/html/rfc7636#section-4.2
export function S256Challenge(code: string): string {
  const digest = createHash("sha256").update(code).digest();
  return digest.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

// MD5 creates md5 hash from the provided plain text.
export function MD5(text: string): string {
  return createHash("md5").update(text).digest("hex");
}

// SHA256 creates sha256 hash as defined in FIPS 180-4 from the provided text.
export function SHA256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

// SHA512 creates sha512 hash as defined in FIPS 180-4 from the provided text.
export function SHA512(text: string): string {
  return createHash("sha512").update(text).digest("hex");
}

// HS256 creates a HMAC hash with sha256 digest algorithm.
export function HS256(text: string, secret: string): string {
  return createHmac("sha256", secret).update(text).digest("hex");
}

// HS512 creates a HMAC hash with sha512 digest algorithm.
export function HS512(text: string, secret: string): string {
  return createHmac("sha512", secret).update(text).digest("hex");
}

// Equal compares two hash strings for equality without leaking timing information.
export function Equal(hash1: string, hash2: string): boolean {
  if (hash1.length !== hash2.length) {
    return false;
  }
  return timingSafeEqual(Buffer.from(hash1), Buffer.from(hash2));
}
