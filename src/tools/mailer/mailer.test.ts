// Ported from pocketbase/tools/mailer/mailer_test.go

import { describe, expect, it } from "bun:test";
import { addressesToStrings, detectReaderMimeType, type Message } from "./mailer.ts";
import { Sendmail } from "./sendmail.ts";

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

class MockSendmail extends Sendmail {
  commandPath = "";
  args: string[] = [];
  payload = "";

  protected override findCommandPath(): [string, Error | null] {
    return ["/mock/sendmail", null];
  }

  protected override runCommand(commandPath: string, args: string[], payload: string): Error | null {
    this.commandPath = commandPath;
    this.args = args;
    this.payload = payload;
    return null;
  }
}

describe("Sendmail", () => {
  it("serializes headers and body before invoking sendmail", () => {
    const client = new MockSendmail();

    const message: Message = {
      From: { Name: "PocketBun", Address: "noreply@example.com" },
      To: [{ Name: "John Doe", Address: "john@example.com" }, { Address: "jane@example.com" }],
      Bcc: [{ Address: "hidden@example.com" }],
      Cc: [{ Name: "Jane Doe", Address: "jane.cc@example.com" }],
      Subject: "Auth update",
      HTML: "<p>Hello from PocketBun</p>",
      Text: "",
      Headers: {},
      Attachments: {},
      InlineAttachments: {},
    };

    const err = client.Send(message);
    expect(err).toBeNull();

    expect(client.commandPath).toBe("/mock/sendmail");
    expect(client.args).toEqual(["-i", "-t"]);
    expect(client.payload).toContain("Subject: =?UTF-8?B?QXV0aCB1cGRhdGU=?=");
    expect(client.payload).toContain(`From: "PocketBun" <noreply@example.com>`);
    expect(client.payload).toContain("Content-Type: text/html; charset=UTF-8");
    expect(client.payload).toContain("To: john@example.com,jane@example.com");
    expect(client.payload).toContain("Cc: jane.cc@example.com");
    expect(client.payload).toContain("Bcc: hidden@example.com");
    expect(client.payload).toContain("\r\n\r\n<p>Hello from PocketBun</p>");
  });
});
