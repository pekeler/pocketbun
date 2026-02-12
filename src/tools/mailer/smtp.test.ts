// Ported from pocketbase/tools/mailer/smtp_test.go

import { describe, expect, it } from "bun:test";
import net from "node:net";
import type { Message } from "./mailer.ts";
import { SMTPClient, smtpLoginAuth, type SMTPServerInfo } from "./smtp.ts";

describe("smtpLoginAuth", () => {
  it("Start", () => {
    const auth = new smtpLoginAuth("test", "123456");

    const scenarios: Array<{ name: string; serverInfo: SMTPServerInfo; expectError: boolean }> = [
      { name: "localhost without tls", serverInfo: { TLS: false, Name: "localhost" }, expectError: false },
      { name: "localhost with tls", serverInfo: { TLS: true, Name: "localhost" }, expectError: false },
      { name: "127.0.0.1 without tls", serverInfo: { TLS: false, Name: "127.0.0.1" }, expectError: false },
      { name: "127.0.0.1 with tls", serverInfo: { TLS: false, Name: "127.0.0.1" }, expectError: false },
      { name: "::1 without tls", serverInfo: { TLS: false, Name: "::1" }, expectError: false },
      { name: "::1 with tls", serverInfo: { TLS: false, Name: "::1" }, expectError: false },
      { name: "non-localhost without tls", serverInfo: { TLS: false, Name: "example.com" }, expectError: true },
      { name: "non-localhost with tls", serverInfo: { TLS: true, Name: "example.com" }, expectError: false },
    ];

    for (const scenario of scenarios) {
      const [method, resp, err] = auth.Start(scenario.serverInfo);
      const hasErr = err != null;
      expect(hasErr).toBe(scenario.expectError);

      if (hasErr) {
        continue;
      }

      expect(resp.length).toBe(0);
      expect(method).toBe("LOGIN");
    }
  });

  it("Next", () => {
    const auth = new smtpLoginAuth("test", "123456");

    {
      const [r1, err1] = auth.Next(new TextEncoder().encode("example:"), false);
      expect(err1).toBeNull();
      expect(r1.length).toBe(0);

      const [r2, err2] = auth.Next(new TextEncoder().encode("example:"), true);
      expect(err2).toBeNull();
      expect(r2.length).toBe(0);
    }

    {
      const [r1, err1] = auth.Next(new TextEncoder().encode("username:"), false);
      expect(err1).toBeNull();
      expect(r1.length).toBe(0);

      const [r2, err2] = auth.Next(new TextEncoder().encode("username:"), true);
      expect(err2).toBeNull();
      expect(new TextDecoder().decode(r2)).toBe(auth.username);

      const [r3, err3] = auth.Next(new TextEncoder().encode("uSeRnAmE:"), true);
      expect(err3).toBeNull();
      expect(new TextDecoder().decode(r3)).toBe(auth.username);
    }

    {
      const [r1, err1] = auth.Next(new TextEncoder().encode("password:"), false);
      expect(err1).toBeNull();
      expect(r1.length).toBe(0);

      const [r2, err2] = auth.Next(new TextEncoder().encode("password:"), true);
      expect(err2).toBeNull();
      expect(new TextDecoder().decode(r2)).toBe(auth.password);

      const [r3, err3] = auth.Next(new TextEncoder().encode("pAsSwOrD:"), true);
      expect(err3).toBeNull();
      expect(new TextDecoder().decode(r3)).toBe(auth.password);
    }
  });
});

type CapturedSMTPExchange = {
  commands: string[];
  authLoginPayloads: string[];
  authPlainPayloads: string[];
  data: string;
};

async function startFakeSMTPServer(): Promise<{
  port: number;
  exchange: CapturedSMTPExchange;
  close: () => Promise<void>;
}> {
  const exchange: CapturedSMTPExchange = {
    commands: [],
    authLoginPayloads: [],
    authPlainPayloads: [],
    data: "",
  };

  const server = net.createServer((socket) => {
    let buffer = "";
    let readingData = false;
    let authLoginState: "none" | "username" | "password" = "none";

    socket.write("220 localhost ESMTP ready\r\n");

    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");

      while (true) {
        if (readingData) {
          const endIndex = buffer.indexOf("\r\n.\r\n");
          if (endIndex < 0) {
            return;
          }

          exchange.data = buffer.slice(0, endIndex);
          buffer = buffer.slice(endIndex + 5);
          readingData = false;
          socket.write("250 queued\r\n");
          continue;
        }

        const lineEndIndex = buffer.indexOf("\r\n");
        if (lineEndIndex < 0) {
          return;
        }

        const line = buffer.slice(0, lineEndIndex);
        buffer = buffer.slice(lineEndIndex + 2);
        if (!line) {
          continue;
        }

        exchange.commands.push(line);
        const upperLine = line.toUpperCase();

        if (authLoginState === "username") {
          exchange.authLoginPayloads.push(line);
          authLoginState = "password";
          socket.write("334 UGFzc3dvcmQ6\r\n");
          continue;
        }

        if (authLoginState === "password") {
          exchange.authLoginPayloads.push(line);
          authLoginState = "none";
          socket.write("235 authenticated\r\n");
          continue;
        }

        if (upperLine.startsWith("EHLO ")) {
          socket.write("250-localhost\r\n250-AUTH LOGIN PLAIN\r\n250 SIZE 35882577\r\n");
          continue;
        }

        if (upperLine === "AUTH LOGIN") {
          authLoginState = "username";
          socket.write("334 VXNlcm5hbWU6\r\n");
          continue;
        }

        if (upperLine.startsWith("AUTH PLAIN ")) {
          exchange.authPlainPayloads.push(line.slice("AUTH PLAIN ".length));
          socket.write("235 authenticated\r\n");
          continue;
        }

        if (upperLine.startsWith("MAIL FROM:")) {
          socket.write("250 ok\r\n");
          continue;
        }

        if (upperLine.startsWith("RCPT TO:")) {
          socket.write("250 ok\r\n");
          continue;
        }

        if (upperLine === "DATA") {
          readingData = true;
          socket.write("354 End data with <CR><LF>.<CR><LF>\r\n");
          continue;
        }

        if (upperLine === "QUIT") {
          socket.write("221 bye\r\n");
          socket.end();
          continue;
        }

        socket.write("250 ok\r\n");
      }
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("failed to resolve fake SMTP server address");
  }

  return {
    port: address.port,
    exchange,
    close: async () =>
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      }),
  };
}

