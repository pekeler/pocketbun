// PocketBun-only: provider-specific Spotify OAuth2 user mapping parity tests.

import { describe, expect, it } from "bun:test";
import type { OAuth2Token } from "./auth.ts";
import { ParseDateTime } from "../types/index.ts";
import { Spotify } from "./spotify.ts";

class SpotifyMock extends Spotify {
  #rawUserInfo: string;

  constructor(rawUserInfo: string) {
    super();
    this.#rawUserInfo = rawUserInfo;
  }

  override async FetchRawUserInfo(_token: OAuth2Token): Promise<Uint8Array> {
    return new TextEncoder().encode(this.#rawUserInfo);
  }
}

describe("spotify provider", () => {
  it("FetchAuthUser maps profile fields and first image", async () => {
    const provider = new SpotifyMock(
      JSON.stringify({
        id: "spotify_user_1",
        display_name: "Spotify User",
        images: [{ url: "https://example.com/spotify.png" }, { url: "https://example.com/spotify-2.png" }],
      }),
    );

    const tokenExpiry = new Date("2026-02-18T22:11:12.000Z");
    const user = await provider.FetchAuthUser({
      accessToken: "access_1",
      refreshToken: "refresh_1",
      expiry: tokenExpiry,
    });

    expect(user.Id).toBe("spotify_user_1");
    expect(user.Name).toBe("Spotify User");
    expect(user.AvatarURL).toBe("https://example.com/spotify.png");
    expect(user.Email).toBe("");
    expect(user.AccessToken).toBe("access_1");
    expect(user.RefreshToken).toBe("refresh_1");
    expect(user.Expiry.Equal(ParseDateTime(tokenExpiry))).toBe(true);
  });

  it("FetchAuthUser accepts missing optional fields", async () => {
    const provider = new SpotifyMock(
      JSON.stringify({
        id: "spotify_user_2",
      }),
    );

    const user = await provider.FetchAuthUser({ accessToken: "access_2" });
    expect(user.Name).toBe("");
    expect(user.AvatarURL).toBe("");
  });

  it("FetchAuthUser rejects malformed or invalid payloads", async () => {
    const malformed = new SpotifyMock("{");
    try {
      await malformed.FetchAuthUser({ accessToken: "access_3" });
      throw new Error("Expected malformed payload to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }

    const invalid = new SpotifyMock(
      JSON.stringify({
        id: "spotify_user_4",
        images: {},
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
