// PocketBun-only: provider-specific Planning Center OAuth2 user mapping parity tests.

import { describe, expect, it } from "bun:test";
import type { OAuth2Token } from "./auth.ts";
import { ParseDateTime } from "../types/index.ts";
import { Planningcenter } from "./planningcenter.ts";

class PlanningcenterMock extends Planningcenter {
  #rawUserInfo: string;

  constructor(rawUserInfo: string) {
    super();
    this.#rawUserInfo = rawUserInfo;
  }

  override async FetchRawUserInfo(_token: OAuth2Token): Promise<Uint8Array> {
    return new TextEncoder().encode(this.#rawUserInfo);
  }
}

describe("planningcenter provider", () => {
  it("FetchAuthUser maps profile fields for active users", async () => {
    const provider = new PlanningcenterMock(
      JSON.stringify({
        data: {
          id: "pc_user_1",
          attributes: {
            status: "active",
            name: "Planning Center User",
            avatar: "https://example.com/planningcenter.png",
          },
        },
      }),
    );

    const tokenExpiry = new Date("2026-02-18T20:11:12.000Z");
    const user = await provider.FetchAuthUser({
      accessToken: "access_1",
      refreshToken: "refresh_1",
      expiry: tokenExpiry,
    });

    expect(user.Id).toBe("pc_user_1");
    expect(user.Name).toBe("Planning Center User");
    expect(user.AvatarURL).toBe("https://example.com/planningcenter.png");
    expect(user.AccessToken).toBe("access_1");
    expect(user.RefreshToken).toBe("refresh_1");
    expect(user.Expiry.Equal(ParseDateTime(tokenExpiry))).toBe(true);
  });

  it("FetchAuthUser rejects inactive users", async () => {
    const provider = new PlanningcenterMock(
      JSON.stringify({
        data: {
          id: "pc_user_2",
          attributes: {
            status: "inactive",
          },
        },
      }),
    );

    try {
      await provider.FetchAuthUser({ accessToken: "access_2" });
      throw new Error("Expected FetchAuthUser to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe("the user is not active");
    }
  });

  it("FetchAuthUser rejects malformed or invalid payloads", async () => {
    const malformed = new PlanningcenterMock("{");
    try {
      await malformed.FetchAuthUser({ accessToken: "access_3" });
      throw new Error("Expected malformed payload to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }

    const invalid = new PlanningcenterMock(
      JSON.stringify({
        data: {
          id: "pc_user_4",
          attributes: {
            status: 123,
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
