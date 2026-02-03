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

// addressesToStrings converts the provided address to a list of serialized RFC 5322 strings.
//
// To export only the email part of mail.Address, you can set withName to false.
export function addressesToStrings(addresses: Address[], withName: boolean): string[] {
  return addresses.map((addr) => {
    if (withName && addr.Name) {
      return formatAddress(addr);
    }
    return addr.Address;
  });
}

// detectReaderMimeType reads the first couple bytes of the reader to detect its MIME type.
//
// Returns a new combined reader from the partial read + the remaining of the original reader.
export function detectReaderMimeType(data: unknown): [Uint8Array, string, Error | null] {
  try {
    const bytes = toBytes(data);
    const mime = detectMimeType(bytes);
    return [bytes, mime, null];
  } catch (error) {
    return [new Uint8Array(), "", error as Error];
  }
}

function formatAddress(addr: Address): string {
  const name = addr.Name ?? "";
  if (!name) {
    return addr.Address;
  }
  const escaped = name.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${escaped}" <${addr.Address}>`;
}

function toBytes(data: unknown): Uint8Array {
  if (data instanceof Uint8Array) {
    return data;
  }
  if (typeof Buffer !== "undefined" && data instanceof Buffer) {
    return new Uint8Array(data);
  }
  if (typeof data === "string") {
    return new TextEncoder().encode(data);
  }
  throw new Error("invalid reader type");
}

function detectMimeType(bytes: Uint8Array): string {
  const sample = new TextDecoder().decode(bytes.slice(0, 256)).trimStart();
  if (sample.startsWith("#!") && sample.toLowerCase().includes("node")) {
    return "text/javascript";
  }
  if (/<\\s*(!doctype|html)/i.test(sample)) {
    return "text/html";
  }
  if (/[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F]/.test(sample)) {
    return "application/octet-stream";
  }
  return "text/plain";
}
