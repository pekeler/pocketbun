// PocketBun-only: provider-specific Gitee OAuth2 user mapping parity tests.

import { describe, expect, it } from "bun:test";
import type { OAuth2Token } from "./auth.ts";
import { ParseDateTime } from "../types/index.ts";
import { Gitee } from "./gitee.ts";

class GiteeMock extends Gitee {
  #rawUserInfo: string;
  #emailsResponse: Response;
  emailCalls = 0;

  constructor(rawUserInfo: string, emailsResponse: Response) {
    super();
    this.#rawUserInfo = rawUserInfo;
    this.#emailsResponse = emailsResponse;
  }

  override async FetchRawUserInfo(_token: OAuth2Token): Promise<Uint8Array> {
    return new TextEncoder().encode(this.#rawUserInfo);
  }

  override Client(_token: OAuth2Token | null): (input: Request | URL | string, init?: RequestInit) => Promise<Response> {
    return async (input, _init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url === "https://gitee.com/api/v5/emails") {
        this.emailCalls += 1;
        return this.#emailsResponse.clone() as unknown as Response;
      }

      throw new Error(`unexpected request URL: ${url}`);
    };
  }
}

describe("gitee provider", () => {
  it("FetchAuthUser maps profile fields and keeps valid public email", async () => {
    const provider = new GiteeMock(
      JSON.stringify({
        id: 101,
        login: "gitee_login",
        name: "Gitee User",
        email: "gitee@example.com",
        avatar_url: "https://example.com/gitee.png",
      }),
      Response.json([]),
    );

    const tokenExpiry = new Date("2026-02-17T16:16:17.000Z");
    const user = await provider.FetchAuthUser({
      accessToken: "access_1",
      refreshToken: "refresh_1",
      expiry: tokenExpiry,
    });

    expect(user.Id).toBe("101");
    expect(user.Username).toBe("gitee_login");
    expect(user.Name).toBe("Gitee User");
    expect(user.Email).toBe("gitee@example.com");
    expect(user.AvatarURL).toBe("https://example.com/gitee.png");
    expect(user.AccessToken).toBe("access_1");
    expect(user.RefreshToken).toBe("refresh_1");
    expect(user.Expiry.Equal(ParseDateTime(tokenExpiry))).toBe(true);
    expect(provider.emailCalls).toBe(0);
  });

  it("FetchAuthUser falls back to first confirmed primary email", async () => {
    const provider = new GiteeMock(
      JSON.stringify({
        id: 102,
        login: "gitee_login_2",
        email: "not-an-email",
      }),
      Response.json([
        { email: "secondary@example.com", state: "confirmed", scope: ["backup"] },
        { email: "primary@example.com", state: "confirmed", scope: ["primary"] },
      ]),
    );

    const user = await provider.FetchAuthUser({
      accessToken: "access_2",
    });

    expect(user.Email).toBe("primary@example.com");
    expect(provider.emailCalls).toBe(1);
  });

  it("FetchAuthUser ignores insufficient-scope email endpoint errors", async () => {
    const provider = new GiteeMock(
      JSON.stringify({
        id: 103,
        login: "gitee_login_3",
        email: "hidden",
      }),
      new Response("forbidden", { status: 403 }),
    );

    const user = await provider.FetchAuthUser({
      accessToken: "access_3",
    });

    expect(user.Email).toBe("");
    expect(provider.emailCalls).toBe(1);
  });

  it("FetchAuthUser ignores malformed email payload responses", async () => {
    const provider = new GiteeMock(
      JSON.stringify({
        id: 104,
        login: "gitee_login_4",
        email: "hidden",
      }),
      Response.json({ email: "no-array" }),
    );

    const user = await provider.FetchAuthUser({
      accessToken: "access_4",
    });

    expect(user.Email).toBe("");
    expect(provider.emailCalls).toBe(1);
  });

  it("FetchAuthUser rejects malformed user payload", async () => {
    const provider = new GiteeMock("{", Response.json([]));

    try {
      await provider.FetchAuthUser({ accessToken: "access_5" });
      throw new Error("Expected FetchAuthUser to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }
  });

  it("FetchAuthUser rejects invalid user payload field types", async () => {
    const provider = new GiteeMock(
      JSON.stringify({
        id: "invalid",
      }),
      Response.json([]),
    );

    try {
      await provider.FetchAuthUser({ accessToken: "access_6" });
      throw new Error("Expected FetchAuthUser to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }
  });
});
