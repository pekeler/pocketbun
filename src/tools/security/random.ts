// Ported from pocketbase/tools/security/random.go

import { randomInt } from "node:crypto";

const defaultAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

export function randomString(length: number, alphabet = defaultAlphabet): string {
  const chars = [] as string[];
  const max = alphabet.length;
  for (let i = 0; i < length; i += 1) {
    chars.push(alphabet[randomInt(0, max)] ?? "");
  }
  return chars.join("");
}
