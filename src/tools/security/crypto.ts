// Ported from pocketbase/tools/security/crypto.go

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export function S256Challenge(code: string): string {
  const digest = createHash("sha256").update(code).digest();
  return digest.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function MD5(text: string): string {
  return createHash("md5").update(text).digest("hex");
}

export function SHA256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export function SHA512(text: string): string {
  return createHash("sha512").update(text).digest("hex");
}

export function HS256(text: string, secret: string): string {
  return createHmac("sha256", secret).update(text).digest("hex");
}

export function HS512(text: string, secret: string): string {
  return createHmac("sha512", secret).update(text).digest("hex");
}

export function Equal(hash1: string, hash2: string): boolean {
  if (hash1.length !== hash2.length) {
    return false;
  }
  return timingSafeEqual(Buffer.from(hash1), Buffer.from(hash2));
}
