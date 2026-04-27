// PocketBun-only: provider-specific Gitlab OAuth2 user mapping parity tests.

import { describe, expect, it } from "bun:test";
import type { OAuth2Token } from "./auth.ts";
import { ParseDateTime } from "../types/index.ts";
import { Gitlab } from "./gitlab.ts";

class GitlabMock extends Gitlab {
  #rawUserInfo: string;

  constructor(rawUserInfo: string) {
    super();
    this.#rawUserInfo = rawUserInfo;
  }

  override async FetchRawUserInfo(_token: OAuth2Token): Promise<Uint8Array> {
    return new TextEncoder().encode(this.#rawUserInfo);
  }
}

describe("gitlab provider", () => {
  it("FetchAuthUser maps profile fields", async () => {
    const provider = new GitlabMock(
      JSON.stringify({
        id: 456,
        name: "GitLab User",
        username: "gitlab-user",
        email: "gitlab@example.com",
        avatar_url: "https://example.com/avatar.png",
        confirmed_at: "2026-02-12T15:00:00Z",
      }),
    );

    const tokenExpiry = new Date("2026-02-12T15:16:17.000Z");
    const user = await provider.FetchAuthUser({
      accessToken: "access_1",
      refreshToken: "refresh_1",
      expiry: tokenExpiry,
    });

    expect(user.Id).toBe("456");
    expect(user.Name).toBe("GitLab User");
    expect(user.Username).toBe("gitlab-user");
    expect(user.Email).toBe("gitlab@example.com");
    expect(user.AvatarURL).toBe("https://example.com/avatar.png");
    expect(user.AccessToken).toBe("access_1");
    expect(user.RefreshToken).toBe("refresh_1");
    expect(user.Expiry.Equal(ParseDateTime(tokenExpiry))).toBe(true);
  });

  it("FetchAuthUser accepts missing optional fields", async () => {
    const provider = new GitlabMock(
      JSON.stringify({
        id: 456,
      }),
    );

    const user = await provider.FetchAuthUser({
      accessToken: "access_2",
    });

    expect(user.Id).toBe("456");
    expect(user.Name).toBe("");
    expect(user.Username).toBe("");
    expect(user.Email).toBe("");
    expect(user.AvatarURL).toBe("");
  });

  it("FetchAuthUser keeps email empty when it is not confirmed", async () => {
    const provider = new GitlabMock(
      JSON.stringify({
        id: 456,
        email: "gitlab@example.com",
        confirmed_at: "",
      }),
    );

    const user = await provider.FetchAuthUser({
      accessToken: "access_2b",
    });

    expect(user.Email).toBe("");
  });

  it("FetchAuthUser rejects malformed user payload", async () => {
    const provider = new GitlabMock("{");

    try {
      await provider.FetchAuthUser({ accessToken: "access_3" });
      throw new Error("Expected FetchAuthUser to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }
  });

  it("FetchAuthUser rejects invalid id field types", async () => {
    const provider = new GitlabMock(
      JSON.stringify({
        id: "456",
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
