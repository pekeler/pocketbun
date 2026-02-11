// PocketBun-only: provider-specific Trakt OAuth2 user mapping and request parity tests.

import { describe, expect, it } from "bun:test";
import { ParseDateTime } from "../types/index.ts";
import { Trakt } from "./trakt.ts";

type TraktServerConfig = {
  settings: () => Response | Promise<Response>;
};

function startTraktServer(config: TraktServerConfig): {
  server: ReturnType<typeof Bun.serve>;
  baseUrl: string;
  calls: {
    settings: number;
    methods: string[];
    authHeaders: string[];
    contentTypes: string[];
    apiKeys: string[];
    apiVersions: string[];
  };
} {
  const calls = {
    settings: 0,
    methods: [] as string[],
    authHeaders: [] as string[],
    contentTypes: [] as string[],
    apiKeys: [] as string[],
    apiVersions: [] as string[],
  };

  const server = Bun.serve({
    port: 0,
    async fetch(req) {
      const url = new URL(req.url);
      if (url.pathname !== "/users/settings") {
        return new Response("not found", { status: 404 });
      }

      calls.settings += 1;
      calls.methods.push(req.method);
      calls.authHeaders.push(req.headers.get("Authorization") ?? "");
      calls.contentTypes.push(req.headers.get("Content-type") ?? "");
      calls.apiKeys.push(req.headers.get("trakt-api-key") ?? "");
      calls.apiVersions.push(req.headers.get("trakt-api-version") ?? "");
      return await config.settings();
    },
  });

  return {
    server,
    baseUrl: `http://127.0.0.1:${server.port}`,
    calls,
  };
}

describe("trakt provider", () => {
  it("FetchRawUserInfo sends required trakt headers", async () => {
    const { server, baseUrl, calls } = startTraktServer({
      settings: () => Response.json({ ok: true }),
    });

    try {
      const provider = new Trakt();
      provider.SetUserInfoURL(`${baseUrl}/users/settings`);
      provider.SetClientId("trakt_client_1");

      const raw = await provider.FetchRawUserInfo({ accessToken: "access_raw_1" });
      expect(new TextDecoder().decode(raw)).toContain('"ok":true');
      expect(calls.settings).toBe(1);
      expect(calls.methods[0]).toBe("GET");
      expect(calls.authHeaders[0]).toBe("Bearer access_raw_1");
      expect(calls.contentTypes[0]).toBe("application/json");
      expect(calls.apiKeys[0]).toBe("trakt_client_1");
      expect(calls.apiVersions[0]).toBe("2");
    } finally {
      await server.stop();
    }
  });

  it("FetchRawUserInfo returns error for non-2xx responses", async () => {
    const { server, baseUrl } = startTraktServer({
      settings: () => new Response("denied", { status: 401 }),
    });

    try {
      const provider = new Trakt();
      provider.SetUserInfoURL(`${baseUrl}/users/settings`);
      provider.SetClientId("trakt_client_2");

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
    const { server, baseUrl } = startTraktServer({
      settings: () =>
        Response.json({
          user: {
            username: "trakt_login",
            name: "Trakt User",
            ids: {
              slug: "trakt-slug",
              uuid: "trakt-uuid-1",
            },
            images: {
              avatar: {
                full: "https://example.com/trakt.png",
              },
            },
          },
        }),
    });

    try {
      const provider = new Trakt();
      provider.SetUserInfoURL(`${baseUrl}/users/settings`);
      provider.SetClientId("trakt_client_3");

      const tokenExpiry = new Date("2026-02-18T19:11:12.000Z");
      const user = await provider.FetchAuthUser({
        accessToken: "access_1",
        refreshToken: "refresh_1",
        expiry: tokenExpiry,
      });

      expect(user.Id).toBe("trakt-uuid-1");
      expect(user.Name).toBe("Trakt User");
      expect(user.Username).toBe("trakt_login");
      expect(user.AvatarURL).toBe("https://example.com/trakt.png");
      expect(user.AccessToken).toBe("access_1");
      expect(user.RefreshToken).toBe("refresh_1");
      expect(user.Expiry.Equal(ParseDateTime(tokenExpiry))).toBe(true);
    } finally {
      await server.stop();
    }
  });

  it("FetchAuthUser rejects malformed or invalid payloads", async () => {
    const malformed = startTraktServer({
      settings: () => new Response("{", { status: 200 }),
    });
    try {
      const provider = new Trakt();
      provider.SetUserInfoURL(`${malformed.baseUrl}/users/settings`);
      provider.SetClientId("trakt_client_4");
      try {
        await provider.FetchAuthUser({ accessToken: "access_2" });
        throw new Error("Expected malformed payload to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    } finally {
      await malformed.server.stop();
    }

    const invalid = startTraktServer({
      settings: () =>
        Response.json({
          user: {
            ids: {
              uuid: 123,
            },
          },
        }),
    });
    try {
      const provider = new Trakt();
      provider.SetUserInfoURL(`${invalid.baseUrl}/users/settings`);
      provider.SetClientId("trakt_client_5");
      try {
        await provider.FetchAuthUser({ accessToken: "access_3" });
        throw new Error("Expected invalid payload to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    } finally {
      await invalid.server.stop();
    }
  });
});
