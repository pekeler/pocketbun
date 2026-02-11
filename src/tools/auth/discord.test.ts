// PocketBun-only: provider-specific Discord OAuth2 user mapping parity tests.

import { describe, expect, it } from "bun:test";
import type { OAuth2Token } from "./auth.ts";
import { ParseDateTime } from "../types/index.ts";
import { Discord } from "./discord.ts";

class DiscordMock extends Discord {
  #rawUserInfo: string;

  constructor(rawUserInfo: string) {
    super();
    this.#rawUserInfo = rawUserInfo;
  }

  override async FetchRawUserInfo(_token: OAuth2Token): Promise<Uint8Array> {
    return new TextEncoder().encode(this.#rawUserInfo);
  }
}

describe("discord provider", () => {
  it("FetchAuthUser maps verified profile fields", async () => {
    const provider = new DiscordMock(
      JSON.stringify({
        id: "discord_user_1",
        username: "discord-user",
        discriminator: "0420",
        avatar: "avatar_hash",
        email: "discord@example.com",
        verified: true,
      }),
    );

    const tokenExpiry = new Date("2026-02-12T15:16:17.000Z");
    const user = await provider.FetchAuthUser({
      accessToken: "access_1",
      refreshToken: "refresh_1",
      expiry: tokenExpiry,
    });

    expect(user.Id).toBe("discord_user_1");
    expect(user.Name).toBe("discord-user#0420");
    expect(user.Username).toBe("discord-user");
    expect(user.AvatarURL).toBe("https://cdn.discordapp.com/avatars/discord_user_1/avatar_hash.png");
    expect(user.Email).toBe("discord@example.com");
    expect(user.AccessToken).toBe("access_1");
    expect(user.RefreshToken).toBe("refresh_1");
    expect(user.Expiry.Equal(ParseDateTime(tokenExpiry))).toBe(true);
  });

  it("FetchAuthUser keeps email empty when user is unverified", async () => {
    const provider = new DiscordMock(
      JSON.stringify({
        id: "discord_user_2",
        username: "discord-user-2",
        discriminator: "1337",
        avatar: "avatar_hash_2",
        email: "private@example.com",
        verified: false,
      }),
    );

    const user = await provider.FetchAuthUser({
      accessToken: "access_2",
    });

    expect(user.Email).toBe("");
    expect(user.Name).toBe("discord-user-2#1337");
  });

  it("FetchAuthUser accepts missing optional fields", async () => {
    const provider = new DiscordMock(
      JSON.stringify({
        id: "discord_user_3",
      }),
    );

    const user = await provider.FetchAuthUser({
      accessToken: "access_3",
    });

    expect(user.Id).toBe("discord_user_3");
    expect(user.Name).toBe("#");
    expect(user.Username).toBe("");
    expect(user.AvatarURL).toBe("https://cdn.discordapp.com/avatars/discord_user_3/.png");
    expect(user.Email).toBe("");
  });

  it("FetchAuthUser rejects malformed user payload", async () => {
    const provider = new DiscordMock("{");

    try {
      await provider.FetchAuthUser({ accessToken: "access_4" });
      throw new Error("Expected FetchAuthUser to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }
  });

  it("FetchAuthUser rejects invalid user payload field types", async () => {
    const provider = new DiscordMock(
      JSON.stringify({
        id: 123,
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
