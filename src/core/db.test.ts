// Ported from pocketbase/core/db_test.go.

import { describe, expect, it } from "bun:test";
import { newTestApp } from "../tests/app.ts";
import { CollectionNameSuperusers } from "./collection_model.ts";
import { GenerateDefaultRandomId } from "./db.ts";
import { BaseModel } from "./db_model.ts";

class MockSuperusers extends BaseModel {
  TableName(): string {
    return CollectionNameSuperusers;
  }
}

describe("db helpers", () => {
  it("GenerateDefaultRandomId", () => {
    const id1 = GenerateDefaultRandomId();
    const id2 = GenerateDefaultRandomId();

    expect(id1).not.toBe(id2);
    expect(id1.length).toBe(15);
    expect(id2.length).toBe(15);
  });

  it("ModelQuery builds expected SQL", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const modelsQuery = app.ModelQuery({ TableName: () => "_collections" });
      const auxModelsQuery = app.AuxModelQuery({ TableName: () => "_collections" });

      const expected = "select {{_collections}}.* from {{_collections}}";
      expect(modelsQuery.Build().SQL().toLowerCase()).toBe(expected);
      expect(auxModelsQuery.Build().SQL().toLowerCase()).toBe(expected);
    } finally {
      await cleanup();
    }
  });

  it("Validate respects OnModelValidate hooks", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const model = new MockSuperusers();
      const testErr = new Error("test");

      app.OnModelValidate().BindFunc(() => testErr);

      const err = await app.Validate(model);
      expect(err).toBe(testErr);
    } finally {
      await cleanup();
    }
  });

  it("ValidateWithContext exposes the context on the event", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const model = new MockSuperusers();
      const testErr = new Error("test");
      const ctx = { test: 123 };

      app.OnModelValidate().BindFunc((event) => {
        expect((event.Context as { test?: number }).test).toBe(123);
        return testErr;
      });

      const err = await app.ValidateWithContext(ctx, model);
      expect(err).toBe(testErr);
    } finally {
      await cleanup();
    }
  });
});
