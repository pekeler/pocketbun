// PocketBun-only: provider-specific monday.com OAuth2 user mapping and GraphQL request parity tests.

import { describe, expect, it } from "bun:test";
import { ParseDateTime } from "../types/index.ts";
import { Monday } from "./monday.ts";

type MondayServerConfig = {
  graphql: () => Response | Promise<Response>;
};

function startMondayServer(config: MondayServerConfig): {
  server: ReturnType<typeof Bun.serve>;
  baseUrl: string;
  calls: {
    graphql: number;
    methods: string[];
    authHeaders: string[];
    contentTypes: string[];
    bodies: string[];
  };
} {
  const calls = {
    graphql: 0,
    methods: [] as string[],
    authHeaders: [] as string[],
    contentTypes: [] as string[],
    bodies: [] as string[],
  };

  const server = Bun.serve({
    port: 0,
    async fetch(req) {
      const url = new URL(req.url);
      if (url.pathname !== "/v2") {
        return new Response("not found", { status: 404 });
      }

      calls.graphql += 1;
      calls.methods.push(req.method);
      calls.authHeaders.push(req.headers.get("Authorization") ?? "");
      calls.contentTypes.push(req.headers.get("Content-Type") ?? "");
      calls.bodies.push(await req.text());
      return await config.graphql();
    },
  });

  return {
    server,
    baseUrl: `http://127.0.0.1:${server.port}`,
    calls,
  };
}

describe("monday provider", () => {
  it("FetchRawUserInfo sends GraphQL POST request", async () => {
    const { server, baseUrl, calls } = startMondayServer({
      graphql: () =>
        Response.json({
          data: {
            me: {
              id: "mon_raw_1",
              enabled: true,
            },
          },
        }),
    });

    try {
      const provider = new Monday();
      provider.SetUserInfoURL(`${baseUrl}/v2`);

      const raw = await provider.FetchRawUserInfo({ accessToken: "access_raw_1" });
      const payload = JSON.parse(new TextDecoder().decode(raw)) as Record<string, unknown>;

      expect(calls.graphql).toBe(1);
      expect(calls.methods[0]).toBe("POST");
      expect(calls.authHeaders[0]).toBe("Bearer access_raw_1");
      expect(calls.contentTypes[0]).toStartWith("application/json");
      expect(calls.bodies[0]).toBe('{"query": "query { me { id enabled name email is_verified photo_small }}"}');
      expect((((payload.data as Record<string, unknown>).me as Record<string, unknown>).id as string) || "").toBe("mon_raw_1");
    } finally {
      await server.stop();
    }
  });

  it("FetchRawUserInfo returns error for non-2xx responses", async () => {
    const { server, baseUrl } = startMondayServer({
      graphql: () => new Response("forbidden", { status: 403 }),
    });

    try {
      const provider = new Monday();
      provider.SetUserInfoURL(`${baseUrl}/v2`);

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

  it("FetchAuthUser maps profile fields and verified email", async () => {
    const { server, baseUrl } = startMondayServer({
      graphql: () =>
        Response.json({
          data: {
            me: {
              id: "mon_user_1",
              enabled: true,
              name: "Monday User",
              email: "monday@example.com",
              is_verified: true,
              photo_small: "https://example.com/monday.png",
            },
          },
        }),
    });

    try {
      const provider = new Monday();
      provider.SetUserInfoURL(`${baseUrl}/v2`);

      const tokenExpiry = new Date("2026-02-18T12:11:12.000Z");
      const user = await provider.FetchAuthUser({
        accessToken: "access_1",
        refreshToken: "refresh_1",
        expiry: tokenExpiry,
      });

      expect(user.Id).toBe("mon_user_1");
      expect(user.Name).toBe("Monday User");
      expect(user.Email).toBe("monday@example.com");
      expect(user.AvatarURL).toBe("https://example.com/monday.png");
      expect(user.AccessToken).toBe("access_1");
      expect(user.RefreshToken).toBe("refresh_1");
      expect(user.Expiry.Equal(ParseDateTime(tokenExpiry))).toBe(true);
    } finally {
      await server.stop();
    }
  });

  it("FetchAuthUser handles unverified and disabled users", async () => {
    const unverified = startMondayServer({
      graphql: () =>
        Response.json({
          data: {
            me: {
              id: "mon_user_2",
              enabled: true,
              email: "private@example.com",
              is_verified: false,
            },
          },
        }),
    });

    try {
      const provider = new Monday();
      provider.SetUserInfoURL(`${unverified.baseUrl}/v2`);
      const user = await provider.FetchAuthUser({ accessToken: "access_2" });
      expect(user.Email).toBe("");
    } finally {
      await unverified.server.stop();
    }

    const disabled = startMondayServer({
      graphql: () =>
        Response.json({
          data: {
            me: {
              id: "mon_user_3",
              enabled: false,
            },
          },
        }),
    });

    try {
      const provider = new Monday();
      provider.SetUserInfoURL(`${disabled.baseUrl}/v2`);
      try {
        await provider.FetchAuthUser({ accessToken: "access_3" });
        throw new Error("Expected FetchAuthUser to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe("the monday.com user account is not enabled");
      }
    } finally {
      await disabled.server.stop();
    }
  });

  it("FetchAuthUser rejects malformed or invalid payloads", async () => {
    const malformed = startMondayServer({
      graphql: () => new Response("{", { status: 200 }),
    });
    try {
      const provider = new Monday();
      provider.SetUserInfoURL(`${malformed.baseUrl}/v2`);
      try {
        await provider.FetchAuthUser({ accessToken: "access_4" });
        throw new Error("Expected malformed payload to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    } finally {
      await malformed.server.stop();
    }

    const invalidType = startMondayServer({
      graphql: () =>
        Response.json({
          data: {
            me: {
              id: 123,
              enabled: true,
            },
          },
        }),
    });
    try {
      const provider = new Monday();
      provider.SetUserInfoURL(`${invalidType.baseUrl}/v2`);
      try {
        await provider.FetchAuthUser({ accessToken: "access_5" });
        throw new Error("Expected invalid payload type to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    } finally {
      await invalidType.server.stop();
    }
  });
});
