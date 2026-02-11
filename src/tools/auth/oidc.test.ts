// PocketBun-only: provider-specific OIDC OAuth2 user mapping and id_token parity tests.

import { describe, expect, it } from "bun:test";
import { generateKeyPairSync, sign, type KeyObject } from "node:crypto";
import type { OAuth2Token } from "./auth.ts";
import { startBunServerWithRetry } from "../../tests/helpers.ts";
import { ParseDateTime } from "../types/index.ts";
import { OIDC } from "./oidc.ts";

class OIDCMock extends OIDC {
  #rawUserInfo: string;

  constructor(rawUserInfo: string) {
    super();
    this.#rawUserInfo = rawUserInfo;
  }

  override async FetchRawUserInfo(_token: OAuth2Token): Promise<Uint8Array> {
    return new TextEncoder().encode(this.#rawUserInfo);
  }
}

function base64UrlEncode(input: Buffer): string {
  return input.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function buildUnsignedToken(payload: Record<string, unknown>): string {
  const header = {
    alg: "none",
    typ: "JWT",
  };
  const encodedHeader = base64UrlEncode(Buffer.from(JSON.stringify(header), "utf8"));
  const encodedPayload = base64UrlEncode(Buffer.from(JSON.stringify(payload), "utf8"));
  return `${encodedHeader}.${encodedPayload}.signature`;
}

function buildSignedToken(payload: Record<string, unknown>, privateKey: KeyObject, kid: string): string {
  const header = {
    alg: "RS256",
    kid,
    typ: "JWT",
  };
  const encodedHeader = base64UrlEncode(Buffer.from(JSON.stringify(header), "utf8"));
  const encodedPayload = base64UrlEncode(Buffer.from(JSON.stringify(payload), "utf8"));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = sign("RSA-SHA256", Buffer.from(signingInput, "utf8"), privateKey);

  return `${signingInput}.${base64UrlEncode(signature)}`;
}

describe("oidc provider", () => {
  it("FetchAuthUser maps verified profile fields", async () => {
    const provider = new OIDCMock(
      JSON.stringify({
        sub: "user_1",
        name: "OIDC User",
        preferred_username: "oidc-user",
        picture: "https://example.com/avatar.png",
        email: "verified@example.com",
        email_verified: "true",
      }),
    );

    const tokenExpiry = new Date("2026-02-12T15:16:17.000Z");
    const user = await provider.FetchAuthUser({
      accessToken: "access_1",
      refreshToken: "refresh_1",
      expiry: tokenExpiry,
    });

    expect(user.Id).toBe("user_1");
    expect(user.Name).toBe("OIDC User");
    expect(user.Username).toBe("oidc-user");
    expect(user.AvatarURL).toBe("https://example.com/avatar.png");
    expect(user.Email).toBe("verified@example.com");
    expect(user.AccessToken).toBe("access_1");
    expect(user.RefreshToken).toBe("refresh_1");
    expect(user.Expiry.Equal(ParseDateTime(tokenExpiry))).toBe(true);
  });

  it("FetchAuthUser keeps email empty when email is not verified", async () => {
    const provider = new OIDCMock(
      JSON.stringify({
        sub: "user_1",
        email: "unverified@example.com",
        email_verified: false,
      }),
    );

    const user = await provider.FetchAuthUser({
      accessToken: "access_2",
    });

    expect(user.Email).toBe("");
  });

  it("FetchAuthUser rejects invalid payload field types", async () => {
    const provider = new OIDCMock(
      JSON.stringify({
        sub: 123,
      }),
    );

    try {
      await provider.FetchAuthUser({ accessToken: "access_3" });
      throw new Error("Expected FetchAuthUser to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }
  });

  it("FetchRawUserInfo returns id_token claims when UserInfoURL is empty", async () => {
    const provider = new OIDC();
    provider.SetClientId("client_1");

    const token = buildUnsignedToken({
      sub: "id_token_user",
      aud: "client_1",
      iat: Math.floor(Date.now() / 1000),
    });

    const data = await provider.FetchRawUserInfo({
      id_token: token,
    });
    const claims = JSON.parse(new TextDecoder().decode(data)) as Record<string, unknown>;

    expect(claims.sub).toBe("id_token_user");
    expect(claims.aud).toBe("client_1");
  });

  it("FetchRawUserInfo rejects id_token with mismatched audience", async () => {
    const provider = new OIDC();
    provider.SetClientId("client_1");

    const token = buildUnsignedToken({
      sub: "id_token_user",
      aud: "client_2",
      iat: Math.floor(Date.now() / 1000),
    });

    try {
      await provider.FetchRawUserInfo({ id_token: token });
      throw new Error("Expected FetchRawUserInfo to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }
  });

  it("FetchRawUserInfo validates configured issuers", async () => {
    const provider = new OIDC();
    provider.SetClientId("client_1");
    provider.SetExtra({
      issuers: ["https://issuer.example"],
    });

    const invalidIssuerToken = buildUnsignedToken({
      sub: "id_token_user",
      aud: "client_1",
      iss: "https://other.example",
      iat: Math.floor(Date.now() / 1000),
    });

    try {
      await provider.FetchRawUserInfo({ id_token: invalidIssuerToken });
      throw new Error("Expected FetchRawUserInfo to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }

    const validIssuerToken = buildUnsignedToken({
      sub: "id_token_user",
      aud: "client_1",
      iss: "https://issuer.example",
      iat: Math.floor(Date.now() / 1000),
    });

    const data = await provider.FetchRawUserInfo({ id_token: validIssuerToken });
    const claims = JSON.parse(new TextDecoder().decode(data)) as Record<string, unknown>;
    expect(claims.iss).toBe("https://issuer.example");
  });

  it("FetchRawUserInfo uses UserInfoURL endpoint when configured", async () => {
    const calls = {
      userInfo: 0,
      authHeaders: [] as string[],
    };

    const server = startBunServerWithRetry({
      fetch(req) {
        const url = new URL(req.url);
        if (url.pathname !== "/userinfo") {
          return new Response("not found", { status: 404 });
        }

        calls.userInfo += 1;
        calls.authHeaders.push(req.headers.get("Authorization") ?? "");

        return Response.json({
          sub: "api_user",
        });
      },
    });

    try {
      const provider = new OIDC();
      provider.SetUserInfoURL(`http://127.0.0.1:${server.port}/userinfo`);

      const data = await provider.FetchRawUserInfo({
        accessToken: "access_4",
      });

      const claims = JSON.parse(new TextDecoder().decode(data)) as Record<string, unknown>;
      expect(claims.sub).toBe("api_user");
      expect(calls.userInfo).toBe(1);
      expect(calls.authHeaders).toEqual(["Bearer access_4"]);
    } finally {
      await server.stop();
    }
  });

  it("FetchRawUserInfo validates id_token signatures when jwksURL is set", async () => {
    const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 1024 });
    const { privateKey: invalidPrivateKey } = generateKeyPairSync("rsa", { modulusLength: 1024 });
    const publicJwk = publicKey.export({ format: "jwk" }) as { n?: string; e?: string };

    const server = startBunServerWithRetry({
      fetch() {
        return Response.json({
          keys: [
            {
              kid: "key_1",
              kty: "RSA",
              alg: "RS256",
              n: publicJwk.n,
              e: publicJwk.e,
            },
          ],
        });
      },
    });

    try {
      const provider = new OIDC();
      provider.SetClientId("client_1");
      provider.SetExtra({
        jwksURL: `http://127.0.0.1:${server.port}`,
      });

      const payload = {
        sub: "id_token_user",
        aud: "client_1",
        iat: Math.floor(Date.now() / 1000),
      };

      const validToken = buildSignedToken(payload, privateKey, "key_1");
      const validData = await provider.FetchRawUserInfo({ id_token: validToken });
      const validClaims = JSON.parse(new TextDecoder().decode(validData)) as Record<string, unknown>;
      expect(validClaims.sub).toBe("id_token_user");

      const invalidToken = buildSignedToken(payload, invalidPrivateKey, "key_1");

      try {
        await provider.FetchRawUserInfo({ id_token: invalidToken });
        throw new Error("Expected FetchRawUserInfo to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    } finally {
      await server.stop();
    }
  });
});
