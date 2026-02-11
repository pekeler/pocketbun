// PocketBun-only: provider-specific Notion OAuth2 user mapping and request parity tests.

import { describe, expect, it } from "bun:test";
import { ParseDateTime } from "../types/index.ts";
import { Notion } from "./notion.ts";

type NotionServerConfig = {
  user: () => Response | Promise<Response>;
};

function startNotionServer(config: NotionServerConfig): {
  server: ReturnType<typeof Bun.serve>;
  baseUrl: string;
  calls: {
    user: number;
    methods: string[];
    authHeaders: string[];
    notionVersions: string[];
  };
} {
  const calls = {
    user: 0,
    methods: [] as string[],
    authHeaders: [] as string[],
    notionVersions: [] as string[],
  };

  const server = Bun.serve({
    port: 0,
    async fetch(req) {
      const url = new URL(req.url);
      if (url.pathname !== "/users/me") {
        return new Response("not found", { status: 404 });
      }

      calls.user += 1;
      calls.methods.push(req.method);
      calls.authHeaders.push(req.headers.get("Authorization") ?? "");
      calls.notionVersions.push(req.headers.get("Notion-Version") ?? "");
      return await config.user();
    },
  });

  return {
    server,
    baseUrl: `http://127.0.0.1:${server.port}`,
    calls,
  };
}

describe("notion provider", () => {
  it("FetchRawUserInfo sends Notion version and bearer headers", async () => {
    const { server, baseUrl, calls } = startNotionServer({
      user: () => Response.json({ ok: true }),
    });

    try {
      const provider = new Notion();
      provider.SetUserInfoURL(`${baseUrl}/users/me`);

      const raw = await provider.FetchRawUserInfo({
        accessToken: "access_raw_1",
      });
      expect(new TextDecoder().decode(raw)).toContain('"ok":true');
      expect(calls.user).toBe(1);
      expect(calls.methods[0]).toBe("GET");
      expect(calls.authHeaders[0]).toBe("Bearer access_raw_1");
      expect(calls.notionVersions[0]).toBe("2022-06-28");
    } finally {
      await server.stop();
    }
  });

  it("FetchRawUserInfo returns error for non-2xx responses", async () => {
    const { server, baseUrl } = startNotionServer({
      user: () => new Response("denied", { status: 401 }),
    });

    try {
      const provider = new Notion();
      provider.SetUserInfoURL(`${baseUrl}/users/me`);

      try {
        await provider.FetchRawUserInfo({ accessToken: "access_raw_2" });
        throw new Error("Expected FetchRawUserInfo to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    } finally {
      await server.stop();
    }
  });

  it("FetchAuthUser maps bot owner user fields", async () => {
    const { server, baseUrl } = startNotionServer({
      user: () =>
        Response.json({
          bot: {
            owner: {
              user: {
                id: "notion_user_1",
                name: "Notion User",
                avatar_url: "https://example.com/notion.png",
                person: {
                  email: "notion@example.com",
                },
              },
            },
          },
        }),
    });

    try {
      const provider = new Notion();
      provider.SetUserInfoURL(`${baseUrl}/users/me`);

      const tokenExpiry = new Date("2026-02-18T10:11:12.000Z");
      const user = await provider.FetchAuthUser({
        accessToken: "access_1",
        refreshToken: "refresh_1",
        expiry: tokenExpiry,
      });

      expect(user.Id).toBe("notion_user_1");
      expect(user.Name).toBe("Notion User");
      expect(user.Email).toBe("notion@example.com");
      expect(user.AvatarURL).toBe("https://example.com/notion.png");
      expect(user.AccessToken).toBe("access_1");
      expect(user.RefreshToken).toBe("refresh_1");
      expect(user.Expiry.Equal(ParseDateTime(tokenExpiry))).toBe(true);
    } finally {
      await server.stop();
    }
  });

  it("FetchAuthUser rejects invalid nested field types", async () => {
    const { server, baseUrl } = startNotionServer({
      user: () =>
        Response.json({
          bot: {
            owner: {
              user: {
                id: 123,
              },
            },
          },
        }),
    });

    try {
      const provider = new Notion();
      provider.SetUserInfoURL(`${baseUrl}/users/me`);

      try {
        await provider.FetchAuthUser({ accessToken: "access_2" });
        throw new Error("Expected FetchAuthUser to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    } finally {
      await server.stop();
    }
  });
});
