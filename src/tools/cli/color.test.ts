// PocketBun-only: verifies Go-style format compatibility for CLI color output helpers.

import { describe, expect, test } from "bun:test";
import { green } from "./color.ts";

const ansiPattern = new RegExp(String.raw`\u001b\[[0-9;]*m`, "g");

function stripAnsi(value: string): string {
  return value.replace(ansiPattern, "");
}

describe("cli color output", () => {
  test.serial("supports %q placeholders", () => {
    const originalWrite = process.stdout.write.bind(process.stdout);
    let output = "";

    process.stdout.write = ((chunk: string | Uint8Array) => {
      output += typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk);
      return true;
    }) as typeof process.stdout.write;

    try {
      green("Successfully saved superuser %q!\n", "admin@example.com");
    } finally {
      process.stdout.write = originalWrite;
    }

    expect(stripAnsi(output)).toBe('Successfully saved superuser "admin@example.com"!\n');
  });

  test.serial("keeps escaped percent markers intact", () => {
    const originalWrite = process.stdout.write.bind(process.stdout);
    let output = "";

    process.stdout.write = ((chunk: string | Uint8Array) => {
      output += typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk);
      return true;
    }) as typeof process.stdout.write;

    try {
      green("value: %%q and %q\n", "x");
    } finally {
      process.stdout.write = originalWrite;
    }

    expect(stripAnsi(output)).toBe('value: %q and "x"\n');
  });
});
