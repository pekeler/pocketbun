// PocketBun-only: provider-specific Github OAuth2 user mapping parity tests.

import { describe, expect, it } from "bun:test";
import { ParseDateTime } from "../types/index.ts";
import { Github } from "./github.ts";

type GithubServerConfig = {
  user: () => Response;
  emails: () => Response;
};

function startGithubServer(config: GithubServerConfig): {
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

describe("github provider", () => {
  it("FetchAuthUser maps profile fields and keeps API email when available", async () => {
    const { server, baseUrl, calls } = startGithubServer({
      user: () =>
        Response.json({
          login: "octocat",
          name: "The Octocat",
          email: "octocat@example.com",
          avatar_url: "https://example.com/avatar.png",
          id: 123,
        }),
      emails: () =>
        Response.json([
          {
            email: "ignored@example.com",
            verified: true,
            primary: true,
          },
        ]),
    });

    try {
      const provider = new Github();
      provider.SetUserInfoURL(`${baseUrl}/user`);

      const tokenExpiry = new Date("2026-02-12T15:16:17.000Z");
      const user = await provider.FetchAuthUser({
        accessToken: "access_1",
        refreshToken: "refresh_1",
        expiry: tokenExpiry,
      });

      expect(user.Id).toBe("123");
      expect(user.Name).toBe("The Octocat");
      expect(user.Username).toBe("octocat");
      expect(user.Email).toBe("octocat@example.com");
      expect(user.AvatarURL).toBe("https://example.com/avatar.png");
      expect(user.AccessToken).toBe("access_1");
      expect(user.RefreshToken).toBe("refresh_1");
      expect(user.Expiry.Equal(ParseDateTime(tokenExpiry))).toBe(true);

      expect(calls.user).toBe(1);
      expect(calls.emails).toBe(0);
      expect(calls.authHeaders[0]).toBe("Bearer access_1");
    } finally {
      await server.stop();
    }
  });

  it("FetchAuthUser loads verified primary email when API user email is private", async () => {
    const { server, baseUrl, calls } = startGithubServer({
      user: () =>
        Response.json({
          login: "octocat",
          name: "The Octocat",
          email: "",
          avatar_url: "https://example.com/avatar.png",
          id: 123,
        }),
      emails: () =>
        Response.json([
          { email: "not_primary@example.com", verified: true, primary: false },
          { email: "not_verified@example.com", verified: false, primary: true },
          { email: "primary@example.com", verified: true, primary: true },
        ]),
    });

    try {
      const provider = new Github();
      provider.SetUserInfoURL(`${baseUrl}/user`);

      const user = await provider.FetchAuthUser({
        accessToken: "access_2",
      });

      expect(user.Email).toBe("primary@example.com");
      expect(calls.user).toBe(1);
      expect(calls.emails).toBe(1);
      expect(calls.authHeaders).toEqual(["Bearer access_2", "Bearer access_2"]);
    } finally {
      await server.stop();
    }
  });

  it("FetchAuthUser ignores insufficient-scope email endpoint errors", async () => {
    for (const status of [401, 403, 404]) {
      const { server, baseUrl, calls } = startGithubServer({
        user: () =>
          Response.json({
            login: "octocat",
            email: "",
            id: 123,
          }),
        emails: () => new Response("no scope", { status }),
      });

      try {
        const provider = new Github();
        provider.SetUserInfoURL(`${baseUrl}/user`);

        const user = await provider.FetchAuthUser({
          accessToken: "access_3",
        });

        expect(user.Email).toBe("");
        expect(calls.user).toBe(1);
        expect(calls.emails).toBe(1);
      } finally {
        await server.stop();
      }
    }
  });

  it("FetchAuthUser returns error on invalid email payload response", async () => {
    const { server, baseUrl } = startGithubServer({
      user: () =>
        Response.json({
          login: "octocat",
          email: "",
          id: 123,
        }),
      emails: () => Response.json({ unexpected: true }),
    });

    try {
      const provider = new Github();
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
    const { server, baseUrl } = startGithubServer({
      user: () =>
        Response.json({
          login: "octocat",
          id: "123",
        }),
      emails: () => Response.json([]),
    });

    try {
      const provider = new Github();
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
