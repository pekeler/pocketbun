// Ported from pocketbase/tools/auth/internal/jwk/jwk_test.go

import { describe, it } from "bun:test";
import { createPublicKey, generateKeyPairSync, sign, type KeyObject } from "node:crypto";
import { Fetch, JWK, ValidateTokenSignature } from "./jwk.ts";

type ExportedJwk = {
  kty?: string;
  n?: string;
  e?: string;
  crv?: string;
  x?: string;
};

function base64UrlEncode(input: Buffer): string {
  return input.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function exportJwk(key: KeyObject): ExportedJwk {
  return key.export({ format: "jwk" }) as ExportedJwk;
}

function buildJwt(header: Record<string, unknown>, privateKey: KeyObject, algorithm: "RS256" | "EdDSA"): string {
  const encodedHeader = base64UrlEncode(Buffer.from(JSON.stringify(header), "utf8"));
  const encodedPayload = base64UrlEncode(Buffer.from("{}", "utf8"));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature =
    algorithm === "RS256"
      ? sign("RSA-SHA256", Buffer.from(signingInput, "utf8"), privateKey)
      : sign(null, Buffer.from(signingInput, "utf8"), privateKey);
  return `${signingInput}.${base64UrlEncode(signature)}`;
}

describe("jwk", () => {
  it("PublicKey", () => {
    const { publicKey: rsaPublic } = generateKeyPairSync("rsa", { modulusLength: 1024 });
    const rsaJwk = exportJwk(rsaPublic);

    const scenarios: Array<{
      name: string;
      key: JWK;
      expectError: boolean;
      expectKey: KeyObject | null;
    }> = [
      {
        name: "empty",
        key: new JWK(),
        expectError: true,
        expectKey: null,
      },
      {
        name: "invalid kty",
        key: Object.assign(new JWK(), {
          Kty: "invalid",
          Alg: "RS256",
          E: typeof rsaJwk.e === "string" ? rsaJwk.e : "",
          N: typeof rsaJwk.n === "string" ? rsaJwk.n : "",
        }),
        expectError: true,
        expectKey: null,
      },
      {
        name: "RSA",
        key: Object.assign(new JWK(), {
          Kty: "RSA",
          Alg: "RS256",
          E: typeof rsaJwk.e === "string" ? rsaJwk.e : "",
          N: typeof rsaJwk.n === "string" ? rsaJwk.n : "",
        }),
        expectError: false,
        expectKey: rsaPublic,
      },
      {
        name: "OKP with unsupported curve",
        key: Object.assign(new JWK(), {
          Kty: "OKP",
          Crv: "invalid",
          X: base64UrlEncode(Buffer.from("a".repeat(32), "utf8")),
        }),
        expectError: true,
        expectKey: null,
      },
      {
        name: "OKP with invalid public key length",
        key: Object.assign(new JWK(), {
          Kty: "OKP",
          Crv: "Ed25519",
          X: base64UrlEncode(Buffer.from("a".repeat(31), "utf8")),
        }),
        expectError: true,
        expectKey: null,
      },
      {
        name: "valid OKP",
        key: Object.assign(new JWK(), {
          Kty: "OKP",
          Crv: "Ed25519",
          X: base64UrlEncode(Buffer.from("a".repeat(32), "utf8")),
        }),
        expectError: false,
        expectKey: createPublicKey({
          key: {
            kty: "OKP",
            crv: "Ed25519",
            x: base64UrlEncode(Buffer.from("a".repeat(32), "utf8")),
          },
          format: "jwk",
        }),
      },
    ];

    for (const scenario of scenarios) {
      let err: Error | null = null;
      let result: KeyObject | null = null;
      try {
        result = scenario.key.PublicKey();
      } catch (error) {
        err = error as Error;
      }

      const hasErr = err !== null;
      if (hasErr !== scenario.expectError) {
        throw new Error(`Expected hasErr ${scenario.expectError}, got ${hasErr} (${err?.message ?? ""})`);
      }

      if (hasErr || !result || !scenario.expectKey) {
        continue;
      }

      const actual = exportJwk(result);
      const expected = exportJwk(scenario.expectKey);

      if (actual.kty !== expected.kty || actual.n !== expected.n || actual.e !== expected.e || actual.x !== expected.x) {
        throw new Error(
          `The returned public key doesn't match the expected one:\n${JSON.stringify(actual)}\n${JSON.stringify(expected)}`,
        );
      }
    }
  });

  it("Fetch", async () => {
    const server = Bun.serve({
      port: 0,
      fetch(req) {
        const url = new URL(req.url);
        const status = url.searchParams.has("error") ? 400 : 200;
        const body = JSON.stringify({
          keys: [
            {
              kid: "abc",
              kty: "OKP",
              crv: "Ed25519",
              x: "test_x",
            },
            {
              kid: "def",
              kty: "RSA",
              alg: "RS256",
              n: "test_n",
              e: "test_e",
            },
          ],
        });
        return new Response(body, { status, headers: { "content-type": "application/json" } });
      },
    });

    try {
      const scenarios = [
        { name: "error response", kid: "def", expectError: true, contains: [] as string[] },
        { name: "non-matching kid", kid: "missing", expectError: true, contains: [] as string[] },
        {
          name: "matching kid",
          kid: "def",
          expectError: false,
          contains: ['"kid":"def"', '"kty":"RSA"', '"alg":"RS256"', '"n":"test_n"', '"e":"test_e"'],
        },
      ];

      for (const scenario of scenarios) {
        const url = scenario.expectError ? `http://127.0.0.1:${server.port}?error` : `http://127.0.0.1:${server.port}`;

        let err: Error | null = null;
        let key: JWK | null = null;
        try {
          key = await Fetch(null, url, scenario.kid);
        } catch (error) {
          err = error as Error;
        }

        const hasErr = err !== null;
        if (hasErr !== scenario.expectError) {
          throw new Error(`Expected hasErr ${scenario.expectError}, got ${hasErr} (${err?.message ?? ""})`);
        }

        const rawStr = JSON.stringify(key ?? null) ?? "";
        for (const substr of scenario.contains) {
          if (!rawStr.includes(substr)) {
            throw new Error(`Missing expected substring\n${substr}\nin\n${rawStr}`);
          }
        }
      }
    } finally {
      await server.stop();
    }
  });

  it("ValidateTokenSignature", async () => {
    const { publicKey: rsaPublic, privateKey: rsaPrivate } = generateKeyPairSync("rsa", { modulusLength: 1024 });
    const { publicKey: edPublic, privateKey: edPrivate } = generateKeyPairSync("ed25519");

    const nonmatchingKidToken = buildJwt({ alg: "EdDSA", kid: "missing", typ: "JWT" }, edPrivate, "EdDSA");
    const key1Token = buildJwt({ alg: "EdDSA", kid: "key1", typ: "JWT" }, edPrivate, "EdDSA");
    const key2Token = buildJwt({ alg: "RS256", kid: "key2", typ: "JWT" }, rsaPrivate, "RS256");

    const rsaJwk = exportJwk(rsaPublic);
    const edJwk = exportJwk(edPublic);

    const server = Bun.serve({
      port: 0,
      fetch() {
        const body = JSON.stringify({
          keys: [
            {
              kid: "key1",
              kty: "OKP",
              alg: "EdDSA",
              crv: "Ed25519",
              x: edJwk.x,
            },
            {
              kid: "key2",
              kty: "RSA",
              alg: "RS256",
              e: rsaJwk.e,
              n: rsaJwk.n,
            },
          ],
        });
        return new Response(body, { headers: { "content-type": "application/json" } });
      },
    });

    try {
      const scenarios = [
        { name: "empty token", token: "", expectError: true },
        { name: "invalid token", token: "abc", expectError: true },
        { name: "no matching kid", token: nonmatchingKidToken, expectError: true },
        { name: "valid Ed25519 token", token: key1Token, expectError: false },
        { name: "valid RSA token", token: key2Token, expectError: false },
      ];

      for (const scenario of scenarios) {
        let err: Error | null = null;
        try {
          await ValidateTokenSignature(null, scenario.token, `http://127.0.0.1:${server.port}`);
        } catch (error) {
          err = error as Error;
        }

        const hasErr = err !== null;
        if (hasErr !== scenario.expectError) {
          throw new Error(`Expected hasErr ${scenario.expectError}, got ${hasErr} (${err?.message ?? ""})`);
        }
      }
    } finally {
      await server.stop();
    }
  });
});
