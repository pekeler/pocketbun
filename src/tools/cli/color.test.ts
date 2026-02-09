// PocketBun-only: verifies Go-style format compatibility for CLI color output helpers.

import { describe, expect, test } from "bun:test";
import { green } from "./color.ts";

function stripAnsi(value: string): string {
  const esc = "\u001b";
  let result = "";

  for (let i = 0; i < value.length; i += 1) {
    const char = value[i];
    if (char !== esc || value[i + 1] !== "[") {
      result += char;
      continue;
    }

    let j = i + 2;
    while (j < value.length) {
      const code = value[j];
      if (code === "m") {
        i = j;
        break;
      }

      if ((code ?? "") >= "0" && (code ?? "") <= "9") {
        j += 1;
        continue;
      }

      if (code === ";") {
        j += 1;
        continue;
      }

      // Not a CSI SGR sequence; keep the original char.
      result += char;
      break;
    }
  }

  return result;
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
