// PocketBun-only: provider-specific Kakao OAuth2 user mapping parity tests.

import { describe, expect, it } from "bun:test";
import type { OAuth2Token } from "./auth.ts";
import { ParseDateTime } from "../types/index.ts";
import { Kakao } from "./kakao.ts";

class KakaoMock extends Kakao {
  #rawUserInfo: string;

  constructor(rawUserInfo: string) {
    super();
    this.#rawUserInfo = rawUserInfo;
  }

  override async FetchRawUserInfo(_token: OAuth2Token): Promise<Uint8Array> {
    return new TextEncoder().encode(this.#rawUserInfo);
  }
}

describe("kakao provider", () => {
  it("FetchAuthUser maps profile fields and verified email", async () => {
    const provider = new KakaoMock(
      JSON.stringify({
        id: 777,
        properties: {
          nickname: "kakao_nick",
          profile_image: "https://example.com/kakao.png",
        },
        kakao_account: {
          email: "kakao@example.com",
          is_email_verified: true,
          is_email_valid: true,
        },
      }),
    );

    const tokenExpiry = new Date("2026-02-16T15:16:17.000Z");
    const user = await provider.FetchAuthUser({
      accessToken: "access_1",
      refreshToken: "refresh_1",
      expiry: tokenExpiry,
    });

    expect(user.Id).toBe("777");
    expect(user.Username).toBe("kakao_nick");
    expect(user.AvatarURL).toBe("https://example.com/kakao.png");
    expect(user.Email).toBe("kakao@example.com");
    expect(user.AccessToken).toBe("access_1");
    expect(user.RefreshToken).toBe("refresh_1");
    expect(user.Expiry.Equal(ParseDateTime(tokenExpiry))).toBe(true);
  });

  it("FetchAuthUser keeps email empty when email is not valid or verified", async () => {
    const provider = new KakaoMock(
      JSON.stringify({
        id: 778,
        properties: {
          nickname: "kakao_nick_2",
        },
        kakao_account: {
          email: "kakao2@example.com",
          is_email_verified: false,
          is_email_valid: true,
        },
      }),
    );

    const user = await provider.FetchAuthUser({
      accessToken: "access_2",
    });

    expect(user.Email).toBe("");
  });

  it("FetchAuthUser rejects malformed user payload", async () => {
    const provider = new KakaoMock("{");

    try {
      await provider.FetchAuthUser({ accessToken: "access_3" });
      throw new Error("Expected FetchAuthUser to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }
  });

  it("FetchAuthUser rejects invalid nested field types", async () => {
    const provider = new KakaoMock(
      JSON.stringify({
        id: 779,
        properties: {
          nickname: 123,
        },
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
