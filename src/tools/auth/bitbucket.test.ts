// PocketBun-only: provider-specific Bitbucket OAuth2 user mapping parity tests.

import { describe, expect, it } from "bun:test";
import { ParseDateTime } from "../types/index.ts";
import { Bitbucket } from "./bitbucket.ts";

type BitbucketServerConfig = {
  user: () => Response;
  emails: () => Response;
};

function startBitbucketServer(config: BitbucketServerConfig): {
  server: ReturnType<typeof Bun.serve>;
  baseUrl: string;
  calls: { user: number; emails: number; authHeaders: string[] };
} {
  const calls = {
    user: 0,
    emails: 0,
    authHeaders: [] as string[],
  };

  const server = Bun.serve({
    port: 0,
    fetch(req) {
      const url = new URL(req.url);
      const authHeader = req.headers.get("Authorization") ?? "";

      if (url.pathname === "/user") {
        calls.user += 1;
        calls.authHeaders.push(authHeader);
        return config.user();
      }

      if (url.pathname === "/user/emails") {
        calls.emails += 1;
        calls.authHeaders.push(authHeader);
        return config.emails();
      }

      return new Response("not found", { status: 404 });
    },
  });

  return {
    server,
    baseUrl: `http://127.0.0.1:${server.port}`,
    calls,
  };
}

describe("bitbucket provider", () => {
  it("FetchAuthUser maps profile fields and primary email", async () => {
    const { server, baseUrl, calls } = startBitbucketServer({
      user: () =>
        Response.json({
          uuid: "bb_user_1",
          username: "bitbucket-user",
          display_name: "Bitbucket User",
          account_status: "active",
          links: {
            avatar: {
              href: "https://example.com/avatar.png",
            },
          },
        }),
      emails: () =>
        Response.json({
          values: [
            {
              email: "secondary@example.com",
              is_primary: false,
            },
            {
              email: "primary@example.com",
              is_primary: true,
            },
          ],
        }),
    });

    try {
      const provider = new Bitbucket();
      provider.SetUserInfoURL(`${baseUrl}/user`);

      const tokenExpiry = new Date("2026-02-12T15:16:17.000Z");
      const user = await provider.FetchAuthUser({
        accessToken: "access_1",
        refreshToken: "refresh_1",
        expiry: tokenExpiry,
      });

      expect(user.Id).toBe("bb_user_1");
      expect(user.Username).toBe("bitbucket-user");
      expect(user.Name).toBe("Bitbucket User");
      expect(user.Email).toBe("primary@example.com");
      expect(user.AvatarURL).toBe("https://example.com/avatar.png");
      expect(user.AccessToken).toBe("access_1");
      expect(user.RefreshToken).toBe("refresh_1");
      expect(user.Expiry.Equal(ParseDateTime(tokenExpiry))).toBe(true);

      expect(calls.user).toBe(1);
      expect(calls.emails).toBe(1);
      expect(calls.authHeaders).toEqual(["Bearer access_1", "Bearer access_1"]);
    } finally {
      await server.stop();
    }
  });

  it("FetchAuthUser returns empty email when email endpoint fails", async () => {
    const { server, baseUrl, calls } = startBitbucketServer({
      user: () =>
        Response.json({
          uuid: "bb_user_2",
          display_name: "Bitbucket User 2",
          account_status: "active",
        }),
      emails: () => new Response("no scope", { status: 403 }),
    });

    try {
      const provider = new Bitbucket();
      provider.SetUserInfoURL(`${baseUrl}/user`);

      const user = await provider.FetchAuthUser({
        accessToken: "access_2",
      });

      expect(user.Email).toBe("");
      expect(calls.user).toBe(1);
      expect(calls.emails).toBe(1);
    } finally {
      await server.stop();
    }
  });

  it("FetchAuthUser rejects inactive accounts", async () => {
    const { server, baseUrl } = startBitbucketServer({
      user: () =>
        Response.json({
          uuid: "bb_user_3",
          account_status: "suspended",
        }),
      emails: () => Response.json({ values: [] }),
    });

    try {
      const provider = new Bitbucket();
      provider.SetUserInfoURL(`${baseUrl}/user`);

      try {
        await provider.FetchAuthUser({ accessToken: "access_3" });
        throw new Error("Expected FetchAuthUser to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    } finally {
      await server.stop();
    }
  });

  it("FetchAuthUser returns error on invalid emails payload", async () => {
    const { server, baseUrl } = startBitbucketServer({
      user: () =>
        Response.json({
          uuid: "bb_user_4",
          account_status: "active",
        }),
      emails: () => Response.json({ values: {} }),
    });

    try {
      const provider = new Bitbucket();
      provider.SetUserInfoURL(`${baseUrl}/user`);

      try {
        await provider.FetchAuthUser({ accessToken: "access_4" });
        throw new Error("Expected FetchAuthUser to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    } finally {
      await server.stop();
    }
  });

  it("FetchAuthUser returns error on invalid user payload field types", async () => {
    const { server, baseUrl } = startBitbucketServer({
      user: () =>
        Response.json({
          uuid: 123,
          account_status: "active",
        }),
      emails: () => Response.json({ values: [] }),
    });

    try {
      const provider = new Bitbucket();
      provider.SetUserInfoURL(`${baseUrl}/user`);

      try {
        await provider.FetchAuthUser({ accessToken: "access_5" });
        throw new Error("Expected FetchAuthUser to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    } finally {
      await server.stop();
    }
  });
});
