// Ported from pocketbase/forms/apple_client_secret_create_test.go

import { describe, it } from "bun:test";
import { generateKeyPairSync } from "node:crypto";
import { TestApp } from "../tests/app.ts";
import { NewAppleClientSecretCreate } from "./apple_client_secret_create.ts";

describe("AppleClientSecretCreate", () => {
  it("Validate and Submit", async () => {
    // This form test doesn't touch fixture data; keep it unbootstrapped.
    const app = new TestApp({ dataDir: ".pb_test_unbootstrapped", encryptionEnv: "pb_test_env" });
    const { privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    const privatePem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

    const scenarios = [
      { name: "empty data", formData: {}, expectError: true },
      {
        name: "invalid data",
        formData: {
          clientId: "",
          teamId: "123456789",
          keyId: "123456789",
          privateKey: "-----BEGIN PRIVATE KEY----- invalid -----END PRIVATE KEY-----",
          duration: -1,
        },
        expectError: true,
      },
      {
        name: "valid data",
        formData: {
          clientId: "123",
          teamId: "1234567890",
          keyId: "1234567891",
          privateKey: privatePem,
          duration: 1,
        },
        expectError: false,
      },
    ];

    for (const scenario of scenarios) {
      const form = NewAppleClientSecretCreate(app);
      applyFormData(form, scenario.formData);

      const { secret, error } = form.Submit();
      const hasErr = error !== null;
      if (hasErr !== scenario.expectError) {
        throw new Error(`[${scenario.name}] Expected hasErr ${scenario.expectError}, got ${hasErr} (${error?.message ?? ""})`);
      }

      if (hasErr) {
        continue;
      }

      if (!secret) {
        throw new Error(`[${scenario.name}] Expected non-empty secret`);
      }

      const header = decodeJwtHeader(secret);
      if (header.alg !== "ES256") {
        throw new Error(`[${scenario.name}] Expected "ES256" alg header, got ${String(header.alg)}`);
      }

      if (header.kid !== form.KeyId) {
        throw new Error(`[${scenario.name}] Expected ${form.KeyId} kid header, got ${String(header.kid)}`);
      }
    }
  });
});

function decodeJwtHeader(token: string): Record<string, unknown> {
  const [headerPart] = token.split(".");
  if (!headerPart) {
    throw new Error("invalid jwt format");
  }
  const json = Buffer.from(base64UrlToBase64(headerPart), "base64").toString("utf8");
  return JSON.parse(json) as Record<string, unknown>;
}

function base64UrlToBase64(input: string): string {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
  return normalized + padding;
}

function applyFormData(form: ReturnType<typeof NewAppleClientSecretCreate>, data: Record<string, unknown>): void {
  if (typeof data.clientId === "string") {
    form.ClientId = data.clientId;
  }
  if (typeof data.teamId === "string") {
    form.TeamId = data.teamId;
  }
  if (typeof data.keyId === "string") {
    form.KeyId = data.keyId;
  }
  if (typeof data.privateKey === "string") {
    form.PrivateKey = data.privateKey;
  }
  if (typeof data.duration === "number") {
    form.Duration = data.duration;
  }
}
