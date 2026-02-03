// Ported from pocketbase/tools/mailer/smtp_test.go

import { describe, expect, it } from "bun:test";
import { smtpLoginAuth, type SMTPServerInfo } from "./smtp.ts";

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
