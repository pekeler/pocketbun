// PocketBun-only: provider-specific Gitea/Forgejo OAuth2 user mapping parity tests.

import { describe, expect, it } from "bun:test";
import { startBunServerWithRetry } from "../../tests/helpers.ts";
import { ParseDateTime } from "../types/index.ts";
import { Gitea } from "./gitea.ts";

type GiteaServerConfig = {
  user: () => Response;
  emails: () => Response;
};

function startGiteaServer(config: GiteaServerConfig): {
  server: ReturnType<typeof Bun.serve>;
  baseUrl: string;
  calls: { user: number; emails: number; authHeaders: string[] };
} {
  const calls = {
    user: 0,
    emails: 0,
    authHeaders: [] as string[],
  };

  const server = startBunServerWithRetry({
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

describe("gitea provider", () => {
  it("FetchAuthUser maps profile fields and verified primary email", async () => {
    const { server, baseUrl, calls } = startGiteaServer({
      user: () =>
        Response.json({
          id: 123,
          full_name: "Gitea User",
          login: "gitea_login",
          active: true,
          avatar_url: "https://example.com/gitea.png",
        }),
      emails: () =>
        Response.json([
          { email: "secondary@example.com", verified: true, primary: false },
          { email: "unverified@example.com", verified: false, primary: true },
          { email: "gitea@example.com", verified: true, primary: true },
        ]),
    });

    try {
      const provider = new Gitea();
      provider.SetUserInfoURL(`${baseUrl}/user`);

      const tokenExpiry = new Date("2026-02-16T10:11:12.000Z");
      const user = await provider.FetchAuthUser({
        accessToken: "access_1",
        refreshToken: "refresh_1",
        expiry: tokenExpiry,
      });

      expect(user.Id).toBe("123");
      expect(user.Name).toBe("Gitea User");
      expect(user.Username).toBe("gitea_login");
      expect(user.Email).toBe("gitea@example.com");
      expect(user.AvatarURL).toBe("https://example.com/gitea.png");
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

  it("FetchAuthUser accepts missing optional fields and insufficient-scope email endpoint errors", async () => {
    const { server, baseUrl } = startGiteaServer({
      user: () =>
        Response.json({
          id: 999,
          active: true,
        }),
      emails: () => new Response("no scope", { status: 403 }),
    });

    try {
      const provider = new Gitea();
      provider.SetUserInfoURL(`${baseUrl}/user`);

      const user = await provider.FetchAuthUser({
        accessToken: "access_2",
      });

      expect(user.Id).toBe("999");
      expect(user.Name).toBe("");
      expect(user.Username).toBe("");
      expect(user.Email).toBe("");
      expect(user.AvatarURL).toBe("");
    } finally {
      await server.stop();
    }
  });

  it("FetchAuthUser rejects inactive accounts", async () => {
    const { server, baseUrl } = startGiteaServer({
      user: () =>
        Response.json({
          id: 123,
          active: false,
        }),
      emails: () => Response.json([]),
    });

    try {
      const provider = new Gitea();
      provider.SetUserInfoURL(`${baseUrl}/user`);

      try {
        await provider.FetchAuthUser({ accessToken: "access_2b" });
        throw new Error("Expected FetchAuthUser to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    } finally {
      await server.stop();
    }
  });

  it("FetchAuthUser rejects malformed user payload", async () => {
    const { server, baseUrl } = startGiteaServer({
      user: () => new Response("{"),
      emails: () => Response.json([]),
    });

    try {
      const provider = new Gitea();
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

  it("FetchAuthUser rejects invalid id field types", async () => {
    const { server, baseUrl } = startGiteaServer({
      user: () =>
        Response.json({
          id: "123",
          active: true,
        }),
      emails: () => Response.json([]),
    });

    try {
      const provider = new Gitea();
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
});
