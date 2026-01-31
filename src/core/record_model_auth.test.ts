// Ported from pocketbase/core/record_model_auth_test.go

import { describe, expect, it } from "bun:test";
import { NewAuthCollection } from "./collection.ts";
import { NewRecord } from "./record.ts";
import { newTestApp } from "../../tests/test_app.ts";

describe("Record auth helpers", () => {
  it("handles email", () => {
    const record = NewRecord(NewAuthCollection("test"));
    expect(record.Email()).toBe("");

    record.SetEmail("test@example.com");
    expect(record.Email()).toBe("test@example.com");
  });

  it("handles email visibility", () => {
    const record = NewRecord(NewAuthCollection("test"));
    expect(record.EmailVisibility()).toBe(false);

    record.SetEmailVisibility(true);
    expect(record.EmailVisibility()).toBe(true);
  });

  it("handles verified flag", () => {
    const record = NewRecord(NewAuthCollection("test"));
    expect(record.Verified()).toBe(false);

    record.SetVerified(true);
    expect(record.Verified()).toBe(true);
  });

  it("handles token key", () => {
    const record = NewRecord(NewAuthCollection("test"));
    expect(record.TokenKey()).toBe("");

    record.SetTokenKey("example");
    expect(record.TokenKey()).toBe("example");

    record.RefreshTokenKey();
    expect(record.TokenKey()).not.toBe("example");
    expect(record.TokenKey().length).toBe(50);
  });

  it("handles password validation", () => {
    const scenarios = [
      { name: "empty password", password: "", expected: false },
      { name: "non-empty password", password: "123456", expected: true },
    ];

    for (const scenario of scenarios) {
      const record = NewRecord(NewAuthCollection("test"));
      expect(record.ValidatePassword(scenario.password)).toBe(false);

      record.SetPassword(scenario.password);
      expect(record.ValidatePassword(scenario.password)).toBe(scenario.expected);
      expect(record.ValidatePassword("random")).toBe(false);
    }
  });

  it("sets a random password and ignores plain validators", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const record = NewRecord(NewAuthCollection("test"));
      record.SetTokenKey("old_tokenKey");

      const pass = record.SetRandomPassword();
      expect(pass).not.toBe("");
      expect(record.ValidatePassword(pass)).toBe(true);
      expect(record.TokenKey()).not.toBe("old_tokenKey");

      const field = record.collection().Fields.GetByName("password");
      if (!field || field.Type() !== "password") {
        throw new Error("Expected password field");
      }

      const typed = field as typeof field & { Min: number; Max: number; Pattern: string };
      typed.Min = 1;
      typed.Max = 2;
      typed.Pattern = "\\d+";

      const err = field.ValidateValue(null, app, record);
      expect(err).toBeNull();
    } finally {
      await cleanup();
    }
  });
});
