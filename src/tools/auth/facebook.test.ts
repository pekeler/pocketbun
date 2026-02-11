// PocketBun-only: provider-specific Facebook OAuth2 user mapping parity tests.

import { describe, expect, it } from "bun:test";
import type { OAuth2Token } from "./auth.ts";
import { ParseDateTime } from "../types/index.ts";
import { Facebook } from "./facebook.ts";

class FacebookMock extends Facebook {
  #rawUserInfo: string;

  constructor(rawUserInfo: string) {
    super();
    this.#rawUserInfo = rawUserInfo;
  }

  override async FetchRawUserInfo(_token: OAuth2Token): Promise<Uint8Array> {
    return new TextEncoder().encode(this.#rawUserInfo);
  }
}

describe("facebook provider", () => {
  it("FetchAuthUser maps profile fields", async () => {
    const provider = new FacebookMock(
      JSON.stringify({
        id: "fb_user_1",
        name: "Facebook User",
        email: "facebook@example.com",
        picture: {
          data: {
            url: "https://example.com/avatar.png",
          },
        },
      }),
    );

    const tokenExpiry = new Date("2026-02-12T15:16:17.000Z");
    const user = await provider.FetchAuthUser({
      accessToken: "access_1",
      refreshToken: "refresh_1",
      expiry: tokenExpiry,
    });

    expect(user.Id).toBe("fb_user_1");
    expect(user.Name).toBe("Facebook User");
    expect(user.Email).toBe("facebook@example.com");
    expect(user.AvatarURL).toBe("https://example.com/avatar.png");
    expect(user.AccessToken).toBe("access_1");
    expect(user.RefreshToken).toBe("refresh_1");
    expect(user.Expiry.Equal(ParseDateTime(tokenExpiry))).toBe(true);
  });

  it("FetchAuthUser accepts missing optional fields", async () => {
    const provider = new FacebookMock(
      JSON.stringify({
        id: "fb_user_2",
      }),
    );

    const user = await provider.FetchAuthUser({
      accessToken: "access_2",
    });

    expect(user.Id).toBe("fb_user_2");
    expect(user.Name).toBe("");
    expect(user.Email).toBe("");
    expect(user.AvatarURL).toBe("");
  });

  it("FetchAuthUser rejects malformed user payload", async () => {
    const provider = new FacebookMock("{");

    try {
      await provider.FetchAuthUser({ accessToken: "access_3" });
      throw new Error("Expected FetchAuthUser to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }
  });

  it("FetchAuthUser rejects invalid user payload field types", async () => {
    const provider = new FacebookMock(
      JSON.stringify({
        id: 123,
      }),
    );

    try {
      await provider.FetchAuthUser({ accessToken: "access_4" });
      throw new Error("Expected FetchAuthUser to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }
  });

  it("FetchAuthUser rejects invalid picture field types", async () => {
    const provider = new FacebookMock(
      JSON.stringify({
        id: "fb_user_5",
        picture: "invalid",
      }),
    );

    try {
      await provider.FetchAuthUser({ accessToken: "access_5" });
      throw new Error("Expected FetchAuthUser to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }
  });
});
