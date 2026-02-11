// PocketBun-only: provider-specific mailcow OAuth2 user mapping parity tests.

import { describe, expect, it } from "bun:test";
import type { OAuth2Token } from "./auth.ts";
import { ParseDateTime } from "../types/index.ts";
import { Mailcow } from "./mailcow.ts";

class MailcowMock extends Mailcow {
  #rawUserInfo: string;

  constructor(rawUserInfo: string) {
    super();
    this.#rawUserInfo = rawUserInfo;
  }

  override async FetchRawUserInfo(_token: OAuth2Token): Promise<Uint8Array> {
    return new TextEncoder().encode(this.#rawUserInfo);
  }
}

describe("mailcow provider", () => {
  it("FetchAuthUser maps fields and normalizes username local part", async () => {
    const provider = new MailcowMock(
      JSON.stringify({
        id: "mc_user_1",
        username: "mailbox@example.com",
        email: "mailbox@example.com",
        full_name: "Mailcow User",
        active: 1,
      }),
    );

    const tokenExpiry = new Date("2026-02-18T11:11:12.000Z");
    const user = await provider.FetchAuthUser({
      accessToken: "access_1",
      refreshToken: "refresh_1",
      expiry: tokenExpiry,
    });

    expect(user.Id).toBe("mc_user_1");
    expect(user.Name).toBe("Mailcow User");
    expect(user.Username).toBe("mailbox");
    expect(user.Email).toBe("mailbox@example.com");
    expect(user.AccessToken).toBe("access_1");
    expect(user.RefreshToken).toBe("refresh_1");
    expect(user.Expiry.Equal(ParseDateTime(tokenExpiry))).toBe(true);
  });

  it("FetchAuthUser rejects inactive users", async () => {
    const provider = new MailcowMock(
      JSON.stringify({
        id: "mc_user_2",
        active: 0,
      }),
    );

    try {
      await provider.FetchAuthUser({ accessToken: "access_2" });
      throw new Error("Expected FetchAuthUser to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe("the mailcow user is not active");
    }
  });

  it("FetchAuthUser accepts missing optional profile fields", async () => {
    const provider = new MailcowMock(
      JSON.stringify({
        active: 1,
      }),
    );

    const user = await provider.FetchAuthUser({ accessToken: "access_3" });
    expect(user.Id).toBe("");
    expect(user.Name).toBe("");
    expect(user.Username).toBe("");
    expect(user.Email).toBe("");
  });

  it("FetchAuthUser rejects malformed or invalid payloads", async () => {
    const malformed = new MailcowMock("{");
    try {
      await malformed.FetchAuthUser({ accessToken: "access_4" });
      throw new Error("Expected malformed payload to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }

    const invalidType = new MailcowMock(
      JSON.stringify({
        active: "1",
      }),
    );
    try {
      await invalidType.FetchAuthUser({ accessToken: "access_5" });
      throw new Error("Expected invalid type payload to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }
  });
});
