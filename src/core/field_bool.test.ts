// Ported from pocketbase/core/field_bool_test.go

import { describe, expect, it } from "bun:test";
import { newTestApp } from "../../tests/test_app.ts";
import { NewBaseCollection } from "./collection.ts";
import { BoolField, FieldTypeBool } from "./field_bool.ts";
import { testDefaultFieldIdValidation, testDefaultFieldNameValidation, testFieldBaseMethods } from "./field_test.ts";
import { NewRecord } from "./record.ts";

describe("bool field", () => {
  it("base methods", () => {
    testFieldBaseMethods(FieldTypeBool);
  });

  it("column type", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const field = new BoolField();
      expect(field.ColumnType(app)).toBe("BOOLEAN DEFAULT FALSE NOT NULL");
    } finally {
      await cleanup();
    }
  });

  it("prepare value", async () => {
    const { cleanup } = await newTestApp();
    try {
      const field = new BoolField();
      const record = NewRecord(NewBaseCollection("test"));

      const scenarios = [
        { raw: "", expected: false },
        { raw: "f", expected: false },
        { raw: "t", expected: true },
        { raw: 1, expected: true },
        { raw: 0, expected: false },
      ];

      for (const scenario of scenarios) {
        const value = field.PrepareValue(record, scenario.raw);
        expect(value).toBe(scenario.expected);
      }
    } finally {
      await cleanup();
    }
  });

  it("validate value", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const collection = NewBaseCollection("test_collection");

      const scenarios = [
        {
          name: "invalid raw value",
          field: Object.assign(new BoolField(), { Name: "test" }),
          setup: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", 123);
            return record;
          },
          expectError: true,
        },
        {
          name: "missing field value (non-required)",
          field: Object.assign(new BoolField(), { Name: "test" }),
          setup: () => {
            const record = NewRecord(collection);
            record.SetRaw("abc", true);
            return record;
          },
          expectError: true,
        },
        {
          name: "missing field value (required)",
          field: Object.assign(new BoolField(), { Required: true, Name: "test" }),
          setup: () => {
            const record = NewRecord(collection);
            record.SetRaw("abc", true);
            return record;
          },
          expectError: true,
        },
        {
          name: "false field value (non-required)",
          field: Object.assign(new BoolField(), { Name: "test" }),
          setup: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", false);
            return record;
          },
          expectError: false,
        },
        {
          name: "false field value (required)",
          field: Object.assign(new BoolField(), { Name: "test", Required: true }),
          setup: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", false);
            return record;
          },
          expectError: true,
        },
        {
          name: "true field value (required)",
          field: Object.assign(new BoolField(), { Name: "test", Required: true }),
          setup: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", true);
            return record;
          },
          expectError: false,
        },
      ];

      for (const scenario of scenarios) {
        const err = scenario.field.ValidateValue(null, app, scenario.setup());
        expect(Boolean(err)).toBe(scenario.expectError);
      }
    } finally {
      await cleanup();
    }
  });

  it("validate settings", async () => {
    await testDefaultFieldIdValidation(FieldTypeBool);
    await testDefaultFieldNameValidation(FieldTypeBool);
  });
});
