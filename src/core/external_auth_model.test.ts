// Ported from pocketbase/core/external_auth_model_test.go.

import { describe, expect, it } from "bun:test";
import { newTestApp } from "../tests/app.ts";
import { testValidationErrors } from "../tests/validation_errors.ts";
import { NowDateTime } from "../tools/types/index.ts";
import { NewBaseCollection } from "./collection.ts";
import { CollectionNameExternalAuths, ExternalAuth, NewExternalAuth } from "./external_auth_model.ts";
import { NewRecord } from "./record.ts";

describe("external auth", () => {
  it("NewExternalAuth", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const externalAuth = NewExternalAuth(app);
      expect(externalAuth.ProxyRecord().collection().name).toBe(CollectionNameExternalAuths);
    } finally {
      await cleanup();
    }
  });

  it("ExternalAuth ProxyRecord", () => {
    const record = NewRecord(NewBaseCollection("test"));
    record.Id = "test_id";

    const externalAuth = new ExternalAuth();
    externalAuth.SetProxyRecord(record);

    expect(externalAuth.ProxyRecord().Id).toBe(record.Id);
  });

  it("ExternalAuth RecordRef", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const externalAuth = NewExternalAuth(app);
      const testValues = ["test_1", "test2", ""];
      for (const testValue of testValues) {
        externalAuth.SetRecordRef(testValue);

        expect(externalAuth.RecordRef()).toBe(testValue);
        expect(externalAuth.ProxyRecord().GetString("recordRef")).toBe(testValue);
      }
    } finally {
      await cleanup();
    }
  });

  it("ExternalAuth CollectionRef", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const externalAuth = NewExternalAuth(app);
      const testValues = ["test_1", "test2", ""];
      for (const testValue of testValues) {
        externalAuth.SetCollectionRef(testValue);

        expect(externalAuth.CollectionRef()).toBe(testValue);
        expect(externalAuth.ProxyRecord().GetString("collectionRef")).toBe(testValue);
      }
    } finally {
      await cleanup();
    }
  });

  it("ExternalAuth Provider", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const externalAuth = NewExternalAuth(app);
      const testValues = ["test_1", "test2", ""];
      for (const testValue of testValues) {
        externalAuth.SetProvider(testValue);

        expect(externalAuth.Provider()).toBe(testValue);
        expect(externalAuth.ProxyRecord().GetString("provider")).toBe(testValue);
      }
    } finally {
      await cleanup();
    }
  });

  it("ExternalAuth ProviderId", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const externalAuth = NewExternalAuth(app);
      const testValues = ["test_1", "test2", ""];
      for (const testValue of testValues) {
        externalAuth.SetProviderId(testValue);

        expect(externalAuth.ProviderId()).toBe(testValue);
        expect(externalAuth.ProxyRecord().GetString("providerId")).toBe(testValue);
      }
    } finally {
      await cleanup();
    }
  });

  it("ExternalAuth Created", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const externalAuth = NewExternalAuth(app);

      expect(externalAuth.Created().String()).toBe("");

      const now = NowDateTime();
      externalAuth.ProxyRecord().SetRaw("created", now);

      expect(externalAuth.Created().String()).toBe(now.String());
    } finally {
      await cleanup();
    }
  });

  it("ExternalAuth Updated", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const externalAuth = NewExternalAuth(app);

      expect(externalAuth.Updated().String()).toBe("");

      const now = NowDateTime();
      externalAuth.ProxyRecord().SetRaw("updated", now);

      expect(externalAuth.Updated().String()).toBe(now.String());
    } finally {
      await cleanup();
    }
  });

  it("ExternalAuth PreValidate", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const externalAuthsCol = app.findCollectionByNameOrId(CollectionNameExternalAuths);
      if (!externalAuthsCol) {
        throw new Error("Missing external auths collection");
      }

      const user = app.FindAuthRecordByEmail("users", "test@example.com");

      {
        const externalAuth = new ExternalAuth();
        const err = app.Validate(externalAuth);
        expect(err).not.toBeNull();
      }

      {
        const externalAuth = new ExternalAuth();
        externalAuth.SetProxyRecord(NewRecord(NewBaseCollection("invalid")));
        externalAuth.SetRecordRef(user.Id);
        externalAuth.SetCollectionRef(user.collection().id);
        externalAuth.SetProvider("gitlab");
        externalAuth.SetProviderId("test123");

        const err = app.Validate(externalAuth);
        expect(err).not.toBeNull();
      }

      {
        const externalAuth = new ExternalAuth();
        externalAuth.SetProxyRecord(NewRecord(externalAuthsCol));
        externalAuth.SetRecordRef(user.Id);
        externalAuth.SetCollectionRef(user.collection().id);
        externalAuth.SetProvider("gitlab");
        externalAuth.SetProviderId("test123");

        const err = app.Validate(externalAuth);
        expect(err).toBeNull();
      }
    } finally {
      await cleanup();
    }
  });

  it("ExternalAuth ValidateHook", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const user = app.FindAuthRecordByEmail("users", "test@example.com");
      const demo1 = app.FindRecordById("demo1", "84nmscqy84lsi1t");

      const scenarios = [
        {
          name: "empty",
          externalAuth: () => NewExternalAuth(app),
          expectErrors: ["collectionRef", "recordRef", "provider", "providerId"],
        },
        {
          name: "non-auth collection",
          externalAuth: () => {
            const externalAuth = NewExternalAuth(app);
            externalAuth.SetCollectionRef(demo1.collection().id);
            externalAuth.SetRecordRef(demo1.Id);
            externalAuth.SetProvider("gitlab");
            externalAuth.SetProviderId("test123");
            return externalAuth;
          },
          expectErrors: ["collectionRef"],
        },
        {
          name: "disabled provider",
          externalAuth: () => {
            const externalAuth = NewExternalAuth(app);
            externalAuth.SetCollectionRef(user.collection().id);
            externalAuth.SetRecordRef("missing");
            externalAuth.SetProvider("apple");
            externalAuth.SetProviderId("test123");
            return externalAuth;
          },
          expectErrors: ["recordRef"],
        },
        {
          name: "missing record id",
          externalAuth: () => {
            const externalAuth = NewExternalAuth(app);
            externalAuth.SetCollectionRef(user.collection().id);
            externalAuth.SetRecordRef("missing");
            externalAuth.SetProvider("gitlab");
            externalAuth.SetProviderId("test123");
            return externalAuth;
          },
          expectErrors: ["recordRef"],
        },
        {
          name: "valid ref",
          externalAuth: () => {
            const externalAuth = NewExternalAuth(app);
            externalAuth.SetCollectionRef(user.collection().id);
            externalAuth.SetRecordRef(user.Id);
            externalAuth.SetProvider("gitlab");
            externalAuth.SetProviderId("test123");
            return externalAuth;
          },
          expectErrors: [],
        },
      ];

      for (const scenario of scenarios) {
        const errs = app.Validate(scenario.externalAuth());
        testValidationErrors(errs, scenario.expectErrors);
      }
    } finally {
      await cleanup();
    }
  });
});
