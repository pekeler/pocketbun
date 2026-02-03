// Ported from pocketbase/tools/mailer/smtp.go (simplified: no-op sender).

import type { Mailer } from "./mailer.ts";
import { newSendHook, SendEvent, type SendInterceptor, type Message } from "./mailer.ts";

export const SMTPAuthPlain = "PLAIN";
export const SMTPAuthLogin = "LOGIN";

export type SMTPServerInfo = {
  TLS: boolean;
  Name: string;
};

// SMTPClient defines a SMTP mail client structure that implements
// `mailer.Mailer` interface.
export class SMTPClient implements Mailer, SendInterceptor {
  Host = "";
  Port = 0;
  Username = "";
  Password = "";
  TLS = false;
  AuthMethod = "";
  LocalName = "";

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

// smtpLoginAuth defines an AUTH that implements the LOGIN authentication mechanism.
//
// AUTH LOGIN is obsolete[1] but some mail services like outlook requires it [2].
//
// NB!
// It will only send the credentials if the connection is using TLS or is connected to localhost.
// Otherwise authentication will fail with an error, without sending the credentials.
//
// [1]: https://github.com/golang/go/issues/40817
// [2]: https://support.microsoft.com/en-us/office/outlook-com-no-longer-supports-auth-plain-authentication-07f7d5e9-1697-465f-84d2-4513d4ff0145?ui=en-us&rs=en-us&ad=us
export class smtpLoginAuth {
  username: string;
  password: string;

  constructor(username: string, password: string) {
    this.username = username;
    this.password = password;
  }

  Start(server: SMTPServerInfo): [string, Uint8Array, Error | null] {
    // Must have TLS, or else localhost server.
    // Note: If TLS is not true, then we can't trust ANYTHING in ServerInfo.
    // In particular, it doesn't matter if the server advertises LOGIN auth.
    // That might just be the attacker saying
    // "it's ok, you can trust me with your password."
    if (!server.TLS && !isLocalhost(server.Name)) {
      return ["", new Uint8Array(), new Error("unencrypted connection")];
    }

    return [SMTPAuthLogin, new Uint8Array(), null];
  }

  Next(fromServer: Uint8Array, more: boolean): [Uint8Array, Error | null] {
    if (more) {
      const prompt = new TextDecoder().decode(fromServer).toLowerCase();
      if (prompt === "username:") {
        return [new TextEncoder().encode(this.username), null];
      }
      if (prompt === "password:") {
        return [new TextEncoder().encode(this.password), null];
      }
    }

    return [new Uint8Array(), null];
  }
}

export function isLocalhost(name: string): boolean {
  return name === "localhost" || name === "127.0.0.1" || name === "::1";
}
