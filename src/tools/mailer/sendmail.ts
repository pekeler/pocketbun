// Ported from pocketbase/tools/mailer/sendmail.go

import { spawnSync } from "node:child_process";
import type { Mailer } from "./mailer.ts";
import { addressesToStrings, newSendHook, SendEvent, type Message, type SendInterceptor } from "./mailer.ts";

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
    const result = this.#onSend.Trigger(event, (e) => this.send(e.Message));
    if (result instanceof Error) {
      return result;
    }
    return null;
  }

  protected findCommandPath(): [string, Error | null] {
    return findSendmailPath();
  }

  protected runCommand(commandPath: string, recipients: string[], payload: string): Error | null {
    const result = spawnSync(commandPath, [recipients.join(",")], {
      input: payload,
      encoding: "utf8",
      windowsHide: true,
    });

    if (result.error) {
      return toError(result.error);
    }

    if (typeof result.status === "number" && result.status !== 0) {
      const stderr = (result.stderr ?? "").trim();
      return new Error(stderr || `sendmail exited with status ${result.status}`);
    }

    return null;
  }

  private send(message: Message): Error | null {
    const toAddresses = addressesToStrings(message.To, false);
    if (toAddresses.length === 0) {
      return new Error("failed to send message: missing recipient addresses");
    }

    const [cmdPath, cmdErr] = this.findCommandPath();
    if (cmdErr) {
      return cmdErr;
    }

    const payload = buildSendmailPayload(message, toAddresses);
    return this.runCommand(cmdPath, toAddresses, payload);
  }
}

function buildSendmailPayload(message: Message, toAddresses: string[]): string {
  const headers = [
    `Subject: ${encodeMimeHeader(message.Subject)}`,
    `From: ${addressesToStrings([message.From], true)[0] ?? message.From.Address}`,
    "Content-Type: text/html; charset=UTF-8",
    `To: ${toAddresses.join(",")}`,
  ];

  return `${headers.join("\r\n")}\r\n\r\n${message.HTML || message.Text || ""}`;
}

function findSendmailPath(): [string, Error | null] {
  const options = ["/usr/sbin/sendmail", "/usr/bin/sendmail", "sendmail"];

  for (const option of options) {
    const path = Bun.which(option);
    if (path) {
      return [path, null];
    }
  }

  return ["", new Error("failed to locate a sendmail executable path")];
}

function encodeMimeHeader(value: string): string {
  if (!value) {
    return "";
  }
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}
