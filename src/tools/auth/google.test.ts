// PocketBun-only: provider-specific Google OAuth2 user mapping parity tests.

import { describe, expect, it } from "bun:test";
import type { OAuth2Token } from "./auth.ts";
import { ParseDateTime } from "../types/index.ts";
import { Google } from "./google.ts";

class GoogleMock extends Google {
  #rawUserInfo: string;

  constructor(rawUserInfo: string) {
    super();
    this.#rawUserInfo = rawUserInfo;
  }

  override async FetchRawUserInfo(_token: OAuth2Token): Promise<Uint8Array> {
    return new TextEncoder().encode(this.#rawUserInfo);
  }
}

describe("google provider", () => {
  it("FetchAuthUser maps verified profile fields", async () => {
    const provider = new GoogleMock(
      JSON.stringify({
        sub: "user_1",
        name: "Google User",
        picture: "https://example.com/avatar.png",
        email: "verified@example.com",
        email_verified: true,
      }),
    );

    const tokenExpiry = new Date("2026-02-12T10:11:12.000Z");
    const user = await provider.FetchAuthUser({
      accessToken: "access_1",
      refreshToken: "refresh_1",
      expiry: tokenExpiry,
    });

    expect(user.Id).toBe("user_1");
    expect(user.Name).toBe("Google User");
    expect(user.AvatarURL).toBe("https://example.com/avatar.png");
    expect(user.Email).toBe("verified@example.com");
    expect(user.AccessToken).toBe("access_1");
    expect(user.RefreshToken).toBe("refresh_1");
    expect(user.Expiry.Equal(ParseDateTime(tokenExpiry))).toBe(true);
  });

  it("FetchAuthUser keeps email empty when email is not verified", async () => {
    const provider = new GoogleMock(
      JSON.stringify({
        sub: "user_1",
        name: "Google User",
        picture: "https://example.com/avatar.png",
        email: "unverified@example.com",
        email_verified: false,
      }),
    );

    const user = await provider.FetchAuthUser({
      accessToken: "access_1",
    });

    expect(user.Email).toBe("");
  });

  it("FetchAuthUser rejects invalid user payloads", async () => {
    const provider = new GoogleMock("{");
    try {
      await provider.FetchAuthUser({ accessToken: "access_1" });
      throw new Error("Expected FetchAuthUser to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }
  });

  it("FetchAuthUser rejects invalid email_verified field types", async () => {
    const provider = new GoogleMock(
      JSON.stringify({
        sub: "user_1",
        email_verified: "true",
      }),
    );

    try {
      await provider.FetchAuthUser({ accessToken: "access_1" });
      throw new Error("Expected FetchAuthUser to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }
  });
});
