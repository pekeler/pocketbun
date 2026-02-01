// Ported from pocketbase/tools/mailer/sendmail.go (simplified: no-op sender).

import type { Mailer } from "./mailer.ts";
import { newSendHook, SendEvent, type SendInterceptor, type Message } from "./mailer.ts";

export class Sendmail implements Mailer, SendInterceptor {
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
