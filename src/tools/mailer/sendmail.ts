// Ported from pocketbase/tools/mailer/sendmail.go

import { spawnSync } from "node:child_process";
import type { Mailer } from "./mailer.ts";
import { pseudorandomString } from "../security/random.ts";
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

  protected runCommand(commandPath: string, args: string[], payload: string): Error | null {
    const result = spawnSync(commandPath, args, {
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
    return this.runCommand(cmdPath, ["-i", "-t"], payload);
  }
}

function buildSendmailPayload(message: Message, toAddresses: string[]): string {
  const headers = new Map([
    ["subject", encodeMimeHeader(message.Subject)],
    ["from", addressesToStrings([message.From], true)[0] ?? message.From.Address],
    ["to", toAddresses.join(",")],
  ]);
  // @todo evaluate handling multipart/mixed together with the attachments support
  headers.set("content-type", message.HTML ? "text/html; charset=UTF-8" : "text/plain; charset=UTF-8");
  if (message.Cc.length > 0) {
    headers.set("cc", addressesToStrings(message.Cc, false).join(","));
  }
  if (message.Bcc.length > 0) {
    headers.set("bcc", addressesToStrings(message.Bcc, false).join(","));
  }

  // add custom headers (if any)
  for (const [key, value] of Object.entries(message.Headers ?? {})) {
    headers.set(key.toLowerCase(), value);
  }

  // add a default message id if missing
  if (!headers.get("message-id")) {
    const fromParts = message.From.Address.split("@");
    if (fromParts.length === 2) {
      headers.set("message-id", `<${pseudorandomString(15)}@${fromParts[1]}>`);
    }
  }

  const lines: string[] = [];
  for (const [key, value] of headers) {
    // Match Go http.Header.Write: skip invalid names and flatten CR/LF in values.
    if (/^[!#$%&'*+.^_`|~0-9a-z-]+$/.test(key)) {
      const name = key.replace(/(^|-)[a-z]/g, (part) => part.toUpperCase());
      lines.push(`${name}: ${value.replace(/[\r\n]/g, " ").replace(/^[ \t]+|[ \t]+$/g, "")}`);
    }
  }
  return `${lines.join("\r\n")}\r\n\r\n${message.HTML || message.Text || ""}`;
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
