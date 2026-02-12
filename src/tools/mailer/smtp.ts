// Ported from pocketbase/tools/mailer/smtp.go
// Deviation: uses async SMTP socket I/O because JS runtimes don't expose a sync SMTP client.

import net from "node:net";
import tls from "node:tls";
import type { Mailer } from "./mailer.ts";
import { pseudorandomString } from "../security/random.ts";
import { html2Text } from "./html2text.ts";
import {
  addressesToStrings,
  detectReaderMimeType,
  newSendHook,
  SendEvent,
  type Message,
  type SendInterceptor,
} from "./mailer.ts";

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
  async Send(message: Message): Promise<Error | null> {
    const event = new SendEvent(message);
    try {
      const result = this.#onSend.Trigger(event, (e) => this.send(e.Message));
      return await normalizeHookResult(result);
    } catch (error) {
      return toError(error);
    }
  }

  private async send(message: Message): Promise<Error | null> {
    const recipients = [
      ...addressesToStrings(message.To, false),
      ...addressesToStrings(message.Cc, false),
      ...addressesToStrings(message.Bcc, false),
    ];
    if (recipients.length === 0) {
      return new Error("failed to send message: missing recipient addresses");
    }

    const [rawMessage, messageErr] = buildSMTPMessage(message);
    if (messageErr) {
      return messageErr;
    }

    const connection = new SMTPConnection();

    try {
      await connection.connect(this.Host, this.Port, this.TLS);

      const greeting = await connection.readResponse();
      if (greeting.code !== 220) {
        throw new Error(`unexpected SMTP greeting response ${greeting.code}`);
      }

      const localName = this.LocalName || "localhost";
      await connection.command(`EHLO ${localName}`, 250);

      if (this.Username !== "" || this.Password !== "") {
        if (this.AuthMethod === SMTPAuthLogin) {
          const auth = new smtpLoginAuth(this.Username, this.Password);
          const [method, _, startErr] = auth.Start({
            TLS: this.TLS,
            Name: this.Host,
          });
          if (startErr) {
            return startErr;
          }

          const challenge1 = await connection.command(`AUTH ${method}`, 334);
          const [userPart, userErr] = auth.Next(decodeSMTPAuthChallenge(challenge1.lines.at(-1) ?? ""), true);
          if (userErr) {
            return userErr;
          }

          const challenge2 = await connection.command(Buffer.from(userPart).toString("base64"), 334);
          const [passPart, passErr] = auth.Next(decodeSMTPAuthChallenge(challenge2.lines.at(-1) ?? ""), true);
          if (passErr) {
            return passErr;
          }

          await connection.command(Buffer.from(passPart).toString("base64"), 235);
        } else {
          const token = Buffer.from(`\u0000${this.Username}\u0000${this.Password}`, "utf8").toString("base64");
          await connection.command(`AUTH PLAIN ${token}`, [235, 503]);
        }
      }

      await connection.command(`MAIL FROM:<${message.From.Address}>`, 250);
      for (const recipient of recipients) {
        await connection.command(`RCPT TO:<${recipient}>`, [250, 251]);
      }

      await connection.command("DATA", 354);
      await connection.writeRaw(`${dotStuff(normalizeCRLF(rawMessage))}\r\n.\r\n`);
      await connection.expect([250]);

      await connection.command("QUIT", 221);

      return null;
    } catch (error) {
      return toError(error);
    } finally {
      await connection.close();
    }
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

type SMTPResponse = {
  code: number;
  lines: string[];
};

type MailAttachment = {
  name: string;
  mimeType: string;
  data: Uint8Array;
  inline: boolean;
};

class SMTPConnection {
  #socket: net.Socket | tls.TLSSocket | null = null;
  #buffer = "";
  #lineQueue: string[] = [];
  #waiters: Array<{ resolve: (line: string) => void; reject: (error: Error) => void }> = [];
  #closedError: Error | null = null;

  async connect(host: string, port: number, useTLS: boolean): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const socket = useTLS ? tls.connect({ host, port }) : net.createConnection({ host, port });
      const readyEvent = useTLS ? "secureConnect" : "connect";
      this.#socket = socket;

      const onConnectError = (error: Error): void => {
        reject(error);
      };

      socket.once("error", onConnectError);
      socket.once(readyEvent, () => {
        socket.off("error", onConnectError);
        resolve();
      });

      socket.on("data", (chunk) => {
        this.#handleData(chunk);
      });
      socket.on("error", (error) => {
        this.#handleClosed(toError(error));
      });
      socket.on("close", () => {
        this.#handleClosed(new Error("SMTP connection closed"));
      });
      socket.on("end", () => {
        this.#handleClosed(new Error("SMTP connection ended"));
      });
    });
  }

  async command(commandLine: string, expectedCode: number | number[]): Promise<SMTPResponse> {
    await this.writeRaw(`${commandLine}\r\n`);
    const response = await this.readResponse();
    if (!matchesExpectedCode(response.code, expectedCode)) {
      throw new Error(`unexpected SMTP response ${response.code} for command "${commandLine}"`);
    }
    return response;
  }

  async expect(expectedCode: number | number[]): Promise<SMTPResponse> {
    const response = await this.readResponse();
    if (!matchesExpectedCode(response.code, expectedCode)) {
      throw new Error(`unexpected SMTP response ${response.code}`);
    }
    return response;
  }

  async writeRaw(data: string): Promise<void> {
    if (!this.#socket) {
      throw new Error("SMTP connection is not initialized");
    }
    await new Promise<void>((resolve, reject) => {
      this.#socket?.write(data, (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  async readResponse(): Promise<SMTPResponse> {
    const firstLine = await this.#readLine();
    const firstParsed = parseSMTPLine(firstLine);
    if (!firstParsed) {
      throw new Error(`invalid SMTP response line: ${firstLine}`);
    }

    const lines = [firstParsed.text];
    if (firstParsed.separator === "-") {
      while (true) {
        const line = await this.#readLine();
        const parsed = parseSMTPLine(line);
        if (!parsed) {
          throw new Error(`invalid SMTP response line: ${line}`);
        }

        lines.push(parsed.text);
        if (parsed.code === firstParsed.code && parsed.separator === " ") {
          break;
        }
      }
    }

    return {
      code: firstParsed.code,
      lines,
    };
  }

  async close(): Promise<void> {
    if (!this.#socket) {
      return;
    }

    const socket = this.#socket;
    this.#socket = null;

    if (socket.destroyed) {
      return;
    }

    await new Promise<void>((resolve) => {
      socket.end(() => resolve());
      setTimeout(() => {
        if (!socket.destroyed) {
          socket.destroy();
        }
        resolve();
      }, 250).unref?.();
    });
  }

  #handleData(chunk: Buffer | string): void {
    const text = typeof chunk === "string" ? chunk : chunk.toString("utf8");
    this.#buffer += text;

    while (true) {
      const lineBreakIndex = this.#buffer.indexOf("\n");
      if (lineBreakIndex < 0) {
        break;
      }

      let line = this.#buffer.slice(0, lineBreakIndex);
      this.#buffer = this.#buffer.slice(lineBreakIndex + 1);
      if (line.endsWith("\r")) {
        line = line.slice(0, -1);
      }

      this.#pushLine(line);
    }
  }

  #pushLine(line: string): void {
    const waiter = this.#waiters.shift();
    if (waiter) {
      waiter.resolve(line);
      return;
    }
    this.#lineQueue.push(line);
  }

  #handleClosed(error: Error): void {
    if (this.#closedError) {
      return;
    }
    this.#closedError = error;

    while (this.#waiters.length > 0) {
      const waiter = this.#waiters.shift();
      waiter?.reject(error);
    }
  }

  async #readLine(): Promise<string> {
    if (this.#lineQueue.length > 0) {
      return this.#lineQueue.shift() ?? "";
    }
    if (this.#closedError) {
      throw this.#closedError;
    }
    return await new Promise<string>((resolve, reject) => {
      this.#waiters.push({ resolve, reject });
    });
  }
}

