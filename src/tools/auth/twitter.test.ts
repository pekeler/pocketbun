// PocketBun-only: provider-specific Twitter OAuth2 user mapping parity tests.

import { describe, expect, it } from "bun:test";
import type { OAuth2Token } from "./auth.ts";
import { ParseDateTime } from "../types/index.ts";
import { Twitter } from "./twitter.ts";

class TwitterMock extends Twitter {
  #rawUserInfo: string;

  constructor(rawUserInfo: string) {
    super();
    this.#rawUserInfo = rawUserInfo;
  }

  override async FetchRawUserInfo(_token: OAuth2Token): Promise<Uint8Array> {
    return new TextEncoder().encode(this.#rawUserInfo);
  }
}

describe("twitter provider", () => {
  it("FetchAuthUser maps profile fields", async () => {
    const provider = new TwitterMock(
      JSON.stringify({
        data: {
          id: "x_user_1",
          name: "X User",
          username: "x_user",
          confirmed_email: "x@example.com",
          profile_image_url: "https://example.com/x.png",
        },
      }),
    );

    const tokenExpiry = new Date("2026-02-18T16:11:12.000Z");
    const user = await provider.FetchAuthUser({
      accessToken: "access_1",
      refreshToken: "refresh_1",
      expiry: tokenExpiry,
    });

    expect(user.Id).toBe("x_user_1");
    expect(user.Name).toBe("X User");
    expect(user.Username).toBe("x_user");
    expect(user.Email).toBe("x@example.com");
    expect(user.AvatarURL).toBe("https://example.com/x.png");
    expect(user.AccessToken).toBe("access_1");
    expect(user.RefreshToken).toBe("refresh_1");
    expect(user.Expiry.Equal(ParseDateTime(tokenExpiry))).toBe(true);
  });

  it("FetchAuthUser accepts missing optional fields", async () => {
    const provider = new TwitterMock(
      JSON.stringify({
        data: {
          id: "x_user_2",
        },
      }),
    );

    const user = await provider.FetchAuthUser({ accessToken: "access_2" });
    expect(user.Name).toBe("");
    expect(user.Username).toBe("");
    expect(user.Email).toBe("");
    expect(user.AvatarURL).toBe("");
  });

  it("FetchAuthUser rejects malformed or invalid payloads", async () => {
    const malformed = new TwitterMock("{");
    try {
      await malformed.FetchAuthUser({ accessToken: "access_3" });
      throw new Error("Expected malformed payload to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }

    const invalid = new TwitterMock(
      JSON.stringify({
        data: {
          id: 123,
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
