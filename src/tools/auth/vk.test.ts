// PocketBun-only: provider-specific VK OAuth2 user mapping parity tests.

import { describe, expect, it } from "bun:test";
import type { OAuth2Token } from "./auth.ts";
import { ParseDateTime } from "../types/index.ts";
import { VK } from "./vk.ts";

class VKMock extends VK {
  #rawUserInfo: string;

  constructor(rawUserInfo: string) {
    super();
    this.#rawUserInfo = rawUserInfo;
  }

  override async FetchRawUserInfo(_token: OAuth2Token): Promise<Uint8Array> {
    return new TextEncoder().encode(this.#rawUserInfo);
  }
}

describe("vk provider", () => {
  it("FetchAuthUser maps profile fields and token email", async () => {
    const provider = new VKMock(
      JSON.stringify({
        response: [
          {
            id: 123,
            first_name: "VK",
            last_name: "User",
            screen_name: "vk_login",
            photo_max: "https://example.com/vk.png",
          },
        ],
      }),
    );

    const tokenExpiry = new Date("2026-02-18T18:11:12.000Z");
    const user = await provider.FetchAuthUser({
      accessToken: "access_1",
      refreshToken: "refresh_1",
      expiry: tokenExpiry,
      email: 42,
    });

    expect(user.Id).toBe("123");
    expect(user.Name).toBe("VK User");
    expect(user.Username).toBe("vk_login");
    expect(user.AvatarURL).toBe("https://example.com/vk.png");
    expect(user.Email).toBe("42");
    expect(user.AccessToken).toBe("access_1");
    expect(user.RefreshToken).toBe("refresh_1");
    expect(user.Expiry.Equal(ParseDateTime(tokenExpiry))).toBe(true);
  });

  it("FetchAuthUser returns error for empty response list", async () => {
    const provider = new VKMock(JSON.stringify({ response: [] }));
    try {
      await provider.FetchAuthUser({ accessToken: "access_2" });
      throw new Error("Expected FetchAuthUser to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe("missing response entry");
    }
  });

  it("FetchAuthUser rejects malformed or invalid payloads", async () => {
    const malformed = new VKMock("{");
    try {
      await malformed.FetchAuthUser({ accessToken: "access_3" });
      throw new Error("Expected malformed payload to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }

    const invalid = new VKMock(
      JSON.stringify({
        response: [{ id: "123" }],
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