function parseSMTPLine(line: string): { code: number; separator: " " | "-"; text: string } | null {
  const match = /^(\d{3})([ -])(.*)$/.exec(line);
  if (!match) {
    return null;
  }

  const code = Number.parseInt(match[1] ?? "", 10);
  const separator = (match[2] ?? " ") as " " | "-";
  const text = match[3] ?? "";

  return {
    code,
    separator,
    text,
  };
}

function matchesExpectedCode(actual: number, expected: number | number[]): boolean {
  if (Array.isArray(expected)) {
    return expected.includes(actual);
  }
  return actual === expected;
}

function buildSMTPMessage(message: Message): [string, Error | null] {
  const [attachments, attachmentsErr] = collectAttachments(message.Attachments, false);
  if (attachmentsErr) {
    return ["", attachmentsErr];
  }

  const [inlineAttachments, inlineErr] = collectAttachments(message.InlineAttachments, true);
  if (inlineErr) {
    return ["", inlineErr];
  }

  const [plainBody, plainErr] = resolvePlainBody(message);
  if (plainErr) {
    return ["", plainErr];
  }

  const headers: string[] = [
    `From: ${addressesToStrings([message.From], true)[0] ?? message.From.Address}`,
    `Subject: ${encodeMimeHeaderValue(message.Subject)}`,
    "MIME-Version: 1.0",
  ];

  const toHeader = addressesToStrings(message.To, true).join(", ");
  if (toHeader) {
    headers.push(`To: ${toHeader}`);
  }

  const ccHeader = addressesToStrings(message.Cc, true).join(", ");
  if (ccHeader) {
    headers.push(`Cc: ${ccHeader}`);
  }

  let hasMessageId = false;
  for (const [key, value] of Object.entries(message.Headers ?? {})) {
    if (key.toLowerCase() === "message-id") {
      hasMessageId = true;
    }
    headers.push(`${key}: ${value}`);
  }

  if (!hasMessageId) {
    const fromParts = message.From.Address.split("@");
    if (fromParts.length === 2 && fromParts[1]) {
      headers.push(`Message-ID: <${pseudorandomString(15)}@${fromParts[1]}>`);
    }
  }

  const primaryEntity = buildPrimaryEntity(plainBody, message.HTML);

  let body = "";
  if (attachments.length === 0 && inlineAttachments.length === 0) {
    headers.push(...primaryEntity.headers);
    body = primaryEntity.body;
  } else {
    const mixedBoundary = generateBoundary("mixed");
    headers.push(`Content-Type: multipart/mixed; boundary="${mixedBoundary}"`);

    const segments: string[] = [];
    segments.push(renderMultipartSection(mixedBoundary, renderEntity(primaryEntity.headers, primaryEntity.body)));

    for (const attachment of inlineAttachments) {
      segments.push(
        renderMultipartSection(mixedBoundary, renderEntity(buildAttachmentHeaders(attachment), encodeBase64(attachment.data))),
      );
    }

    for (const attachment of attachments) {
      segments.push(
        renderMultipartSection(mixedBoundary, renderEntity(buildAttachmentHeaders(attachment), encodeBase64(attachment.data))),
      );
    }

    segments.push(`--${mixedBoundary}--`);
    body = segments.join("\r\n");
  }

  return [renderEntity(headers, body), null];
}

