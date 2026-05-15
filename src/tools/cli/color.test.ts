// PocketBun-only: verifies Go-style format compatibility for CLI color output helpers.

import { describe, expect, spyOn, test } from "bun:test";
import { green } from "./color.ts";

const ansiPattern = new RegExp(String.raw`\u001b\[[0-9;]*m`, "g");

function stripAnsi(value: string): string {
  return value.replace(ansiPattern, "");
}

describe("cli color output", () => {
  test.serial("supports %q placeholders", () => {
    let output = "";
    using _stdoutWriteSpy = spyOn(process.stdout, "write").mockImplementation(((chunk: string | Uint8Array) => {
      output += typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk);
      return true;
    }) as typeof process.stdout.write);

    green("Successfully saved superuser %q!\n", "admin@example.com");

    expect(stripAnsi(output)).toBe('Successfully saved superuser "admin@example.com"!\n');
  });

  test.serial("keeps escaped percent markers intact", () => {
    let output = "";
    using _stdoutWriteSpy = spyOn(process.stdout, "write").mockImplementation(((chunk: string | Uint8Array) => {
      output += typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk);
      return true;
    }) as typeof process.stdout.write);

    green("value: %%q and %q\n", "x");

    expect(stripAnsi(output)).toBe('value: %q and "x"\n');
  });
});
