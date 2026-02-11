// PocketBun-only: provider-specific Patreon OAuth2 user mapping parity tests.

import { describe, expect, it } from "bun:test";
import type { OAuth2Token } from "./auth.ts";
import { ParseDateTime } from "../types/index.ts";
import { Patreon } from "./patreon.ts";

class PatreonMock extends Patreon {
  #rawUserInfo: string;

  constructor(rawUserInfo: string) {
    super();
    this.#rawUserInfo = rawUserInfo;
  }

  override async FetchRawUserInfo(_token: OAuth2Token): Promise<Uint8Array> {
    return new TextEncoder().encode(this.#rawUserInfo);
  }
}

describe("patreon provider", () => {
  it("FetchAuthUser maps profile fields and verified email", async () => {
    const provider = new PatreonMock(
      JSON.stringify({
        data: {
          id: "patreon_user_1",
          attributes: {
            full_name: "Patreon User",
            vanity: "patreon_login",
            email: "patreon@example.com",
            image_url: "https://example.com/patreon.png",
            is_email_verified: true,
          },
        },
      }),
    );

    const tokenExpiry = new Date("2026-02-18T14:11:12.000Z");
    const user = await provider.FetchAuthUser({
      accessToken: "access_1",
      refreshToken: "refresh_1",
      expiry: tokenExpiry,
    });

    expect(user.Id).toBe("patreon_user_1");
    expect(user.Name).toBe("Patreon User");
    expect(user.Username).toBe("patreon_login");
    expect(user.Email).toBe("patreon@example.com");
    expect(user.AvatarURL).toBe("https://example.com/patreon.png");
    expect(user.AccessToken).toBe("access_1");
    expect(user.RefreshToken).toBe("refresh_1");
    expect(user.Expiry.Equal(ParseDateTime(tokenExpiry))).toBe(true);
  });

  it("FetchAuthUser keeps email empty when email is not verified", async () => {
    const provider = new PatreonMock(
      JSON.stringify({
        data: {
          id: "patreon_user_2",
          attributes: {
            email: "hidden@example.com",
            is_email_verified: false,
          },
        },
      }),
    );

    const user = await provider.FetchAuthUser({ accessToken: "access_2" });
    expect(user.Email).toBe("");
  });

  it("FetchAuthUser rejects malformed or invalid payloads", async () => {
    const malformed = new PatreonMock("{");
    try {
      await malformed.FetchAuthUser({ accessToken: "access_3" });
      throw new Error("Expected malformed payload to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }

    const invalid = new PatreonMock(
      JSON.stringify({
        data: {
          id: "patreon_user_4",
          attributes: {
            is_email_verified: "yes",
          },
        },
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
