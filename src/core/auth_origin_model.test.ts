// Ported from pocketbase/core/auth_origin_model_test.go.

import { describe, expect, it } from "bun:test";
import { newTestApp } from "../../tests/test_app.ts";
import { testValidationErrors } from "../../tests/validation_errors.ts";
import { CollectionNameAuthOrigins, NewAuthOrigin, AuthOrigin } from "./auth_origin_model.ts";
import { CollectionNameSuperusers, NewBaseCollection } from "./collection.ts";
import { NewRecord } from "./record.ts";
import { NowDateTime } from "../tools/types/index.ts";

describe("auth origin", () => {
  it("NewAuthOrigin", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const origin = NewAuthOrigin(app);
      expect(origin.ProxyRecord().collection().name).toBe(CollectionNameAuthOrigins);
    } finally {
      await cleanup();
    }
  });

  it("AuthOrigin ProxyRecord", () => {
    const record = NewRecord(NewBaseCollection("test"));
    record.Id = "test_id";

    const origin = new AuthOrigin();
    origin.SetProxyRecord(record);

    expect(origin.ProxyRecord().Id).toBe(record.Id);
  });

  it("AuthOrigin RecordRef", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const origin = NewAuthOrigin(app);

      const testValues = ["test_1", "test2", ""];
      for (const testValue of testValues) {
        origin.SetRecordRef(testValue);

        expect(origin.RecordRef()).toBe(testValue);
        expect(origin.ProxyRecord().GetString("recordRef")).toBe(testValue);
      }
    } finally {
      await cleanup();
    }
  });

  it("AuthOrigin CollectionRef", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const origin = NewAuthOrigin(app);

      const testValues = ["test_1", "test2", ""];
      for (const testValue of testValues) {
        origin.SetCollectionRef(testValue);

        expect(origin.CollectionRef()).toBe(testValue);
        expect(origin.ProxyRecord().GetString("collectionRef")).toBe(testValue);
      }
    } finally {
      await cleanup();
    }
  });

  it("AuthOrigin Fingerprint", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const origin = NewAuthOrigin(app);

      const testValues = ["test_1", "test2", ""];
      for (const testValue of testValues) {
        origin.SetFingerprint(testValue);

        expect(origin.Fingerprint()).toBe(testValue);
        expect(origin.ProxyRecord().GetString("fingerprint")).toBe(testValue);
      }
    } finally {
      await cleanup();
    }
  });

  it("AuthOrigin Created", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const origin = NewAuthOrigin(app);

      expect(origin.Created().String()).toBe("");

      const now = NowDateTime();
      origin.ProxyRecord().SetRaw("created", now);

      expect(origin.Created().String()).toBe(now.String());
    } finally {
      await cleanup();
    }
  });

  it("AuthOrigin Updated", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const origin = NewAuthOrigin(app);

      expect(origin.Updated().String()).toBe("");

      const now = NowDateTime();
      origin.ProxyRecord().SetRaw("updated", now);

      expect(origin.Updated().String()).toBe(now.String());
    } finally {
      await cleanup();
    }
  });

  it("AuthOrigin PreValidate", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const originsCol = app.findCollectionByNameOrId(CollectionNameAuthOrigins);
      if (!originsCol) {
        throw new Error("Missing auth origins collection");
      }

      const user = app.FindAuthRecordByEmail("users", "test@example.com");

      {
        const origin = new AuthOrigin();
        const err = app.Validate(origin);
        expect(err).not.toBeNull();
      }

      {
        const origin = new AuthOrigin();
        origin.SetProxyRecord(NewRecord(NewBaseCollection("invalid")));
        origin.SetRecordRef(user.Id);
        origin.SetCollectionRef(user.collection().id);
        origin.SetFingerprint("abc");

        const err = app.Validate(origin);
        expect(err).not.toBeNull();
      }

      {
        const origin = new AuthOrigin();
        origin.SetProxyRecord(NewRecord(originsCol));
        origin.SetRecordRef(user.Id);
        origin.SetCollectionRef(user.collection().id);
        origin.SetFingerprint("abc");

        const err = app.Validate(origin);
        expect(err).toBeNull();
      }
    } finally {
      await cleanup();
    }
  });

  it("AuthOrigin ValidateHook", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const user = app.FindAuthRecordByEmail("users", "test@example.com");
      const demo1 = app.FindRecordById("demo1", "84nmscqy84lsi1t");

      const scenarios = [
        {
          name: "empty",
          origin: () => NewAuthOrigin(app),
          expectErrors: ["collectionRef", "recordRef", "fingerprint"],
        },
        {
          name: "non-auth collection",
          origin: () => {
            const origin = NewAuthOrigin(app);
            origin.SetCollectionRef(demo1.collection().id);
            origin.SetRecordRef(demo1.Id);
            origin.SetFingerprint("abc");
            return origin;
          },
          expectErrors: ["collectionRef"],
        },
        {
          name: "missing record id",
          origin: () => {
            const origin = NewAuthOrigin(app);
            origin.SetCollectionRef(user.collection().id);
            origin.SetRecordRef("missing");
            origin.SetFingerprint("abc");
            return origin;
          },
          expectErrors: ["recordRef"],
        },
        {
          name: "valid ref",
          origin: () => {
            const origin = NewAuthOrigin(app);
            origin.SetCollectionRef(user.collection().id);
            origin.SetRecordRef(user.Id);
            origin.SetFingerprint("abc");
            return origin;
          },
          expectErrors: [],
        },
      ];

      for (const scenario of scenarios) {
        const errs = app.Validate(scenario.origin());
        testValidationErrors(errs, scenario.expectErrors);
      }
    } finally {
      await cleanup();
    }
  });

  it("AuthOrigin PasswordChangeDeletion", async () => {
    const { app: testApp, cleanup: testCleanup } = await newTestApp();
    try {
      const user1 = testApp.FindAuthRecordByEmail("users", "test@example.com");
      const superuser2 = testApp.FindAuthRecordByEmail(
        CollectionNameSuperusers,
        "test2@example.com",
      );
      const client1 = testApp.FindAuthRecordByEmail("clients", "test@example.com");

      const scenarios = [
        { record: user1, deletedIds: [] as string[] },
        {
          record: superuser2,
          deletedIds: ["5798yh833k6w6w0", "ic55o70g4f8pcl4", "dmy260k6ksjr4ib"],
        },
        { record: client1, deletedIds: ["9r2j0m74260ur8i"] },
      ];

      for (const scenario of scenarios) {
        const { app, cleanup } = await newTestApp();
        try {
          const deletedIds: string[] = [];
          app.OnRecordDelete().BindFunc((e) => {
            if (e.Record) {
              deletedIds.push(e.Record.Id);
            }
            return e.Next();
          });

          scenario.record.SetPassword("new_password");

          const err = app.Save(scenario.record);
          if (err) {
            throw err;
          }

          expect(deletedIds.length).toBe(scenario.deletedIds.length);
          for (const id of scenario.deletedIds) {
            expect(deletedIds.includes(id)).toBe(true);
          }
        } finally {
          await cleanup();
        }
      }
    } finally {
      await testCleanup();
    }
  });
});
