// Ported from pocketbase/tools/security/jwt_test.go.

import { describe, expect, it } from "bun:test";
import { decodeUnverifiedJWT, newJWT, parseJWT, parseUnverifiedJWT } from "./jwt.ts";

describe("security jwt", () => {
  it("ParseUnverifiedJWT", () => {
    const invalidFormat = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJuYW1lIjoidGVzdCJ9";
    expect(() => parseUnverifiedJWT(invalidFormat)).toThrow();

    const invalidClaims =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJuYW1lIjoidGVzdCIsImV4cCI6MTUxNjIzOTAyMn0.xYHirwESfSEW3Cq2BL47CEASvD_p_ps3QCA54XtNktU";
    let invalidErr: unknown = null;
    try {
      parseUnverifiedJWT(invalidClaims);
    } catch (error) {
      invalidErr = error;
    }
    expect(invalidErr).toBeTruthy();
    const invalidErrClaims = (invalidErr as Error & { claims?: Record<string, unknown> }).claims ?? {};
    expect(invalidErrClaims.name).toBe("test");

    const validNoExp = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJuYW1lIjoidGVzdCJ9.ml0QsTms3K9wMygTu41ZhKlTyjmW9zHQtoS8FUsCCjU";
    const claims3 = parseUnverifiedJWT(validNoExp);
    expect(Object.keys(claims3).length).toBe(1);
    expect(claims3.name).toBe("test");

    const validWithExp =
      "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJuYW1lIjoidGVzdCIsImV4cCI6MjUyNDYwNDQ2MX0.VIEO73GP5QRQOSfHgQhaqeuYqcx59vL3xlxmFP-fytQ";
    const claims4 = parseUnverifiedJWT(validWithExp);
    expect(Object.keys(claims4).length).toBe(2);
    expect(claims4.name).toBe("test");

    const decodedClaims = decodeUnverifiedJWT(validWithExp);
    expect(decodedClaims.name).toBe("test");
  });

  it("ParseJWT", () => {
    const scenarios = [
      {
        name: "invalid formatted JWT",
        token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJuYW1lIjoidGVzdCJ9",
        secret: "test",
        expectError: true,
        expectClaims: null,
      },
      {
        name: "properly formatted JWT with INVALID claims and INVALID secret",
        token:
          "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJuYW1lIjoidGVzdCIsImV4cCI6MTUxNjIzOTAyMn0.xYHirwESfSEW3Cq2BL47CEASvD_p_ps3QCA54XtNktU",
        secret: "invalid",
        expectError: true,
        expectClaims: null,
      },
      {
        name: "properly formatted JWT with INVALID claims and VALID secret",
        token:
          "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJuYW1lIjoidGVzdCIsImV4cCI6MTUxNjIzOTAyMn0.xYHirwESfSEW3Cq2BL47CEASvD_p_ps3QCA54XtNktU",
        secret: "test",
        expectError: true,
        expectClaims: null,
      },
      {
        name: "properly formatted JWT with VALID claims and INVALID secret",
        token:
          "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJuYW1lIjoidGVzdCIsImV4cCI6MjUyNDYwNDQ2MX0.VIEO73GP5QRQOSfHgQhaqeuYqcx59vL3xlxmFP-fytQ",
        secret: "invalid",
        expectError: true,
        expectClaims: null,
      },
      {
        name: "properly formatted JWT with VALID claims and VALID secret",
        token:
          "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJuYW1lIjoidGVzdCIsImV4cCI6MjUyNDYwNDQ2MX0.VIEO73GP5QRQOSfHgQhaqeuYqcx59vL3xlxmFP-fytQ",
        secret: "test",
        expectError: false,
        expectClaims: { name: "test", exp: 2524604461 },
      },
      {
        name: "properly formatted JWT with VALID claims (without exp) and VALID secret",
        token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJuYW1lIjoidGVzdCJ9.ml0QsTms3K9wMygTu41ZhKlTyjmW9zHQtoS8FUsCCjU",
        secret: "test",
        expectError: false,
        expectClaims: { name: "test" },
      },
    ];

    for (const scenario of scenarios) {
      let claims: Record<string, unknown> | null = null;
      let err: unknown = null;
      try {
        claims = parseJWT(scenario.token, scenario.secret);
      } catch (error) {
        err = error;
      }

      const hasErr = err != null;
      expect(hasErr).toBe(scenario.expectError);

      if (scenario.expectError) {
        continue;
      }

      const expected = scenario.expectClaims ?? {};
      expect(Object.keys(claims as Record<string, unknown>).length).toBe(Object.keys(expected).length);
      for (const [key, value] of Object.entries(expected)) {
        expect((claims as Record<string, unknown>)[key]).toBe(value);
      }
    }
  });

  it("NewJWT", () => {
    const scenarios = [
      { name: "empty, zero duration", claims: {}, key: "", duration: 0, expectError: true },
      { name: "empty, 10 seconds duration", claims: {}, key: "", duration: 10, expectError: false },
      { name: "non-empty, 10 seconds duration", claims: { name: "test" }, key: "test", duration: 10, expectError: false },
    ];

    for (const scenario of scenarios) {
      const token = newJWT(scenario.claims, scenario.key, scenario.duration);
      let parsed: Record<string, unknown> | null = null;
      let err: unknown = null;
      try {
        parsed = parseJWT(token, scenario.key);
      } catch (error) {
        err = error;
      }

      const hasErr = err != null;
      expect(hasErr).toBe(scenario.expectError);
      if (scenario.expectError) {
        continue;
      }

      expect(parsed && "exp" in parsed).toBe(true);
      if (parsed) {
        delete parsed.exp;
      }
      expect(Object.keys(parsed as Record<string, unknown>).length).toBe(Object.keys(scenario.claims).length);
      for (const [key, value] of Object.entries(scenario.claims)) {
        expect((parsed as Record<string, unknown>)[key]).toBe(value);
      }
    }
  });
});
