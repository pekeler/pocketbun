// Ported from pocketbase/core/record_tokens_test.go

import { describe, expect, it } from "bun:test";
import type { Record as RecordModel } from "./record.ts";
import { newTestApp } from "../../tests/test_app.ts";
import { parseUnverifiedJWT } from "../tools/security/jwt.ts";
import { Collection, CollectionTypeAuth } from "./collection.ts";
import {
  TokenClaimRefreshable,
  TokenTypeAuth,
  TokenTypeEmailChange,
  TokenTypeFile,
  TokenTypePasswordReset,
  TokenTypeVerification,
} from "./record_tokens.ts";

describe("record tokens", () => {
  it("creates static auth tokens", async () => {
    await testRecordToken(TokenTypeAuth, (record) => record.NewStaticAuthToken(0), {
      [TokenClaimRefreshable]: false,
    });
  });

  it("uses custom durations for static auth tokens", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const user = app.FindAuthRecordByEmail("users", "test@example.com");

      const tolerance = 1;
      const durations = [-100, 0, 100];

      for (const duration of durations) {
        const nowSeconds = Math.floor(Date.now() / 1000);
        const token = user.NewStaticAuthToken(duration);
        const claims = parseUnverifiedJWT(token);
        const exp = Number(claims.exp);

        let expectedDuration = duration;
        if (expectedDuration <= 0) {
          expectedDuration = user.collection().AuthToken.DurationTime();
        }

        const expectedMinExp = nowSeconds + expectedDuration - tolerance;
        const expectedMaxExp = nowSeconds + expectedDuration + tolerance;

        expect(exp).toBeGreaterThanOrEqual(expectedMinExp);
        expect(exp).toBeLessThanOrEqual(expectedMaxExp);
      }
    } finally {
      await cleanup();
    }
  });

  it("creates auth tokens", async () => {
    await testRecordToken(TokenTypeAuth, (record) => record.NewAuthToken(), {
      [TokenClaimRefreshable]: true,
    });
  });

  it("creates verification tokens", async () => {
    await testRecordToken(TokenTypeVerification, (record) => record.NewVerificationToken(), null);
  });

  it("creates password reset tokens", async () => {
    await testRecordToken(TokenTypePasswordReset, (record) => record.NewPasswordResetToken(), null);
  });

  it("creates email change tokens", async () => {
    await testRecordToken(TokenTypeEmailChange, (record) => record.NewEmailChangeToken("new@example.com"), null);
  });

  it("creates file tokens", async () => {
    await testRecordToken(TokenTypeFile, (record) => record.NewFileToken(), null);
  });
});

async function testRecordToken(
  tokenType: string,
  tokenFunc: (record: RecordModel) => string,
  expectedClaims: Record<string, unknown> | null,
) {
  const { app, cleanup } = await newTestApp();
  try {
    const demo1 = app.FindRecordById("demo1", "84nmscqy84lsi1t");
    const user = app.FindAuthRecordByEmail("users", "test@example.com");

    expect(() => tokenFunc(demo1)).toThrow();

    const token = tokenFunc(user);
    const tokenRecord = app.FindAuthRecordByToken(token, tokenType);
    expect(tokenRecord.Id).toBe(user.Id);

    if (expectedClaims) {
      const claims = parseUnverifiedJWT(token);
      for (const [key, value] of Object.entries(expectedClaims)) {
        expect(claims[key]).toBe(value);
      }
    }

    user.SetTokenKey("");
    const collection = user.collection();
    Object.assign(collection, new Collection());
    collection.type = CollectionTypeAuth;

    expect(() => tokenFunc(user)).toThrow();
  } finally {
    await cleanup();
  }
}
