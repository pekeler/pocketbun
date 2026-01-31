// Ported from pocketbase/tools/security/random.go

import { randomInt } from "node:crypto";
import { randomStringByRegex } from "./random_by_regex.ts";

const defaultAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

export function randomString(length: number, alphabet = defaultAlphabet): string {
  const chars = [] as string[];
  const max = alphabet.length;
  for (let i = 0; i < length; i += 1) {
    chars.push(alphabet[randomInt(0, max)] ?? "");
  }
  return chars.join("");
}

export function randomStringWithAlphabet(length: number, alphabet: string): string {
  return randomString(length, alphabet);
}

// PseudorandomString generates a non-crypto random string with the specified length.
export function pseudorandomString(length: number, alphabet = defaultAlphabet): string {
  if (length <= 0 || alphabet.length === 0) {
    return "";
  }
  const chars = [] as string[];
  const max = alphabet.length;
  for (let i = 0; i < length; i += 1) {
    const idx = Math.floor(Math.random() * max);
    chars.push(alphabet[idx] ?? "");
  }
  return chars.join("");
}

// PseudorandomStringWithAlphabet generates a non-crypto random string with the specified length.
export function pseudorandomStringWithAlphabet(length: number, alphabet: string): string {
  return pseudorandomString(length, alphabet);
}

export { randomStringByRegex };