describe("SMTPClient", () => {
  it.serial("sends with AUTH LOGIN and generates Message-ID", async () => {
    const smtpServer = await startFakeSMTPServer();
    try {
      const client = new SMTPClient();
      client.Host = "127.0.0.1";
      client.Port = smtpServer.port;
      client.Username = "test-user";
      client.Password = "test-pass";
      client.AuthMethod = "LOGIN";

      const message: Message = {
        From: { Name: "PocketBun", Address: "noreply@example.com" },
        To: [{ Name: "John Doe", Address: "john@example.com" }],
        Cc: [{ Name: "Jane Doe", Address: "jane@example.com" }],
        Bcc: [{ Address: "hidden@example.com" }],
        Subject: "OAuth verification",
        HTML: "<h1>Hello</h1><p>from PocketBun</p>",
        Text: "",
        Headers: {},
        Attachments: {},
        InlineAttachments: {},
      };

      const sendErr = await client.Send(message);
      expect(sendErr).toBeNull();

      expect(smtpServer.exchange.commands).toContain("AUTH LOGIN");
      expect(smtpServer.exchange.commands.filter((line) => line.startsWith("RCPT TO:")).length).toBe(3);
      expect(Buffer.from(smtpServer.exchange.authLoginPayloads[0] ?? "", "base64").toString("utf8")).toBe("test-user");
      expect(Buffer.from(smtpServer.exchange.authLoginPayloads[1] ?? "", "base64").toString("utf8")).toBe("test-pass");
      expect(smtpServer.exchange.data).toContain(`To: "John Doe" <john@example.com>`);
      expect(smtpServer.exchange.data).toContain(`Cc: "Jane Doe" <jane@example.com>`);
      expect(smtpServer.exchange.data).not.toContain("Bcc:");
      expect(smtpServer.exchange.data).toContain("Message-ID: <");
      expect(smtpServer.exchange.data).toContain('Content-Type: multipart/alternative; boundary="');
      expect(smtpServer.exchange.data).toContain("Content-Type: text/plain; charset=UTF-8");
      expect(smtpServer.exchange.data).toContain("Content-Type: text/html; charset=UTF-8");
    } finally {
      await smtpServer.close();
    }
  });

  it.serial("sends with AUTH PLAIN, local name, and attachments", async () => {
    const smtpServer = await startFakeSMTPServer();
    try {
      const client = new SMTPClient();
      client.Host = "127.0.0.1";
      client.Port = smtpServer.port;
      client.Username = "plain-user";
      client.Password = "plain-pass";
      client.LocalName = "relay.example";

      const message: Message = {
        From: { Name: "PocketBun", Address: "noreply@example.com" },
        To: [{ Address: "john@example.com" }],
        Cc: [],
        Bcc: [],
        Subject: "Attachment test",
        HTML: "",
        Text: "Plain text body",
        Headers: {
          "Message-ID": "<custom@example.com>",
        },
        Attachments: {
          "notes.txt": "notes",
        },
        InlineAttachments: {
          "logo.png": new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
        },
      };

      const sendErr = await client.Send(message);
      expect(sendErr).toBeNull();

      expect(smtpServer.exchange.commands[0]).toBe("EHLO relay.example");
      expect(smtpServer.exchange.authPlainPayloads.length).toBe(1);
      expect(Buffer.from(smtpServer.exchange.authPlainPayloads[0] ?? "", "base64").toString("utf8")).toBe(
        "\u0000plain-user\u0000plain-pass",
      );
      expect((smtpServer.exchange.data.match(/Message-ID:/g) ?? []).length).toBe(1);
      expect(smtpServer.exchange.data).toContain("Message-ID: <custom@example.com>");
      expect(smtpServer.exchange.data).toContain('Content-Disposition: attachment; filename="notes.txt"');
      expect(smtpServer.exchange.data).toContain('Content-Disposition: inline; filename="logo.png"');
      expect(smtpServer.exchange.data).toContain("Content-ID: <logo.png>");
    } finally {
      await smtpServer.close();
    }
  });
});
