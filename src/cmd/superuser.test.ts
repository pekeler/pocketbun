// Ported from pocketbase/cmd/superuser_test.go

import { describe, expect, it } from "bun:test";
import { CollectionNameSuperusers } from "../core/collection_model.ts";
import { newTestApp } from "../tests/app.ts";
import { superuserCreate, superuserDelete, superuserIPs, superuserOTP, superuserUpdate, superuserUpsert } from "./superuser.ts";

describe("superuser helpers", () => {
  it("superuserUpsert", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const scenarios = [
        { name: "empty email and password", email: "", password: "", expectError: true },
        { name: "empty email", email: "", password: "1234567890", expectError: true },
        { name: "invalid email", email: "invalid", password: "1234567890", expectError: true },
        { name: "empty password", email: "test@example.com", password: "", expectError: true },
        { name: "short password", email: "test_new@example.com", password: "1234567", expectError: true },
        { name: "existing user", email: "test@example.com", password: "1234567890!", expectError: false },
        { name: "new user", email: "test_new@example.com", password: "1234567890!", expectError: false },
      ];

      for (const scenario of scenarios) {
        const result = await tryCall(() => superuserUpsert(app, scenario.email, scenario.password));
        expect(Boolean(result.error)).toBe(scenario.expectError);

        if (result.error) {
          continue;
        }

        const superuser = app.FindAuthRecordByEmail(CollectionNameSuperusers, scenario.email);
        expect(superuser.ValidatePassword(scenario.password)).toBe(true);
      }
    } finally {
      await cleanup();
    }
  });

  it("superuserCreate", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const scenarios = [
        { name: "empty email and password", email: "", password: "", expectError: true },
        { name: "empty email", email: "", password: "1234567890", expectError: true },
        { name: "invalid email", email: "invalid", password: "1234567890", expectError: true },
        { name: "duplicated email", email: "test@example.com", password: "1234567890", expectError: true },
        { name: "empty password", email: "test@example.com", password: "", expectError: true },
        { name: "short password", email: "test_new@example.com", password: "1234567", expectError: true },
        { name: "valid email and password", email: "test_new@example.com", password: "12345678", expectError: false },
      ];

      for (const scenario of scenarios) {
        const result = await tryCall(() => superuserCreate(app, scenario.email, scenario.password));
        expect(Boolean(result.error)).toBe(scenario.expectError);

        if (result.error) {
          continue;
        }

        const superuser = app.FindAuthRecordByEmail(CollectionNameSuperusers, scenario.email);
        expect(superuser.ValidatePassword(scenario.password)).toBe(true);
      }
    } finally {
      await cleanup();
    }
  });

  it("superuserUpdate", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const scenarios = [
        { name: "empty email and password", email: "", password: "", expectError: true },
        { name: "empty email", email: "", password: "1234567890", expectError: true },
        { name: "invalid email", email: "invalid", password: "1234567890", expectError: true },
        { name: "nonexisting superuser", email: "test_missing@example.com", password: "1234567890", expectError: true },
        { name: "empty password", email: "test@example.com", password: "", expectError: true },
        { name: "short password", email: "test_new@example.com", password: "1234567", expectError: true },
        { name: "valid email and password", email: "test@example.com", password: "12345678", expectError: false },
      ];

      for (const scenario of scenarios) {
        const result = await tryCall(() => superuserUpdate(app, scenario.email, scenario.password));
        expect(Boolean(result.error)).toBe(scenario.expectError);

        if (result.error) {
          continue;
        }

        const superuser = app.FindAuthRecordByEmail(CollectionNameSuperusers, scenario.email);
        expect(superuser.ValidatePassword(scenario.password)).toBe(true);
      }
    } finally {
      await cleanup();
    }
  });

  it("superuserDelete", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const scenarios = [
        { name: "empty email", email: "", expectError: true },
        { name: "invalid email", email: "invalid", expectError: true },
        { name: "nonexisting superuser", email: "test_missing@example.com", expectError: false },
        { name: "existing superuser", email: "test@example.com", expectError: false },
      ];

      for (const scenario of scenarios) {
        const result = await tryCall(() => superuserDelete(app, scenario.email));
        expect(Boolean(result.error)).toBe(scenario.expectError);

        if (result.error) {
          continue;
        }

        expect(() => app.FindAuthRecordByEmail(CollectionNameSuperusers, scenario.email)).toThrow();
      }
    } finally {
      await cleanup();
    }
  });

  it("superuserOTP", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const superusersCollection = app.findCollectionByNameOrId(CollectionNameSuperusers);
      if (!superusersCollection) {
        throw new Error("missing superusers collection");
      }

      const otps = app.FindAllOTPsByCollection(superusersCollection);
      for (const otp of otps) {
        const err = await app.Delete(otp);
        if (err) {
          throw err;
        }
      }

      const scenarios = [
        { name: "empty email", email: "", enabled: true, expectError: true },
        { name: "invalid email", email: "invalid", enabled: true, expectError: true },
        { name: "nonexisting superuser", email: "test_missing@example.com", enabled: true, expectError: true },
        { name: "existing superuser", email: "test@example.com", enabled: true, expectError: false },
        { name: "existing superuser with disabled OTP", email: "test@example.com", enabled: false, expectError: true },
      ];

      for (const scenario of scenarios) {
        superusersCollection.OTP.Enabled = scenario.enabled;
        const saveErr = await app.SaveNoValidate(superusersCollection);
        if (saveErr) {
          throw saveErr;
        }

        const result = await tryCall(() => superuserOTP(app, scenario.email));
        expect(Boolean(result.error)).toBe(scenario.expectError);

        if (result.error) {
          continue;
        }

        const superuser = app.FindAuthRecordByEmail(superusersCollection, scenario.email);
        const recordOtps = app.FindAllOTPsByRecord(superuser);
        expect(recordOtps.length).toBe(1);
      }
    } finally {
      await cleanup();
    }
  });

  it("superuserIPs", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const invalid = await tryCall(() => superuserIPs(app, ["127.0.0.1", "invalid"]));
      expect(Boolean(invalid.error)).toBe(true);

      const updated = await superuserIPs(app, ["127.0.0.1", "10.0.0.0/24"]);
      expect(updated).toEqual(["127.0.0.1", "10.0.0.0/24"]);
      expect(app.settings().superuserIPs).toEqual(["127.0.0.1", "10.0.0.0/24"]);

      const cleared = await superuserIPs(app, []);
      expect(cleared).toEqual([]);
      expect(app.settings().superuserIPs).toEqual([]);
    } finally {
      await cleanup();
    }
  });
});

async function tryCall<T>(fn: () => Promise<T> | T): Promise<{ value: T | null; error: unknown }> {
  try {
    return { value: await fn(), error: null };
  } catch (error) {
    return { value: null, error };
  }
}
