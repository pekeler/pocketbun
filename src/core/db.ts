// Ported from pocketbase/core/db.go (partial: id constants + helpers used so far).

import { pseudorandomStringWithAlphabet } from "../tools/security/random.ts";

export const DefaultIdLength = 15;
export const DefaultIdAlphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
export const DefaultIdRegex = /^\w+$/;

export function GenerateDefaultRandomId(): string {
  return pseudorandomStringWithAlphabet(DefaultIdLength, DefaultIdAlphabet);
}
