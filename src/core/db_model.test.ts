// Ported from pocketbase/core/db_model_test.go

import { describe, expect, it } from "bun:test";
import { BaseModel } from "./db_model.ts";

describe("BaseModel", () => {
  it("tracks new state and saved pk", () => {
    const id = "test_id";

    const model = new BaseModel();
    model.Id = id;

    expect(model.PK()).toBe(id);
    expect(model.LastSavedPK()).toBe("");
    expect(model.IsNew()).toBe(true);

    const postErr = model.PostScan();
    expect(postErr).toBeNull();

    expect(model.PK()).toBe(id);
    expect(model.LastSavedPK()).toBe(id);
    expect(model.IsNew()).toBe(false);

    model.MarkAsNew();

    expect(model.PK()).toBe(id);
    expect(model.LastSavedPK()).toBe("");
    expect(model.IsNew()).toBe(true);

    // mark as not new without id
    model.MarkAsNotNew();

    expect(model.PK()).toBe(id);
    expect(model.LastSavedPK()).toBe(id);
    expect(model.IsNew()).toBe(false);
  });
});
