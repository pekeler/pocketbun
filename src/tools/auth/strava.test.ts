// PocketBun-only: provider-specific Strava OAuth2 user mapping parity tests.

import { describe, expect, it } from "bun:test";
import type { OAuth2Token } from "./auth.ts";
import { ParseDateTime } from "../types/index.ts";
import { Strava } from "./strava.ts";

class StravaMock extends Strava {
  #rawUserInfo: string;

  constructor(rawUserInfo: string) {
    super();
    this.#rawUserInfo = rawUserInfo;
  }

  override async FetchRawUserInfo(_token: OAuth2Token): Promise<Uint8Array> {
    return new TextEncoder().encode(this.#rawUserInfo);
  }
}

describe("strava provider", () => {
  it("FetchAuthUser maps profile fields and numeric id", async () => {
    const provider = new StravaMock(
      JSON.stringify({
        id: 1234,
        firstname: "Strava",
        lastname: "User",
        username: "strava_login",
        profile: "https://example.com/strava.png",
      }),
    );

    const tokenExpiry = new Date("2026-02-18T23:11:12.000Z");
    const user = await provider.FetchAuthUser({
      accessToken: "access_1",
      refreshToken: "refresh_1",
      expiry: tokenExpiry,
    });

    expect(user.Id).toBe("1234");
    expect(user.Name).toBe("Strava User");
    expect(user.Username).toBe("strava_login");
    expect(user.AvatarURL).toBe("https://example.com/strava.png");
    expect(user.AccessToken).toBe("access_1");
    expect(user.RefreshToken).toBe("refresh_1");
    expect(user.Expiry.Equal(ParseDateTime(tokenExpiry))).toBe(true);
  });

  it("FetchAuthUser keeps id empty when id is zero", async () => {
    const provider = new StravaMock(
      JSON.stringify({
        id: 0,
        firstname: "No",
        lastname: "Id",
      }),
    );

    const user = await provider.FetchAuthUser({ accessToken: "access_2" });
    expect(user.Id).toBe("");
    expect(user.Name).toBe("No Id");
  });

  it("FetchAuthUser rejects malformed or invalid payloads", async () => {
    const malformed = new StravaMock("{");
    try {
      await malformed.FetchAuthUser({ accessToken: "access_3" });
      throw new Error("Expected malformed payload to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }

    const invalid = new StravaMock(
      JSON.stringify({
        id: "123",
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
