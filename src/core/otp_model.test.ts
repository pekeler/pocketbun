// Ported from pocketbase/core/otp_model_test.go.

import { describe, expect, it } from "bun:test";
import { newTestApp } from "../../tests/test_app.ts";
import { testValidationErrors } from "../../tests/validation_errors.ts";
import { DateTime, NowDateTime } from "../tools/types/index.ts";
import { NewBaseCollection } from "./collection.ts";
import { CollectionNameOTPs, NewOTP, OTP } from "./otp_model.ts";
import { NewRecord } from "./record.ts";

describe("otp", () => {
  it("NewOTP", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const otp = NewOTP(app);
      expect(otp.ProxyRecord().collection().name).toBe(CollectionNameOTPs);
    } finally {
      await cleanup();
    }
  });

  it("OTP ProxyRecord", () => {
    const record = NewRecord(NewBaseCollection("test"));
    record.Id = "test_id";

    const otp = new OTP();
    otp.SetProxyRecord(record);

    expect(otp.ProxyRecord().Id).toBe(record.Id);
  });

  it("OTP RecordRef", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const otp = NewOTP(app);
      const testValues = ["test_1", "test2", ""];
      for (const testValue of testValues) {
        otp.SetRecordRef(testValue);
        expect(otp.RecordRef()).toBe(testValue);
        expect(otp.ProxyRecord().GetString("recordRef")).toBe(testValue);
      }
    } finally {
      await cleanup();
    }
  });

  it("OTP CollectionRef", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const otp = NewOTP(app);
      const testValues = ["test_1", "test2", ""];
      for (const testValue of testValues) {
        otp.SetCollectionRef(testValue);
        expect(otp.CollectionRef()).toBe(testValue);
        expect(otp.ProxyRecord().GetString("collectionRef")).toBe(testValue);
      }
    } finally {
      await cleanup();
    }
  });

  it("OTP SentTo", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const otp = NewOTP(app);
      const testValues = ["test_1", "test2", ""];
      for (const testValue of testValues) {
        otp.SetSentTo(testValue);
        expect(otp.SentTo()).toBe(testValue);
        expect(otp.ProxyRecord().GetString("sentTo")).toBe(testValue);
      }
    } finally {
      await cleanup();
    }
  });

  it("OTP Created", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const otp = NewOTP(app);
      expect(otp.Created().String()).toBe("");

      const now = NowDateTime();
      otp.ProxyRecord().SetRaw("created", now);
      expect(otp.Created().String()).toBe(now.String());
    } finally {
      await cleanup();
    }
  });

  it("OTP Updated", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const otp = NewOTP(app);
      expect(otp.Updated().String()).toBe("");

      const now = NowDateTime();
      otp.ProxyRecord().SetRaw("updated", now);
      expect(otp.Updated().String()).toBe(now.String());
    } finally {
      await cleanup();
    }
  });

  it("OTP HasExpired", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const now = NowDateTime();
      const otp = NewOTP(app);
      const created = new DateTime(now.time()).Add(-5 * 60 * 1000);
      otp.ProxyRecord().SetRaw("created", created);

      const scenarios = [
        { maxElapsedMs: 0, expected: true },
        { maxElapsedMs: 3 * 60 * 1000, expected: true },
        { maxElapsedMs: 5 * 60 * 1000, expected: true },
        { maxElapsedMs: 6 * 60 * 1000, expected: false },
      ];

      for (const scenario of scenarios) {
        expect(otp.HasExpired(scenario.maxElapsedMs)).toBe(scenario.expected);
      }
    } finally {
      await cleanup();
    }
  });

  it("OTP PreValidate", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const otpsCol = app.findCollectionByNameOrId(CollectionNameOTPs);
      expect(otpsCol).toBeTruthy();
      if (!otpsCol) {
        return;
      }

      const user = app.FindAuthRecordByEmail("users", "test@example.com");

      const otpMissing = new OTP();
      expect(app.Validate(otpMissing)).not.toBeNull();

      const otpInvalid = new OTP();
      otpInvalid.SetProxyRecord(NewRecord(NewBaseCollection("invalid")));
      otpInvalid.SetRecordRef(user.Id);
      otpInvalid.SetCollectionRef(user.collection().id);
      otpInvalid.ProxyRecord().SetPassword("test123");
      expect(app.Validate(otpInvalid)).not.toBeNull();

      const otpValid = new OTP();
      otpValid.SetProxyRecord(NewRecord(otpsCol));
      otpValid.SetRecordRef(user.Id);
      otpValid.SetCollectionRef(user.collection().id);
      otpValid.ProxyRecord().SetPassword("test123");
      expect(app.Validate(otpValid)).toBeNull();
    } finally {
      await cleanup();
    }
  });

  it("OTP validate hook", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const user = app.FindAuthRecordByEmail("users", "test@example.com");
      const demo1 = app.FindRecordById("demo1", "84nmscqy84lsi1t");

      const scenarios = [
        {
          name: "empty",
          otp: () => NewOTP(app),
          expectErrors: ["collectionRef", "recordRef", "password"],
        },
        {
          name: "non-auth collection",
          otp: () => {
            const otp = NewOTP(app);
            otp.SetCollectionRef(demo1.collection().id);
            otp.SetRecordRef(demo1.Id);
            otp.ProxyRecord().SetPassword("test123");
            return otp;
          },
          expectErrors: ["collectionRef"],
        },
        {
          name: "missing record id",
          otp: () => {
            const otp = NewOTP(app);
            otp.SetCollectionRef(user.collection().id);
            otp.SetRecordRef("missing");
            otp.ProxyRecord().SetPassword("test123");
            return otp;
          },
          expectErrors: ["recordRef"],
        },
        {
          name: "valid ref",
          otp: () => {
            const otp = NewOTP(app);
            otp.SetCollectionRef(user.collection().id);
            otp.SetRecordRef(user.Id);
            otp.ProxyRecord().SetPassword("test123");
            return otp;
          },
          expectErrors: [],
        },
      ];

      for (const scenario of scenarios) {
        const errs = app.Validate(scenario.otp());
        testValidationErrors(errs, scenario.expectErrors);
      }
    } finally {
      await cleanup();
    }
  });
});
