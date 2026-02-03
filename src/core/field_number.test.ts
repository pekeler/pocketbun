// Ported from pocketbase/core/field_number_test.go

import { describe, expect, it } from "bun:test";
import { newTestApp } from "../tests/app.ts";
import { testValidationErrors } from "../tests/validation_errors.ts";
import { Pointer } from "../tools/types/index.ts";
import { NewBaseCollection } from "./collection_model.ts";
import { testDefaultFieldIdValidation, testDefaultFieldNameValidation, testFieldBaseMethods } from "./field.test.ts";
import { NumberField, FieldTypeNumber } from "./field_number.ts";
import { NewRecord } from "./record_model.ts";

describe("number field", () => {
  it("base methods", () => {
    testFieldBaseMethods(FieldTypeNumber);
  });

  it("column type", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const field = new NumberField();
      expect(field.ColumnType(app)).toBe("NUMERIC DEFAULT 0 NOT NULL");
    } finally {
      await cleanup();
    }
  });

  it("prepare value", async () => {
    const { cleanup } = await newTestApp();
    try {
      const field = new NumberField();
      const record = NewRecord(NewBaseCollection("test"));

      const scenarios = [
        { raw: "", expected: 0 },
        { raw: "test", expected: 0 },
        { raw: false, expected: 0 },
        { raw: true, expected: 1 },
        { raw: -2, expected: -2 },
        { raw: 123.456, expected: 123.456 },
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
          field: Object.assign(new NumberField(), { Name: "test" }),
          record: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", "123");
            return record;
          },
          expectError: true,
        },
        {
          name: "zero field value (not required)",
          field: Object.assign(new NumberField(), { Name: "test" }),
          record: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", 0);
            return record;
          },
          expectError: false,
        },
        {
          name: "zero field value (required)",
          field: Object.assign(new NumberField(), { Name: "test", Required: true }),
          record: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", 0);
            return record;
          },
          expectError: true,
        },
        {
          name: "non-zero field value (required)",
          field: Object.assign(new NumberField(), { Name: "test", Required: true }),
          record: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", 123);
            return record;
          },
          expectError: false,
        },
        {
          name: "decimal with onlyInt",
          field: Object.assign(new NumberField(), { Name: "test", OnlyInt: true }),
          record: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", 123.456);
            return record;
          },
          expectError: true,
        },
        {
          name: "int with onlyInt",
          field: Object.assign(new NumberField(), { Name: "test", OnlyInt: true }),
          record: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", 123);
            return record;
          },
          expectError: false,
        },
        {
          name: "< min",
          field: Object.assign(new NumberField(), { Name: "test", Min: Pointer(2.0) }),
          record: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", 1);
            return record;
          },
          expectError: true,
        },
        {
          name: ">= min",
          field: Object.assign(new NumberField(), { Name: "test", Min: Pointer(2.0) }),
          record: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", 2);
            return record;
          },
          expectError: false,
        },
        {
          name: "> max",
          field: Object.assign(new NumberField(), { Name: "test", Max: Pointer(2.0) }),
          record: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", 3);
            return record;
          },
          expectError: true,
        },
        {
          name: "<= max",
          field: Object.assign(new NumberField(), { Name: "test", Max: Pointer(2.0) }),
          record: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", 2);
            return record;
          },
          expectError: false,
        },
        {
          name: "infinity",
          field: Object.assign(new NumberField(), { Name: "test" }),
          record: () => {
            const record = NewRecord(collection);
            record.Set("test", "Inf");
            return record;
          },
          expectError: true,
        },
        {
          name: "NaN",
          field: Object.assign(new NumberField(), { Name: "test" }),
          record: () => {
            const record = NewRecord(collection);
            record.Set("test", "NaN");
            return record;
          },
          expectError: true,
        },
      ];

      for (const scenario of scenarios) {
        const err = scenario.field.ValidateValue(null, app, scenario.record());
        expect(Boolean(err)).toBe(scenario.expectError);
      }
    } finally {
      await cleanup();
    }
  });

  it("validate settings", async () => {
    await testDefaultFieldIdValidation(FieldTypeNumber);
    await testDefaultFieldNameValidation(FieldTypeNumber);

    const { app, cleanup } = await newTestApp();
    try {
      const collection = NewBaseCollection("test_collection");
      const scenarios = [
        {
          name: "zero",
          build: () => Object.assign(new NumberField(), { Id: "test", Name: "test" }),
          expectErrors: [],
        },
        {
          name: "decimal min",
          build: () => Object.assign(new NumberField(), { Id: "test", Name: "test", Min: Pointer(1.2) }),
          expectErrors: [],
        },
        {
          name: "decimal min (onlyInt)",
          build: () =>
            Object.assign(new NumberField(), {
              Id: "test",
              Name: "test",
              OnlyInt: true,
              Min: Pointer(1.2),
            }),
          expectErrors: ["min"],
        },
        {
          name: "int min (onlyInt)",
          build: () =>
            Object.assign(new NumberField(), {
              Id: "test",
              Name: "test",
              OnlyInt: true,
              Min: Pointer(1.0),
            }),
          expectErrors: [],
        },
        {
          name: "decimal max",
          build: () => Object.assign(new NumberField(), { Id: "test", Name: "test", Max: Pointer(1.2) }),
          expectErrors: [],
        },
        {
          name: "decimal max (onlyInt)",
          build: () =>
            Object.assign(new NumberField(), {
              Id: "test",
              Name: "test",
              OnlyInt: true,
              Max: Pointer(1.2),
            }),
          expectErrors: ["max"],
        },
        {
          name: "int max (onlyInt)",
          build: () =>
            Object.assign(new NumberField(), {
              Id: "test",
              Name: "test",
              OnlyInt: true,
              Max: Pointer(1.0),
            }),
          expectErrors: [],
        },
        {
          name: "min > max",
          build: () =>
            Object.assign(new NumberField(), {
              Id: "test",
              Name: "test",
              Min: Pointer(2.0),
              Max: Pointer(1.0),
            }),
          expectErrors: ["max"],
        },
        {
          name: "min <= max",
          build: () =>
            Object.assign(new NumberField(), {
              Id: "test",
              Name: "test",
              Min: Pointer(2.0),
              Max: Pointer(2.0),
            }),
          expectErrors: [],
        },
      ];

      for (const scenario of scenarios) {
        const errs = scenario.build().ValidateSettings(null, app, collection);
        testValidationErrors(errs, scenario.expectErrors);
      }
    } finally {
      await cleanup();
    }
  });

  it("find setter", () => {
    const field = Object.assign(new NumberField(), { Name: "test" });

    const collection = NewBaseCollection("test_collection");
    collection.Fields.Add(field);

    const noMatch = field.FindSetter("abc");
    expect(noMatch).toBeNull();

    const setValue = field.FindSetter("test");
    expect(setValue).toBeTruthy();
    if (setValue) {
      const record = NewRecord(collection);
      record.SetRaw("test", 2);
      setValue(record, "123.456");
      expect(record.Get("test")).toBe(123.456);
    }

    const addValue = field.FindSetter("test+");
    expect(addValue).toBeTruthy();
    if (addValue) {
      const record = NewRecord(collection);
      record.SetRaw("test", 2);
      addValue(record, "1.5");
      expect(record.Get("test")).toBe(3.5);
    }

    const subtractValue = field.FindSetter("test-");
    expect(subtractValue).toBeTruthy();
    if (subtractValue) {
      const record = NewRecord(collection);
      record.SetRaw("test", 2);
      subtractValue(record, "1.5");
      expect(record.Get("test")).toBe(0.5);
    }
  });
});
