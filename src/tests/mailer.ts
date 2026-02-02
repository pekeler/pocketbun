// Ported from pocketbase/tests/mailer.go

import type { Mailer, Message } from "../tools/mailer/mailer.ts";

export class TestMailer implements Mailer {
  #messages: Message[] = [];

  Send(message: Message): Error | null {
    attachMessageAliases(message);
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

function attachMessageAliases(message: Message): void {
  defineAlias(message, "from", "From");
  defineAlias(message, "to", "To");
  defineAlias(message, "bcc", "Bcc");
  defineAlias(message, "cc", "Cc");
  defineAlias(message, "subject", "Subject");
  defineAlias(message, "html", "HTML");
  defineAlias(message, "text", "Text");
  defineAlias(message, "headers", "Headers");
  defineAlias(message, "attachments", "Attachments");
  defineAlias(message, "inlineAttachments", "InlineAttachments");

  if (message.From) {
    attachAddressAliases(message.From);
  }
  for (const addr of message.To ?? []) {
    attachAddressAliases(addr);
  }
  for (const addr of message.Bcc ?? []) {
    attachAddressAliases(addr);
  }
  for (const addr of message.Cc ?? []) {
    attachAddressAliases(addr);
  }
}

function attachAddressAliases(address: { Name?: string; Address: string }): void {
  defineAlias(address, "name", "Name");
  defineAlias(address, "address", "Address");
}

function defineAlias<T extends Record<string, unknown>>(target: T, alias: string, key: string): void {
  if (alias in target) {
    return;
  }
  Object.defineProperty(target, alias, {
    enumerable: false,
    configurable: true,
    get() {
      return (target as Record<string, unknown>)[key];
    },
    set(value) {
      (target as Record<string, unknown>)[key] = value;
    },
  });
}
