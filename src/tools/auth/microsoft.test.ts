// PocketBun-only: provider-specific Microsoft OAuth2 user mapping parity tests.

import { describe, expect, it } from "bun:test";
import type { OAuth2Token } from "./auth.ts";
import { ParseDateTime } from "../types/index.ts";
import { Microsoft } from "./microsoft.ts";

class MicrosoftMock extends Microsoft {
  #rawUserInfo: string;

  constructor(rawUserInfo: string) {
    super();
    this.#rawUserInfo = rawUserInfo;
  }

  override async FetchRawUserInfo(_token: OAuth2Token): Promise<Uint8Array> {
    return new TextEncoder().encode(this.#rawUserInfo);
  }
}

describe("microsoft provider", () => {
  it("FetchAuthUser maps profile fields", async () => {
    const provider = new MicrosoftMock(
      JSON.stringify({
        id: "ms_user_1",
        displayName: "Microsoft User",
        mail: "microsoft@example.com",
      }),
    );

    const tokenExpiry = new Date("2026-02-12T15:16:17.000Z");
    const user = await provider.FetchAuthUser({
      accessToken: "access_1",
      refreshToken: "refresh_1",
      expiry: tokenExpiry,
    });

    expect(user.Id).toBe("ms_user_1");
    expect(user.Name).toBe("Microsoft User");
    expect(user.Email).toBe("microsoft@example.com");
    expect(user.AccessToken).toBe("access_1");
    expect(user.RefreshToken).toBe("refresh_1");
    expect(user.Expiry.Equal(ParseDateTime(tokenExpiry))).toBe(true);
  });

  it("FetchAuthUser accepts missing optional fields", async () => {
    const provider = new MicrosoftMock(
      JSON.stringify({
        id: "ms_user_2",
      }),
    );

    const user = await provider.FetchAuthUser({
      accessToken: "access_2",
    });

    expect(user.Id).toBe("ms_user_2");
    expect(user.Name).toBe("");
    expect(user.Email).toBe("");
  });

  it("FetchAuthUser rejects malformed user payload", async () => {
    const provider = new MicrosoftMock("{");

    try {
      await provider.FetchAuthUser({ accessToken: "access_3" });
      throw new Error("Expected FetchAuthUser to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }
  });

  it("FetchAuthUser rejects invalid user payload field types", async () => {
    const provider = new MicrosoftMock(
      JSON.stringify({
        id: 123,
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
