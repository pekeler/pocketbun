// Ported from pocketbase/tests/mailer.go

import type { Mailer, Message } from "../src/tools/mailer/mailer.ts";

export class TestMailer implements Mailer {
  #messages: Message[] = [];

  Send(message: Message): Error | null {
    this.#messages.push(message);
    return null;
  }

  reset(): void {
    this.#messages = [];
  }

  Reset(): void {
    this.reset();
  }

  totalSend(): number {
    return this.#messages.length;
  }

  TotalSend(): number {
    return this.totalSend();
  }

  messages(): Message[] {
    return [...this.#messages];
  }

  Messages(): Message[] {
    return this.messages();
  }

  firstMessage(): Message {
    return this.#messages[0] ?? emptyMessage();
  }

  FirstMessage(): Message {
    return this.firstMessage();
  }

  lastMessage(): Message {
    return this.#messages.length > 0 ? this.#messages[this.#messages.length - 1]! : emptyMessage();
  }

  LastMessage(): Message {
    return this.lastMessage();
  }
}

function emptyMessage(): Message {
  return {
    From: { Address: "" },
    To: [],
    Bcc: [],
    Cc: [],
    Subject: "",
    HTML: "",
    Text: "",
  };
}
