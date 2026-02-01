// Ported from pocketbase/tools/mailer/mailer.go (partial: message + hooks).

import { Event, type Resolver } from "../hook/event.ts";
import { Hook } from "../hook/hook.ts";

export type Address = {
  Name?: string;
  Address: string;
};

// Message defines a generic email message struct.
export type Message = {
  From: Address;
  To: Address[];
  Bcc: Address[];
  Cc: Address[];
  Subject: string;
  HTML: string;
  Text: string;
  Headers?: Record<string, string>;
  Attachments?: Record<string, unknown>;
  InlineAttachments?: Record<string, unknown>;
};

// Mailer defines a base mail client interface.
export interface Mailer {
  Send(message: Message): Error | null | Promise<Error | null | void> | void;
}

// SendInterceptor is optional interface for registering mail send hooks.
export interface SendInterceptor {
  OnSend(): Hook<SendEvent>;
}

export class SendEvent extends Event implements Resolver {
  Message: Message;

  constructor(message: Message) {
    super();
    this.Message = message;
  }
}

export function newSendHook(): Hook<SendEvent> {
  return new Hook<SendEvent>();
}
