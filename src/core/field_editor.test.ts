// Ported from pocketbase/core/field_editor_test.go

import { describe, expect, it } from "bun:test";
import { newTestApp } from "../../tests/test_app.ts";
import { testValidationErrors } from "../../tests/validation_errors.ts";
import { NewBaseCollection } from "./collection.ts";
import { EditorField, FieldTypeEditor, DefaultEditorFieldMaxSize } from "./field_editor.ts";
import { testDefaultFieldIdValidation, testDefaultFieldNameValidation, testFieldBaseMethods } from "./field_test.ts";
import { NewRecord } from "./record.ts";

describe("editor field", () => {
  it("base methods", () => {
    testFieldBaseMethods(FieldTypeEditor);
  });

  it("column type", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const field = new EditorField();
      expect(field.ColumnType(app)).toBe("TEXT DEFAULT '' NOT NULL");
    } finally {
      await cleanup();
    }
  });

  it("prepare value", async () => {
    const { cleanup } = await newTestApp();
    try {
      const field = new EditorField();
      const record = NewRecord(NewBaseCollection("test"));

      const scenarios = [
        { raw: "", expected: "" },
        { raw: "test", expected: "test" },
        { raw: false, expected: "false" },
        { raw: true, expected: "true" },
        { raw: 123.456, expected: "123.456" },
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
          field: Object.assign(new EditorField(), { Name: "test" }),
          record: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", 123);
            return record;
          },
          expectError: true,
        },
        {
          name: "zero field value (not required)",
          field: Object.assign(new EditorField(), { Name: "test" }),
          record: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", "");
            return record;
          },
          expectError: false,
        },
        {
          name: "zero field value (required)",
          field: Object.assign(new EditorField(), { Name: "test", Required: true }),
          record: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", "");
            return record;
          },
          expectError: true,
        },
        {
          name: "non-zero field value (required)",
          field: Object.assign(new EditorField(), { Name: "test", Required: true }),
          record: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", "abc");
            return record;
          },
          expectError: false,
        },
        {
          name: "> default MaxSize",
          field: Object.assign(new EditorField(), { Name: "test", Required: true }),
          record: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", "a".repeat(1 + (5 << 20)));
            return record;
          },
          expectError: true,
        },
        {
          name: "> MaxSize",
          field: Object.assign(new EditorField(), { Name: "test", Required: true, MaxSize: 5 }),
          record: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", "abcdef");
            return record;
          },
          expectError: true,
        },
        {
          name: "<= MaxSize",
          field: Object.assign(new EditorField(), { Name: "test", Required: true, MaxSize: 5 }),
          record: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", "abcde");
            return record;
          },
          expectError: false,
        },
      ];

      for (const scenario of scenarios) {
        const err = scenario.field.ValidateValue(null, app, scenario.record());
        expect(Boolean(err), scenario.name).toBe(scenario.expectError);
      }
    } finally {
      await cleanup();
    }
  });

  it("validate settings", async () => {
    await testDefaultFieldIdValidation(FieldTypeEditor);
    await testDefaultFieldNameValidation(FieldTypeEditor);

    const { app, cleanup } = await newTestApp();
    try {
      const collection = NewBaseCollection("test_collection");
      const scenarios = [
        {
          name: "< 0 MaxSize",
          build: () => Object.assign(new EditorField(), { Id: "test", Name: "test", MaxSize: -1 }),
          expectErrors: ["maxSize"],
        },
        {
          name: "= 0 MaxSize",
          build: () => Object.assign(new EditorField(), { Id: "test", Name: "test" }),
          expectErrors: [],
        },
        {
          name: "> 0 MaxSize",
          build: () => Object.assign(new EditorField(), { Id: "test", Name: "test", MaxSize: 1 }),
          expectErrors: [],
        },
        {
          name: "MaxSize > safe json int",
          build: () => Object.assign(new EditorField(), { Id: "test", Name: "test", MaxSize: 2 ** 53 }),
          expectErrors: ["maxSize"],
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

  it("calculate max body size", () => {
    const scenarios = [
      { field: new EditorField(), expected: DefaultEditorFieldMaxSize },
      { field: Object.assign(new EditorField(), { MaxSize: 10 }), expected: 10 },
    ];

    for (const scenario of scenarios) {
      expect(scenario.field.CalculateMaxBodySize()).toBe(scenario.expected);
    }
  });
});