function resolvePlainBody(message: Message): [string, Error | null] {
  if (message.Text !== "") {
    return [message.Text, null];
  }

  if (!message.HTML) {
    return ["", null];
  }

  const [plain, err] = html2Text(message.HTML);
  if (err) {
    return ["", err];
  }

  return [plain, null];
}

function collectAttachments(source: Record<string, unknown> | undefined, inline: boolean): [MailAttachment[], Error | null] {
  if (!source || Object.keys(source).length === 0) {
    return [[], null];
  }

  const attachments: MailAttachment[] = [];
  for (const [name, value] of Object.entries(source)) {
    const [data, mimeType, err] = detectReaderMimeType(value);
    if (err) {
      return [[], err];
    }

    attachments.push({
      name,
      mimeType,
      data,
      inline,
    });
  }

  return [attachments, null];
}

function buildPrimaryEntity(plainBody: string, htmlBody: string): { headers: string[]; body: string } {
  if (htmlBody && plainBody) {
    const altBoundary = generateBoundary("alt");
    const parts = [
      renderMultipartSection(
        altBoundary,
        renderEntity(["Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64"], encodeBase64(plainBody)),
      ),
      renderMultipartSection(
        altBoundary,
        renderEntity(["Content-Type: text/html; charset=UTF-8", "Content-Transfer-Encoding: base64"], encodeBase64(htmlBody)),
      ),
      `--${altBoundary}--`,
    ];

    return {
      headers: [`Content-Type: multipart/alternative; boundary="${altBoundary}"`],
      body: parts.join("\r\n"),
    };
  }

  if (htmlBody) {
    return {
      headers: ["Content-Type: text/html; charset=UTF-8", "Content-Transfer-Encoding: base64"],
      body: encodeBase64(htmlBody),
    };
  }

  return {
    headers: ["Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64"],
    body: encodeBase64(plainBody),
  };
}

