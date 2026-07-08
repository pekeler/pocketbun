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

  it("SetExtra adds openid scope when id_token email extraction is configured", () => {
    const provider = new MicrosoftMock("{}");

    expect(provider.Scopes()).toEqual(["User.Read"]);

    provider.SetExtra({ idTokenEmailClaim: "email" });
    provider.SetExtra({ idTokenEmailClaim: "email" });

    expect(provider.Scopes()).toEqual(["User.Read", "openid"]);
  });

  it("FetchAuthUser extracts configured id_token email claims", async () => {
    const scenarios = [
      {
        claim: "email",
        claims: { email: "token@example.com" },
        expected: "token@example.com",
      },
      {
        claim: "email_and_xms_edov",
        claims: { email: "domain@example.com", xms_edov: true },
        expected: "domain@example.com",
      },
      {
        claim: "email_and_xms_edov",
        claims: { email: "unverified@example.com", xms_edov: false },
        expected: "",
      },
      {
        claim: "verified_primary_email",
        claims: { verified_primary_email: "primary@example.com" },
        expected: "primary@example.com",
      },
      {
        claim: "any_verified",
        claims: { email: "domain@example.com", xms_edov: true },
        expected: "domain@example.com",
      },
      {
        claim: "any_verified",
        claims: {
          email: "domain@example.com",
          verified_primary_email: "primary@example.com",
          xms_edov: true,
        },
        expected: "primary@example.com",
      },
    ];

    for (const scenario of scenarios) {
      const provider = new MicrosoftMock(
        JSON.stringify({
          id: "ms_user_3",
          displayName: "Microsoft User",
          mail: "graph@example.com",
        }),
      );
      provider.SetExtra({ idTokenEmailClaim: scenario.claim });

      const user = await provider.FetchAuthUser({
        accessToken: "access_5",
        id_token: buildIDToken(scenario.claims),
      });

      expect(user.Email).toBe(scenario.expected);
    }
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

function buildIDToken(claims: Record<string, unknown>): string {
  const now = Math.floor(Date.now() / 1000);
  return [
    encodeJWTPart({ alg: "none", typ: "JWT" }),
    encodeJWTPart({ exp: now + 3600, iat: now, ...claims }),
    encodeJWTPart("signature"),
  ].join(".");
}

function encodeJWTPart(value: unknown): string {
  return Buffer.from(typeof value === "string" ? value : JSON.stringify(value), "utf8").toString("base64url");
}
