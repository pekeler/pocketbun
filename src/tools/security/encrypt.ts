// Ported from pocketbase/tools/security/encrypt.go

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const GCM_NONCE_SIZE = 12;
const GCM_TAG_SIZE = 16;

function resolveKey(key: string): { keyBytes: Buffer; algorithm: string } {
  const keyBytes = Buffer.from(key);
  switch (keyBytes.length) {
    case 16:
      return { keyBytes, algorithm: "aes-128-gcm" };
    case 24:
      return { keyBytes, algorithm: "aes-192-gcm" };
    case 32:
      return { keyBytes, algorithm: "aes-256-gcm" };
    default:
      throw new Error("invalid encryption key length");
  }
}

export function encrypt(data: Uint8Array, key: string): string {
  const { keyBytes, algorithm } = resolveKey(key);
  const nonce = randomBytes(GCM_NONCE_SIZE);
  const cipher = createCipheriv(algorithm, keyBytes, nonce) as unknown as {
    update: (data: Uint8Array) => Buffer;
    final: () => Buffer;
    getAuthTag: () => Buffer;
  };
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const tag = cipher.getAuthTag();
  const combined = Buffer.concat([nonce, encrypted, tag]);
  return combined.toString("base64");
}

export function decrypt(cipherText: string, key: string): Uint8Array {
  const { keyBytes, algorithm } = resolveKey(key);
  const data = Buffer.from(cipherText, "base64");
  if (data.length < GCM_NONCE_SIZE + GCM_TAG_SIZE) {
    throw new Error("invalid cipher text");
  }
  const nonce = data.subarray(0, GCM_NONCE_SIZE);
  const tag = data.subarray(data.length - GCM_TAG_SIZE);
  const encrypted = data.subarray(GCM_NONCE_SIZE, data.length - GCM_TAG_SIZE);
  const decipher = createDecipheriv(algorithm, keyBytes, nonce) as unknown as {
    update: (data: Uint8Array) => Buffer;
    final: () => Buffer;
    setAuthTag: (tag: Buffer) => void;
  };
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return new Uint8Array(decrypted);
}
