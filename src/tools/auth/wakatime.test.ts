// PocketBun-only: provider-specific WakaTime OAuth2 user mapping parity tests.

import { describe, expect, it } from "bun:test";
import type { OAuth2Token } from "./auth.ts";
import { ParseDateTime } from "../types/index.ts";
import { Wakatime } from "./wakatime.ts";

class WakatimeMock extends Wakatime {
  #rawUserInfo: string;

  constructor(rawUserInfo: string) {
    super();
    this.#rawUserInfo = rawUserInfo;
  }

  override async FetchRawUserInfo(_token: OAuth2Token): Promise<Uint8Array> {
    return new TextEncoder().encode(this.#rawUserInfo);
  }
}

describe("wakatime provider", () => {
  it("FetchAuthUser maps profile fields and public email/photo", async () => {
    const provider = new WakatimeMock(
      JSON.stringify({
        data: {
          id: "waka_user_1",
          display_name: "Waka User",
          username: "waka_login",
          email: "waka@example.com",
          photo: "https://example.com/waka.png",
          photo_public: true,
          is_email_confirmed: true,
        },
      }),
    );

    const tokenExpiry = new Date("2026-02-18T17:11:12.000Z");
    const user = await provider.FetchAuthUser({
      accessToken: "access_1",
      refreshToken: "refresh_1",
      expiry: tokenExpiry,
    });

    expect(user.Id).toBe("waka_user_1");
    expect(user.Name).toBe("Waka User");
    expect(user.Username).toBe("waka_login");
    expect(user.Email).toBe("waka@example.com");
    expect(user.AvatarURL).toBe("https://example.com/waka.png");
    expect(user.AccessToken).toBe("access_1");
    expect(user.RefreshToken).toBe("refresh_1");
    expect(user.Expiry.Equal(ParseDateTime(tokenExpiry))).toBe(true);
  });

  it("FetchAuthUser keeps email/photo empty when not public or confirmed", async () => {
    const provider = new WakatimeMock(
      JSON.stringify({
        data: {
          id: "waka_user_2",
          email: "hidden@example.com",
          photo: "https://example.com/private.png",
          photo_public: false,
          is_email_confirmed: false,
        },
      }),
    );

    const user = await provider.FetchAuthUser({ accessToken: "access_2" });
    expect(user.Email).toBe("");
    expect(user.AvatarURL).toBe("");
  });

  it("FetchAuthUser rejects malformed or invalid payloads", async () => {
    const malformed = new WakatimeMock("{");
    try {
      await malformed.FetchAuthUser({ accessToken: "access_3" });
      throw new Error("Expected malformed payload to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }

    const invalid = new WakatimeMock(
      JSON.stringify({
        data: {
          id: "waka_user_4",
          photo_public: "yes",
        },
      }),
    );
    try {
      await invalid.FetchAuthUser({ accessToken: "access_4" });
      throw new Error("Expected invalid payload to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }
  });
});
