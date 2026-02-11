// PocketBun-only: provider-specific Lark OAuth2 user mapping parity tests.

import { describe, expect, it } from "bun:test";
import type { OAuth2Token } from "./auth.ts";
import { ParseDateTime } from "../types/index.ts";
import { Lark } from "./lark.ts";

class LarkMock extends Lark {
  #rawUserInfo: string;

  constructor(rawUserInfo: string) {
    super();
    this.#rawUserInfo = rawUserInfo;
  }

  override async FetchRawUserInfo(_token: OAuth2Token): Promise<Uint8Array> {
    return new TextEncoder().encode(this.#rawUserInfo);
  }
}

describe("lark provider", () => {
  it("FetchAuthUser maps profile fields", async () => {
    const provider = new LarkMock(
      JSON.stringify({
        data: {
          union_id: "lark_user_1",
          name: "Lark User",
          avatar_url: "https://example.com/lark.png",
        },
      }),
    );

    const tokenExpiry = new Date("2026-02-15T10:11:12.000Z");
    const user = await provider.FetchAuthUser({
      accessToken: "access_1",
      refreshToken: "refresh_1",
      expiry: tokenExpiry,
    });

    expect(user.Id).toBe("lark_user_1");
    expect(user.Name).toBe("Lark User");
    expect(user.AvatarURL).toBe("https://example.com/lark.png");
    expect(user.AccessToken).toBe("access_1");
    expect(user.RefreshToken).toBe("refresh_1");
    expect(user.Expiry.Equal(ParseDateTime(tokenExpiry))).toBe(true);
  });

  it("FetchAuthUser accepts missing optional fields", async () => {
    const provider = new LarkMock(
      JSON.stringify({
        data: {
          union_id: "lark_user_2",
        },
      }),
    );

    const user = await provider.FetchAuthUser({
      accessToken: "access_2",
    });

    expect(user.Id).toBe("lark_user_2");
    expect(user.Name).toBe("");
    expect(user.AvatarURL).toBe("");
  });

  it("FetchAuthUser rejects malformed user payload", async () => {
    const provider = new LarkMock("{");

    try {
      await provider.FetchAuthUser({ accessToken: "access_3" });
      throw new Error("Expected FetchAuthUser to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }
  });

  it("FetchAuthUser rejects invalid nested field types", async () => {
    const provider = new LarkMock(
      JSON.stringify({
        data: {
          union_id: 123,
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

  it("FetchAuthUser rejects invalid data field types", async () => {
    const provider = new LarkMock(
      JSON.stringify({
        data: 123,
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
