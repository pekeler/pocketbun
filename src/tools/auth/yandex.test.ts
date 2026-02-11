// PocketBun-only: provider-specific Yandex OAuth2 user mapping parity tests.

import { describe, expect, it } from "bun:test";
import type { OAuth2Token } from "./auth.ts";
import { ParseDateTime } from "../types/index.ts";
import { Yandex } from "./yandex.ts";

class YandexMock extends Yandex {
  #rawUserInfo: string;

  constructor(rawUserInfo: string) {
    super();
    this.#rawUserInfo = rawUserInfo;
  }

  override async FetchRawUserInfo(_token: OAuth2Token): Promise<Uint8Array> {
    return new TextEncoder().encode(this.#rawUserInfo);
  }
}

describe("yandex provider", () => {
  it("FetchAuthUser maps profile fields and avatar URL", async () => {
    const provider = new YandexMock(
      JSON.stringify({
        id: "yx_user_1",
        real_name: "Yandex User",
        login: "yandex_login",
        default_email: "yandex@example.com",
        is_avatar_empty: false,
        default_avatar_id: "12345/abc",
      }),
    );

    const tokenExpiry = new Date("2026-02-18T15:11:12.000Z");
    const user = await provider.FetchAuthUser({
      accessToken: "access_1",
      refreshToken: "refresh_1",
      expiry: tokenExpiry,
    });

    expect(user.Id).toBe("yx_user_1");
    expect(user.Name).toBe("Yandex User");
    expect(user.Username).toBe("yandex_login");
    expect(user.Email).toBe("yandex@example.com");
    expect(user.AvatarURL).toBe("https://avatars.yandex.net/get-yapic/12345/abc/islands-200");
    expect(user.AccessToken).toBe("access_1");
    expect(user.RefreshToken).toBe("refresh_1");
    expect(user.Expiry.Equal(ParseDateTime(tokenExpiry))).toBe(true);
  });

  it("FetchAuthUser keeps avatar empty when avatar is empty", async () => {
    const provider = new YandexMock(
      JSON.stringify({
        id: "yx_user_2",
        is_avatar_empty: true,
        default_avatar_id: "unused",
      }),
    );

    const user = await provider.FetchAuthUser({ accessToken: "access_2" });
    expect(user.AvatarURL).toBe("");
  });

  it("FetchAuthUser rejects malformed or invalid payloads", async () => {
    const malformed = new YandexMock("{");
    try {
      await malformed.FetchAuthUser({ accessToken: "access_3" });
      throw new Error("Expected malformed payload to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }

    const invalid = new YandexMock(
      JSON.stringify({
        id: "yx_user_4",
        is_avatar_empty: "no",
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
