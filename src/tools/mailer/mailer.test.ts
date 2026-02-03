// Ported from pocketbase/tools/mailer/mailer_test.go

import { describe, expect, it } from "bun:test";
import { addressesToStrings, detectReaderMimeType } from "./mailer.ts";

function createAddress(name: string, address: string) {
  return name ? { Name: name, Address: address } : { Address: address };
}

describe("addressesToStrings", () => {
  it("converts addresses", () => {
    const scenarios = [
      {
        withName: true,
        addresses: [createAddress("John Doe", "test1@example.com"), createAddress("Jane Doe", "test2@example.com")],
        expected: [`"John Doe" <test1@example.com>`, `"Jane Doe" <test2@example.com>`],
      },
      {
        withName: true,
        addresses: [createAddress("John Doe", "test1@example.com"), createAddress("", "test2@example.com")],
        expected: [`"John Doe" <test1@example.com>`, `test2@example.com`],
      },
      {
        withName: false,
        addresses: [createAddress("John Doe", "test1@example.com"), createAddress("Jane Doe", "test2@example.com")],
        expected: [`test1@example.com`, `test2@example.com`],
      },
    ];

    for (const scenario of scenarios) {
      const result = addressesToStrings(scenario.addresses, scenario.withName);

      expect(result.length).toBe(scenario.expected.length);

      for (const [index, expected] of scenario.expected.entries()) {
        expect(result[index]).toBe(expected);
      }
    }
  });
});

describe("detectReaderMimeType", () => {
  it("detects mime and preserves content", () => {
    const str = "#!/bin/node\n" + "a".repeat(10000);

    const [reader, mime, err] = detectReaderMimeType(str);
    if (err) {
      throw err;
    }

    expect(mime).toBe("text/javascript");

    const raw = new TextDecoder().decode(reader);
    expect(raw).toBe(str);
  });
});
