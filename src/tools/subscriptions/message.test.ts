// Ported from pocketbase/tools/subscriptions/message_test.go

import { describe, it } from "bun:test";
import { Message } from "./message.ts";

class StringWriter {
  #value = "";

  write(chunk: string | Uint8Array) {
    if (typeof chunk === "string") {
      this.#value += chunk;
      return;
    }
    this.#value += new TextDecoder().decode(chunk);
  }

  toString(): string {
    return this.#value;
  }
}

describe("subscriptions message", () => {
  it("WriteSSE", () => {
    const msg = new Message("test_name", "test_data");
    const writer = new StringWriter();

    msg.WriteSSE(writer, "test_id");

    const expected = "id:test_id\nevent:test_name\ndata:test_data\n\n";
    const actual = writer.toString();
    if (actual !== expected) {
      throw new Error(`Expected writer content\n${JSON.stringify(expected)}\ngot\n${JSON.stringify(actual)}`);
    }
  });
});
