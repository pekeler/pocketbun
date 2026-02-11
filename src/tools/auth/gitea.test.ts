// PocketBun-only: provider-specific Gitea OAuth2 user mapping parity tests.

import { describe, expect, it } from "bun:test";
import type { OAuth2Token } from "./auth.ts";
import { ParseDateTime } from "../types/index.ts";
import { Gitea } from "./gitea.ts";

class GiteaMock extends Gitea {
  #rawUserInfo: string;

  constructor(rawUserInfo: string) {
    super();
    this.#rawUserInfo = rawUserInfo;
  }

  override async FetchRawUserInfo(_token: OAuth2Token): Promise<Uint8Array> {
    return new TextEncoder().encode(this.#rawUserInfo);
  }
}

describe("gitea provider", () => {
  it("FetchAuthUser maps profile fields", async () => {
    const provider = new GiteaMock(
      JSON.stringify({
        id: 123,
        full_name: "Gitea User",
        login: "gitea_login",
        email: "gitea@example.com",
        avatar_url: "https://example.com/gitea.png",
      }),
    );

    const tokenExpiry = new Date("2026-02-16T10:11:12.000Z");
    const user = await provider.FetchAuthUser({
      accessToken: "access_1",
      refreshToken: "refresh_1",
      expiry: tokenExpiry,
    });

    expect(user.Id).toBe("123");
    expect(user.Name).toBe("Gitea User");
    expect(user.Username).toBe("gitea_login");
    expect(user.Email).toBe("gitea@example.com");
    expect(user.AvatarURL).toBe("https://example.com/gitea.png");
    expect(user.AccessToken).toBe("access_1");
    expect(user.RefreshToken).toBe("refresh_1");
    expect(user.Expiry.Equal(ParseDateTime(tokenExpiry))).toBe(true);
  });

  it("FetchAuthUser accepts missing optional fields", async () => {
    const provider = new GiteaMock(
      JSON.stringify({
        id: 999,
      }),
    );

    const user = await provider.FetchAuthUser({
      accessToken: "access_2",
    });

    expect(user.Id).toBe("999");
    expect(user.Name).toBe("");
    expect(user.Username).toBe("");
    expect(user.Email).toBe("");
    expect(user.AvatarURL).toBe("");
  });

  it("FetchAuthUser rejects malformed user payload", async () => {
    const provider = new GiteaMock("{");

    try {
      await provider.FetchAuthUser({ accessToken: "access_3" });
      throw new Error("Expected FetchAuthUser to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }
  });

  it("FetchAuthUser rejects invalid id field types", async () => {
    const provider = new GiteaMock(
      JSON.stringify({
        id: "123",
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
