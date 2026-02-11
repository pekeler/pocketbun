// PocketBun-only: provider-specific Twitch OAuth2 user mapping and request parity tests.

import { describe, expect, it } from "bun:test";
import { ParseDateTime } from "../types/index.ts";
import { Twitch } from "./twitch.ts";

type TwitchServerConfig = {
  users: () => Response | Promise<Response>;
};

function startTwitchServer(config: TwitchServerConfig): {
  server: ReturnType<typeof Bun.serve>;
  baseUrl: string;
  calls: {
    users: number;
    methods: string[];
    authHeaders: string[];
    clientIds: string[];
  };
} {
  const calls = {
    users: 0,
    methods: [] as string[],
    authHeaders: [] as string[],
    clientIds: [] as string[],
  };

  const server = Bun.serve({
    port: 0,
    async fetch(req) {
      const url = new URL(req.url);
      if (url.pathname !== "/helix/users") {
        return new Response("not found", { status: 404 });
      }

      calls.users += 1;
      calls.methods.push(req.method);
      calls.authHeaders.push(req.headers.get("Authorization") ?? "");
      calls.clientIds.push(req.headers.get("Client-Id") ?? "");
      return await config.users();
    },
  });

  return {
    server,
    baseUrl: `http://127.0.0.1:${server.port}`,
    calls,
  };
}

describe("twitch provider", () => {
  it("FetchRawUserInfo sends required Twitch headers", async () => {
    const { server, baseUrl, calls } = startTwitchServer({
      users: () => Response.json({ ok: true }),
    });

    try {
      const provider = new Twitch();
      provider.SetUserInfoURL(`${baseUrl}/helix/users`);
      provider.SetClientId("twitch_client_1");

      const raw = await provider.FetchRawUserInfo({ accessToken: "access_raw_1" });
      expect(new TextDecoder().decode(raw)).toContain('"ok":true');
      expect(calls.users).toBe(1);
      expect(calls.methods[0]).toBe("GET");
      expect(calls.authHeaders[0]).toBe("Bearer access_raw_1");
      expect(calls.clientIds[0]).toBe("twitch_client_1");
    } finally {
      await server.stop();
    }
  });

  it("FetchRawUserInfo returns error for non-2xx responses", async () => {
    const { server, baseUrl } = startTwitchServer({
      users: () => new Response("denied", { status: 401 }),
    });

    try {
      const provider = new Twitch();
      provider.SetUserInfoURL(`${baseUrl}/helix/users`);
      provider.SetClientId("twitch_client_2");
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

  it("FetchAuthUser maps profile fields", async () => {
    const { server, baseUrl } = startTwitchServer({
      users: () =>
        Response.json({
          data: [
            {
              id: "twitch_user_1",
              login: "twitch_login",
              display_name: "Twitch User",
              email: "twitch@example.com",
              profile_image_url: "https://example.com/twitch.png",
            },
          ],
        }),
    });

    try {
      const provider = new Twitch();
      provider.SetUserInfoURL(`${baseUrl}/helix/users`);
      provider.SetClientId("twitch_client_3");

      const tokenExpiry = new Date("2026-02-18T21:11:12.000Z");
      const user = await provider.FetchAuthUser({
        accessToken: "access_1",
        refreshToken: "refresh_1",
        expiry: tokenExpiry,
      });

      expect(user.Id).toBe("twitch_user_1");
      expect(user.Name).toBe("Twitch User");
      expect(user.Username).toBe("twitch_login");
      expect(user.Email).toBe("twitch@example.com");
      expect(user.AvatarURL).toBe("https://example.com/twitch.png");
      expect(user.AccessToken).toBe("access_1");
      expect(user.RefreshToken).toBe("refresh_1");
      expect(user.Expiry.Equal(ParseDateTime(tokenExpiry))).toBe(true);
    } finally {
      await server.stop();
    }
  });

  it("FetchAuthUser returns error for empty user list", async () => {
    const { server, baseUrl } = startTwitchServer({
      users: () => Response.json({ data: [] }),
    });

    try {
      const provider = new Twitch();
      provider.SetUserInfoURL(`${baseUrl}/helix/users`);
      provider.SetClientId("twitch_client_4");
      try {
        await provider.FetchAuthUser({ accessToken: "access_2" });
        throw new Error("Expected FetchAuthUser to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe("failed to fetch AuthUser data");
      }
    } finally {
      await server.stop();
    }
  });
});
