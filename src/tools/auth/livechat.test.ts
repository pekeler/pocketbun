// PocketBun-only: provider-specific LiveChat OAuth2 user mapping parity tests.

import { describe, expect, it } from "bun:test";
import type { OAuth2Token } from "./auth.ts";
import { ParseDateTime } from "../types/index.ts";
import { Livechat } from "./livechat.ts";

class LivechatMock extends Livechat {
  #rawUserInfo: string;

  constructor(rawUserInfo: string) {
    super();
    this.#rawUserInfo = rawUserInfo;
  }

  override async FetchRawUserInfo(_token: OAuth2Token): Promise<Uint8Array> {
    return new TextEncoder().encode(this.#rawUserInfo);
  }
}

describe("livechat provider", () => {
  it("FetchAuthUser maps profile fields and verified email", async () => {
    const provider = new LivechatMock(
      JSON.stringify({
        account_id: "lc_user_1",
        name: "Livechat User",
        email: "livechat@example.com",
        email_verified: true,
        avatar_url: "https://example.com/livechat.png",
      }),
    );

    const tokenExpiry = new Date("2026-02-18T13:11:12.000Z");
    const user = await provider.FetchAuthUser({
      accessToken: "access_1",
      refreshToken: "refresh_1",
      expiry: tokenExpiry,
    });

    expect(user.Id).toBe("lc_user_1");
    expect(user.Name).toBe("Livechat User");
    expect(user.Email).toBe("livechat@example.com");
    expect(user.AvatarURL).toBe("https://example.com/livechat.png");
    expect(user.AccessToken).toBe("access_1");
    expect(user.RefreshToken).toBe("refresh_1");
    expect(user.Expiry.Equal(ParseDateTime(tokenExpiry))).toBe(true);
  });

  it("FetchAuthUser keeps email empty when email is not verified", async () => {
    const provider = new LivechatMock(
      JSON.stringify({
        account_id: "lc_user_2",
        email: "hidden@example.com",
        email_verified: false,
      }),
    );

    const user = await provider.FetchAuthUser({ accessToken: "access_2" });
    expect(user.Email).toBe("");
  });

  it("FetchAuthUser accepts missing optional fields", async () => {
    const provider = new LivechatMock(
      JSON.stringify({
        account_id: "lc_user_3",
      }),
    );

    const user = await provider.FetchAuthUser({ accessToken: "access_3" });
    expect(user.Id).toBe("lc_user_3");
    expect(user.Name).toBe("");
    expect(user.AvatarURL).toBe("");
  });

  it("FetchAuthUser rejects malformed or invalid payloads", async () => {
    const malformed = new LivechatMock("{");
    try {
      await malformed.FetchAuthUser({ accessToken: "access_4" });
      throw new Error("Expected malformed payload to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }

    const invalidType = new LivechatMock(
      JSON.stringify({
        account_id: 123,
      }),
    );
    try {
      await invalidType.FetchAuthUser({ accessToken: "access_5" });
      throw new Error("Expected invalid payload type to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }
  });
});
