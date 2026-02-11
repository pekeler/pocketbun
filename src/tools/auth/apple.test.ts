// PocketBun-only: provider-specific Apple OAuth2 user mapping and id_token parity tests.

import { describe, expect, it } from "bun:test";
import { generateKeyPairSync, sign, type KeyObject } from "node:crypto";
import { startBunServerWithRetry } from "../../tests/helpers.ts";
import { ParseDateTime } from "../types/index.ts";
import { Apple } from "./apple.ts";

function base64UrlEncode(input: Buffer): string {
  return input.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
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

function startJWKSserver(
  publicKey: KeyObject,
  kid: string,
): {
  server: ReturnType<typeof Bun.serve>;
  url: string;
} {
  const publicJwk = publicKey.export({ format: "jwk" }) as { n?: string; e?: string };

  const server = startBunServerWithRetry({
    fetch() {
      return Response.json({
        keys: [
          {
            kid,
            kty: "RSA",
            alg: "RS256",
            n: publicJwk.n,
            e: publicJwk.e,
          },
        ],
      });
    },
  });

  return {
    server,
    url: `http://127.0.0.1:${server.port}`,
  };
}

function setTestJwksURL(provider: Apple, url: string): void {
  // Private field override for deterministic local signature validation in tests.
  (provider as unknown as { jwksURL: string }).jwksURL = url;
}

describe("apple provider", () => {
  it("FetchAuthUser maps verified profile fields", async () => {
    const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 1024 });
    const { server, url } = startJWKSserver(publicKey, "key_1");

    try {
      const provider = new Apple();
      provider.SetClientId("client_1");
      setTestJwksURL(provider, url);

      const nowSeconds = Math.floor(Date.now() / 1000);
      const idToken = buildSignedToken(
        {
          sub: "apple_user_1",
          email: "verified@example.com",
          email_verified: true,
          name: "Apple User",
          iss: "https://appleid.apple.com",
          aud: "client_1",
          iat: nowSeconds,
          exp: nowSeconds + 300,
        },
        privateKey,
        "key_1",
      );

      const tokenExpiry = new Date("2026-02-12T15:16:17.000Z");
      const user = await provider.FetchAuthUser({
        id_token: idToken,
        accessToken: "access_1",
        refreshToken: "refresh_1",
        expiry: tokenExpiry,
      });

      expect(user.Id).toBe("apple_user_1");
      expect(user.Name).toBe("Apple User");
      expect(user.Email).toBe("verified@example.com");
      expect(user.AccessToken).toBe("access_1");
      expect(user.RefreshToken).toBe("refresh_1");
      expect(user.Expiry.Equal(ParseDateTime(tokenExpiry))).toBe(true);
      expect(user.RawUser.sub).toBe("apple_user_1");
    } finally {
      await server.stop();
    }
  });

  it("FetchAuthUser keeps email empty when not verified", async () => {
    const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 1024 });
    const { server, url } = startJWKSserver(publicKey, "key_1");

    try {
      const provider = new Apple();
      provider.SetClientId("client_1");
      setTestJwksURL(provider, url);

      const nowSeconds = Math.floor(Date.now() / 1000);
      const idToken = buildSignedToken(
        {
          sub: "apple_user_2",
          email: "private@example.com",
          email_verified: "false",
          iss: "https://appleid.apple.com",
          aud: "client_1",
          iat: nowSeconds,
          exp: nowSeconds + 300,
        },
        privateKey,
        "key_1",
      );

      const user = await provider.FetchAuthUser({
        id_token: idToken,
      });

      expect(user.Email).toBe("");
    } finally {
      await server.stop();
    }
  });

  it("FetchRawUserInfo rejects empty id_token", async () => {
    const provider = new Apple();
    provider.SetClientId("client_1");

    try {
      await provider.FetchRawUserInfo({});
      throw new Error("Expected FetchRawUserInfo to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }
  });

  it("FetchRawUserInfo rejects token without exp claim", async () => {
    const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 1024 });
    const { server, url } = startJWKSserver(publicKey, "key_1");

    try {
      const provider = new Apple();
      provider.SetClientId("client_1");
      setTestJwksURL(provider, url);

      const nowSeconds = Math.floor(Date.now() / 1000);
      const idToken = buildSignedToken(
        {
          sub: "apple_user_3",
          iss: "https://appleid.apple.com",
          aud: "client_1",
          iat: nowSeconds,
        },
        privateKey,
        "key_1",
      );

      try {
        await provider.FetchRawUserInfo({ id_token: idToken });
        throw new Error("Expected FetchRawUserInfo to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    } finally {
      await server.stop();
    }
  });

  it("FetchRawUserInfo rejects token with invalid issuer", async () => {
    const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 1024 });
    const { server, url } = startJWKSserver(publicKey, "key_1");

    try {
      const provider = new Apple();
      provider.SetClientId("client_1");
      setTestJwksURL(provider, url);

      const nowSeconds = Math.floor(Date.now() / 1000);
      const idToken = buildSignedToken(
        {
          sub: "apple_user_4",
          iss: "https://issuer.example",
          aud: "client_1",
          iat: nowSeconds,
          exp: nowSeconds + 300,
        },
        privateKey,
        "key_1",
      );

      try {
        await provider.FetchRawUserInfo({ id_token: idToken });
        throw new Error("Expected FetchRawUserInfo to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    } finally {
      await server.stop();
    }
  });

  it("FetchRawUserInfo rejects token with invalid signature", async () => {
    const { publicKey } = generateKeyPairSync("rsa", { modulusLength: 1024 });
    const { privateKey: otherPrivateKey } = generateKeyPairSync("rsa", { modulusLength: 1024 });
    const { server, url } = startJWKSserver(publicKey, "key_1");

    try {
      const provider = new Apple();
      provider.SetClientId("client_1");
      setTestJwksURL(provider, url);

      const nowSeconds = Math.floor(Date.now() / 1000);
      const idToken = buildSignedToken(
        {
          sub: "apple_user_5",
          iss: "https://appleid.apple.com",
          aud: "client_1",
          iat: nowSeconds,
          exp: nowSeconds + 300,
        },
        otherPrivateKey,
        "key_1",
      );

      try {
        await provider.FetchRawUserInfo({ id_token: idToken });
        throw new Error("Expected FetchRawUserInfo to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    } finally {
      await server.stop();
    }
  });
});
