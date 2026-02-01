// Ported from pocketbase/tools/picker/modifiers.go

import { Tokenizer } from "../tokenizer/tokenizer.ts";

export type ModifierFactoryFunc = (...args: string[]) => Modifier;

export type Modifier = {
  Modify: (value: unknown) => unknown;
};

export const Modifiers: Record<string, ModifierFactoryFunc> = {};

export function initModifier(rawModifier: string): Modifier {
  const tokenizer = new Tokenizer(rawModifier);
  tokenizer.separators("(", ")", ",", " ");
  tokenizer.ignoreParenthesis(true);

  const parts = tokenizer.scanAll();
  if (parts.length === 0) {
    throw new Error(`invalid or empty modifier expression ${JSON.stringify(rawModifier)}`);
  }

  const name = parts[0] ?? "";
  const args = parts.slice(1);

  const factory = Modifiers[name];
  if (!factory) {
    throw new Error(`missing or invalid modifier ${JSON.stringify(name)}`);
  }

  return factory(...args);
}
