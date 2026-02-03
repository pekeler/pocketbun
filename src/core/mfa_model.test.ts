// Ported from pocketbase/core/mfa_model_test.go.

import { describe, expect, it } from "bun:test";
import { newTestApp } from "../tests/app.ts";
import { testValidationErrors } from "../tests/validation_errors.ts";
import { DateTime, NowDateTime } from "../tools/types/index.ts";
import { NewBaseCollection } from "./collection_model.ts";
import { CollectionNameMFAs, MFA, NewMFA } from "./mfa_model.ts";
import { NewRecord } from "./record_model.ts";

describe("mfa", () => {
  it("NewMFA", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const mfa = NewMFA(app);
      expect(mfa.ProxyRecord().collection().name).toBe(CollectionNameMFAs);
    } finally {
      await cleanup();
    }
  });

  it("MFA ProxyRecord", () => {
    const record = NewRecord(NewBaseCollection("test"));
    record.Id = "test_id";

    const mfa = new MFA();
    mfa.SetProxyRecord(record);

    expect(mfa.ProxyRecord().Id).toBe(record.Id);
  });

  it("MFA RecordRef", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const mfa = NewMFA(app);
      const testValues = ["test_1", "test2", ""];
      for (const testValue of testValues) {
        mfa.SetRecordRef(testValue);
        expect(mfa.RecordRef()).toBe(testValue);
        expect(mfa.ProxyRecord().GetString("recordRef")).toBe(testValue);
      }
    } finally {
      await cleanup();
    }
  });

  it("MFA CollectionRef", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const mfa = NewMFA(app);
      const testValues = ["test_1", "test2", ""];
      for (const testValue of testValues) {
        mfa.SetCollectionRef(testValue);
        expect(mfa.CollectionRef()).toBe(testValue);
        expect(mfa.ProxyRecord().GetString("collectionRef")).toBe(testValue);
      }
    } finally {
      await cleanup();
    }
  });

  it("MFA Method", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const mfa = NewMFA(app);
      const testValues = ["test_1", "test2", ""];
      for (const testValue of testValues) {
        mfa.SetMethod(testValue);
        expect(mfa.Method()).toBe(testValue);
        expect(mfa.ProxyRecord().GetString("method")).toBe(testValue);
      }
    } finally {
      await cleanup();
    }
  });

  it("MFA Created", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const mfa = NewMFA(app);
      expect(mfa.Created().String()).toBe("");

      const now = NowDateTime();
      mfa.ProxyRecord().SetRaw("created", now);
      expect(mfa.Created().String()).toBe(now.String());
    } finally {
      await cleanup();
    }
  });

  it("MFA Updated", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const mfa = NewMFA(app);
      expect(mfa.Updated().String()).toBe("");

      const now = NowDateTime();
      mfa.ProxyRecord().SetRaw("updated", now);
      expect(mfa.Updated().String()).toBe(now.String());
    } finally {
      await cleanup();
    }
  });

  it("MFA HasExpired", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const now = NowDateTime();
      const mfa = NewMFA(app);
      const created = new DateTime(now.time()).Add(-5 * 60 * 1000);
      mfa.ProxyRecord().SetRaw("created", created);

      const scenarios = [
        { maxElapsedMs: 0, expected: true },
        { maxElapsedMs: 3 * 60 * 1000, expected: true },
        { maxElapsedMs: 5 * 60 * 1000, expected: true },
        { maxElapsedMs: 6 * 60 * 1000, expected: false },
      ];

      for (const scenario of scenarios) {
        expect(mfa.HasExpired(scenario.maxElapsedMs)).toBe(scenario.expected);
      }
    } finally {
      await cleanup();
    }
  });

  it("MFA PreValidate", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const mfasCol = app.findCollectionByNameOrId(CollectionNameMFAs);
      expect(mfasCol).toBeTruthy();
      if (!mfasCol) {
        return;
      }

      const user = app.FindAuthRecordByEmail("users", "test@example.com");

      const mfaMissing = new MFA();
      expect(await app.Validate(mfaMissing)).not.toBeNull();

      const mfaInvalid = new MFA();
      mfaInvalid.SetProxyRecord(NewRecord(NewBaseCollection("invalid")));
      mfaInvalid.SetRecordRef(user.Id);
      mfaInvalid.SetCollectionRef(user.collection().id);
      mfaInvalid.SetMethod("test123");
      expect(await app.Validate(mfaInvalid)).not.toBeNull();

      const mfaValid = new MFA();
      mfaValid.SetProxyRecord(NewRecord(mfasCol));
      mfaValid.SetRecordRef(user.Id);
      mfaValid.SetCollectionRef(user.collection().id);
      mfaValid.SetMethod("test123");
      expect(await app.Validate(mfaValid)).toBeNull();
    } finally {
      await cleanup();
    }
  });

  it("MFA validate hook", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const user = app.FindAuthRecordByEmail("users", "test@example.com");
      const demo1 = app.FindRecordById("demo1", "84nmscqy84lsi1t");

      const scenarios = [
        {
          name: "empty",
          mfa: () => NewMFA(app),
          expectErrors: ["collectionRef", "recordRef", "method"],
        },
        {
          name: "non-auth collection",
          mfa: () => {
            const mfa = NewMFA(app);
            mfa.SetCollectionRef(demo1.collection().id);
            mfa.SetRecordRef(demo1.Id);
            mfa.SetMethod("test123");
            return mfa;
          },
          expectErrors: ["collectionRef"],
        },
        {
          name: "missing record id",
          mfa: () => {
            const mfa = NewMFA(app);
            mfa.SetCollectionRef(user.collection().id);
            mfa.SetRecordRef("missing");
            mfa.SetMethod("test123");
            return mfa;
          },
          expectErrors: ["recordRef"],
        },
        {
          name: "valid ref",
          mfa: () => {
            const mfa = NewMFA(app);
            mfa.SetCollectionRef(user.collection().id);
            mfa.SetRecordRef(user.Id);
            mfa.SetMethod("test123");
            return mfa;
          },
          expectErrors: [],
        },
      ];

      for (const scenario of scenarios) {
        const errs = await app.Validate(scenario.mfa());
        testValidationErrors(errs, scenario.expectErrors);
      }
    } finally {
      await cleanup();
    }
  });
});
