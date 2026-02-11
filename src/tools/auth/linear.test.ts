// PocketBun-only: provider-specific Linear OAuth2 user mapping and GraphQL request parity tests.

import { describe, expect, it } from "bun:test";
import { ParseDateTime } from "../types/index.ts";
import { Linear } from "./linear.ts";

type LinearServerConfig = {
  graphql: () => Response | Promise<Response>;
};

function startLinearServer(config: LinearServerConfig): {
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
      if (url.pathname !== "/graphql") {
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

describe("linear provider", () => {
  it("FetchRawUserInfo sends GraphQL POST request", async () => {
    const { server, baseUrl, calls } = startLinearServer({
      graphql: () =>
        Response.json({
          data: {
            viewer: {
              id: "lin_raw_1",
              active: true,
            },
          },
        }),
    });

    try {
      const provider = new Linear();
      provider.SetUserInfoURL(`${baseUrl}/graphql`);

      const raw = await provider.FetchRawUserInfo({
        accessToken: "access_raw_1",
      });

      const payload = JSON.parse(new TextDecoder().decode(raw)) as Record<string, unknown>;
      expect(calls.graphql).toBe(1);
      expect(calls.methods[0]).toBe("POST");
      expect(calls.authHeaders[0]).toBe("Bearer access_raw_1");
      expect(calls.contentTypes[0]).toStartWith("application/json");
      expect(calls.bodies[0]).toBe('{"query": "query Me { viewer { id displayName name email avatarUrl active } }"}');
      expect(((payload.data as Record<string, unknown>).viewer as Record<string, unknown>).id).toBe("lin_raw_1");
    } finally {
      await server.stop();
    }
  });

  it("FetchRawUserInfo returns an error for non-2xx responses", async () => {
    const { server, baseUrl } = startLinearServer({
      graphql: () => new Response("denied", { status: 401 }),
    });

    try {
      const provider = new Linear();
      provider.SetUserInfoURL(`${baseUrl}/graphql`);

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

  it("FetchAuthUser maps profile fields for active users", async () => {
    const { server, baseUrl } = startLinearServer({
      graphql: () =>
        Response.json({
          data: {
            viewer: {
              id: "lin_user_1",
              displayName: "linear-display",
              name: "Linear User",
              email: "linear@example.com",
              avatarUrl: "https://example.com/linear.png",
              active: true,
            },
          },
        }),
    });

    try {
      const provider = new Linear();
      provider.SetUserInfoURL(`${baseUrl}/graphql`);

      const tokenExpiry = new Date("2026-02-14T10:11:12.000Z");
      const user = await provider.FetchAuthUser({
        accessToken: "access_1",
        refreshToken: "refresh_1",
        expiry: tokenExpiry,
      });

      expect(user.Id).toBe("lin_user_1");
      expect(user.Username).toBe("linear-display");
      expect(user.Name).toBe("Linear User");
      expect(user.Email).toBe("linear@example.com");
      expect(user.AvatarURL).toBe("https://example.com/linear.png");
      expect(user.AccessToken).toBe("access_1");
      expect(user.RefreshToken).toBe("refresh_1");
      expect(user.Expiry.Equal(ParseDateTime(tokenExpiry))).toBe(true);
    } finally {
      await server.stop();
    }
  });

  it("FetchAuthUser rejects inactive accounts", async () => {
    const { server, baseUrl } = startLinearServer({
      graphql: () =>
        Response.json({
          data: {
            viewer: {
              id: "lin_user_2",
              active: false,
            },
          },
        }),
    });

    try {
      const provider = new Linear();
      provider.SetUserInfoURL(`${baseUrl}/graphql`);

      try {
        await provider.FetchAuthUser({ accessToken: "access_2" });
        throw new Error("Expected FetchAuthUser to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe("the Linear user account is not active");
      }
    } finally {
      await server.stop();
    }
  });

  it("FetchAuthUser rejects malformed user payload", async () => {
    const { server, baseUrl } = startLinearServer({
      graphql: () =>
        new Response("{", {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        }),
    });

    try {
      const provider = new Linear();
      provider.SetUserInfoURL(`${baseUrl}/graphql`);

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

  it("FetchAuthUser rejects invalid user payload field types", async () => {
    const { server, baseUrl } = startLinearServer({
      graphql: () =>
        Response.json({
          data: {
            viewer: {
              id: 123,
              active: true,
            },
          },
        }),
    });

    try {
      const provider = new Linear();
      provider.SetUserInfoURL(`${baseUrl}/graphql`);

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
