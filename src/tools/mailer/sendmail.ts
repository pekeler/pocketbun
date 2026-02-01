// Ported from pocketbase/tools/mailer/sendmail.go (simplified: no-op sender).

import type { Mailer } from "./mailer.ts";
import { newSendHook, SendEvent, type SendInterceptor, type Message } from "./mailer.ts";

// Sendmail implements [mailer.Mailer] interface and defines a mail
// client that sends emails via the "sendmail" *nix command.
//
// This client is usually recommended only for development and testing.
export class Sendmail implements Mailer, SendInterceptor {
  #onSend = newSendHook();

  // OnSend implements [mailer.SendInterceptor] interface.
  OnSend() {
    return this.#onSend;
  }

  // Send implements [mailer.Mailer] interface.
  Send(message: Message): Error | null {
    const event = new SendEvent(message);
    const result = this.#onSend.Trigger(event, () => null);
    if (result instanceof Error) {
      return result;
    }
    return null;
  }
}
