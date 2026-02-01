// Ported from pocketbase/tools/mailer/smtp.go (simplified: no-op sender).

import type { Mailer } from "./mailer.ts";
import { newSendHook, SendEvent, type SendInterceptor, type Message } from "./mailer.ts";

export class SMTPClient implements Mailer, SendInterceptor {
  Host = "";
  Port = 0;
  Username = "";
  Password = "";
  TLS = false;
  AuthMethod = "";
  LocalName = "";

  #onSend = newSendHook();

  OnSend() {
    return this.#onSend;
  }

  Send(message: Message): Error | null {
    const event = new SendEvent(message);
    const result = this.#onSend.Trigger(event, () => null);
    if (result instanceof Error) {
      return result;
    }
    return null;
  }
}