function buildAttachmentHeaders(attachment: MailAttachment): string[] {
  const escapedName = escapeHeaderParam(attachment.name);
  const headers = [
    `Content-Type: ${attachment.mimeType}; name="${escapedName}"`,
    "Content-Transfer-Encoding: base64",
    `Content-Disposition: ${attachment.inline ? "inline" : "attachment"}; filename="${escapedName}"`,
  ];

  if (attachment.inline) {
    headers.push(`Content-ID: <${escapedName}>`);
  }

  return headers;
}

function renderEntity(headers: string[], body: string): string {
  return `${headers.join("\r\n")}\r\n\r\n${body}`;
}

function renderMultipartSection(boundary: string, payload: string): string {
  return `--${boundary}\r\n${payload}`;
}

function encodeBase64(value: string | Uint8Array): string {
  const buffer = typeof value === "string" ? Buffer.from(value, "utf8") : Buffer.from(value);
  const raw = buffer.toString("base64");
  return raw.replace(/.{1,76}/g, "$&\r\n").replace(/\r\n$/, "");
}

function generateBoundary(prefix: string): string {
  return `pocketbun_${prefix}_${pseudorandomString(24)}`;
}

function escapeHeaderParam(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function normalizeCRLF(value: string): string {
  return value.replace(/\r?\n/g, "\r\n");
}

function dotStuff(value: string): string {
  return value.replace(/(^|\r\n)\./g, "$1..");
}

function encodeMimeHeaderValue(value: string): string {
  if (!value) {
    return "";
  }
  if (/^[\x20-\x7E]*$/.test(value)) {
    return value;
  }
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function decodeSMTPAuthChallenge(value: string): Uint8Array {
  const trimmed = value.trim();
  if (!trimmed) {
    return new Uint8Array();
  }

  const maybeBase64 = /^[A-Za-z0-9+/]+={0,2}$/.test(trimmed) && trimmed.length % 4 === 0;
  if (maybeBase64) {
    return new Uint8Array(Buffer.from(trimmed, "base64"));
  }

  return new TextEncoder().encode(trimmed);
}

async function normalizeHookResult(result: unknown): Promise<Error | null> {
  const resolved = result instanceof Promise ? await result : result;
  return resolved instanceof Error ? resolved : null;
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}
