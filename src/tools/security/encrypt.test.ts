// Ported from pocketbase/tools/security/encrypt_test.go.

import { describe, expect, it } from "bun:test";
import { decrypt, encrypt } from "./encrypt.ts";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

describe("security encrypt", () => {
  it("Encrypt", () => {
    const scenarios = [
      { data: "", key: "", expectError: true },
      { data: "123", key: "test", expectError: true },
      { data: "123", key: "abcdabcdabcdabcdabcdabcdabcdabcd", expectError: false },
    ];

    for (const scenario of scenarios) {
      let result = "";
      let err: unknown = null;
      try {
        result = encrypt(textEncoder.encode(scenario.data), scenario.key);
      } catch (error) {
        err = error;
      }

      const hasErr = err != null;
      expect(hasErr).toBe(scenario.expectError);

      if (hasErr) {
        expect(result).toBe("");
        continue;
      }

      const decrypted = decrypt(result, scenario.key);
      expect(textDecoder.decode(decrypted)).toBe(scenario.data);
    }
  });

  it("Decrypt", () => {
    const scenarios = [
      { cipher: "", key: "", expectError: true, expectedData: "" },
      { cipher: "123", key: "test", expectError: true, expectedData: "" },
      {
        cipher: "8kcEqilvvYKYcfnSr0aSC54gmnQCsB02SaB8ATlnA==",
        key: "abcdabcdabcdabcdabcdabcdabcdabcd",
        expectError: true,
        expectedData: "",
      },
      {
        cipher: "8kcEqilvv+YKYcfnSr0aSC54gmnQCsB02SaB8ATlnA==",
        key: "abcdabcdabcdabcdabcdabcdabcdabcd",
        expectError: false,
        expectedData: "123",
      },
    ];

    for (const scenario of scenarios) {
      let result: Uint8Array | null = null;
      let err: unknown = null;
      try {
        result = decrypt(scenario.cipher, scenario.key);
      } catch (error) {
        err = error;
      }

      const hasErr = err != null;
      expect(hasErr).toBe(scenario.expectError);

      if (hasErr) {
        continue;
      }

      expect(textDecoder.decode(result as Uint8Array)).toBe(scenario.expectedData);
    }
  });
});
