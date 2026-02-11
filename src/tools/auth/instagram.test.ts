// PocketBun-only: provider-specific Instagram OAuth2 user mapping parity tests.

import { describe, expect, it } from "bun:test";
import type { OAuth2Token } from "./auth.ts";
import { ParseDateTime } from "../types/index.ts";
import { Instagram } from "./instagram.ts";

class InstagramMock extends Instagram {
  #rawUserInfo: string;

  constructor(rawUserInfo: string) {
    super();
    this.#rawUserInfo = rawUserInfo;
  }

  override async FetchRawUserInfo(_token: OAuth2Token): Promise<Uint8Array> {
    return new TextEncoder().encode(this.#rawUserInfo);
  }
}

describe("instagram provider", () => {
  it("FetchAuthUser maps profile fields and appends missing permissions from token", async () => {
    const provider = new InstagramMock(
      JSON.stringify({
        user_id: "ig_user_1",
        username: "ig_user",
        name: "Instagram User",
        profile_picture_url: "https://example.com/instagram.png",
      }),
    );

    const tokenExpiry = new Date("2026-02-17T15:16:17.000Z");
    const user = await provider.FetchAuthUser({
      accessToken: "access_1",
      refreshToken: "refresh_1",
      expiry: tokenExpiry,
      permissions: ["instagram_business_basic"],
    });

    expect(user.Id).toBe("ig_user_1");
    expect(user.Username).toBe("ig_user");
    expect(user.Name).toBe("Instagram User");
    expect(user.AvatarURL).toBe("https://example.com/instagram.png");
    expect(user.AccessToken).toBe("access_1");
    expect(user.RefreshToken).toBe("refresh_1");
    expect(user.Expiry.Equal(ParseDateTime(tokenExpiry))).toBe(true);
    expect(user.RawUser.permissions).toEqual(["instagram_business_basic"]);
  });

  it("FetchAuthUser keeps payload permissions when already present", async () => {
    const provider = new InstagramMock(
      JSON.stringify({
        user_id: "ig_user_2",
        permissions: ["from_payload"],
      }),
    );

    const user = await provider.FetchAuthUser({
      accessToken: "access_2",
      permissions: ["from_token"],
    });

    expect(user.RawUser.permissions).toEqual(["from_payload"]);
  });

  it("FetchAuthUser rejects malformed user payload", async () => {
    const provider = new InstagramMock("{");

    try {
      await provider.FetchAuthUser({ accessToken: "access_3" });
      throw new Error("Expected FetchAuthUser to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }
  });

  it("FetchAuthUser rejects invalid user payload field types", async () => {
    const provider = new InstagramMock(
      JSON.stringify({
        user_id: 123,
      }),
    );

    try {
      await provider.FetchAuthUser({ accessToken: "access_4" });
      throw new Error("Expected FetchAuthUser to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }
  });
});
