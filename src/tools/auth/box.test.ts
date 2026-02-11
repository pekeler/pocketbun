// PocketBun-only: provider-specific Box OAuth2 user mapping parity tests.

import { describe, expect, it } from "bun:test";
import type { OAuth2Token } from "./auth.ts";
import { ParseDateTime } from "../types/index.ts";
import { Box } from "./box.ts";

class BoxMock extends Box {
  #rawUserInfo: string;

  constructor(rawUserInfo: string) {
    super();
    this.#rawUserInfo = rawUserInfo;
  }

  override async FetchRawUserInfo(_token: OAuth2Token): Promise<Uint8Array> {
    return new TextEncoder().encode(this.#rawUserInfo);
  }
}

describe("box provider", () => {
  it("FetchAuthUser maps profile fields for active users", async () => {
    const provider = new BoxMock(
      JSON.stringify({
        id: "box_user_1",
        name: "Box User",
        login: "box@example.com",
        avatar_url: "https://example.com/avatar.png",
        status: "active",
      }),
    );

    const tokenExpiry = new Date("2026-02-13T15:16:17.000Z");
    const user = await provider.FetchAuthUser({
      accessToken: "access_1",
      refreshToken: "refresh_1",
      expiry: tokenExpiry,
    });

    expect(user.Id).toBe("box_user_1");
    expect(user.Name).toBe("Box User");
    expect(user.Email).toBe("box@example.com");
    expect(user.AvatarURL).toBe("https://example.com/avatar.png");
    expect(user.AccessToken).toBe("access_1");
    expect(user.RefreshToken).toBe("refresh_1");
    expect(user.Expiry.Equal(ParseDateTime(tokenExpiry))).toBe(true);
  });

  it("FetchAuthUser accepts missing optional profile fields", async () => {
    const provider = new BoxMock(
      JSON.stringify({
        id: "box_user_2",
        status: "active",
      }),
    );

    const user = await provider.FetchAuthUser({
      accessToken: "access_2",
    });

    expect(user.Id).toBe("box_user_2");
    expect(user.Name).toBe("");
    expect(user.Email).toBe("");
    expect(user.AvatarURL).toBe("");
  });

  it("FetchAuthUser rejects inactive accounts", async () => {
    const provider = new BoxMock(
      JSON.stringify({
        id: "box_user_3",
        status: "inactive",
      }),
    );

    try {
      await provider.FetchAuthUser({ accessToken: "access_3" });
      throw new Error("Expected FetchAuthUser to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe('Box user account is not active (status: "inactive")');
    }
  });

  it("FetchAuthUser rejects malformed user payload", async () => {
    const provider = new BoxMock("{");

    try {
      await provider.FetchAuthUser({ accessToken: "access_4" });
      throw new Error("Expected FetchAuthUser to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }
  });

  it("FetchAuthUser rejects invalid user payload field types", async () => {
    const provider = new BoxMock(
      JSON.stringify({
        id: 123,
        status: "active",
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
