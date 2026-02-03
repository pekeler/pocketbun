// Ported from pocketbase/core/field_text_test.go

import { describe, expect, it } from "bun:test";
import { newTestApp } from "../tests/app.ts";
import { testValidationErrors } from "../tests/validation_errors.ts";
import { NewBaseCollection } from "./collection_model.ts";
import { testDefaultFieldIdValidation, testDefaultFieldNameValidation, testFieldBaseMethods } from "./field.test.ts";
import { TextField, FieldTypeText, autogenerateModifier } from "./field_text.ts";
import { NewRecord } from "./record_model.ts";

describe("text field", () => {
  it("base methods", () => {
    testFieldBaseMethods(FieldTypeText);
  });

  it("column type", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const field = new TextField();
      expect(field.ColumnType(app)).toBe("TEXT DEFAULT '' NOT NULL");
    } finally {
      await cleanup();
    }
  });

  it("prepare value", async () => {
    const { cleanup } = await newTestApp();
    try {
      const field = new TextField();
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
      const collection = app.findCollectionByNameOrId("demo1");
      if (!collection) {
        throw new Error("Missing demo1 collection");
      }

      const existingRecord = app.findFirstRecordByFilter(collection, "id != ''");
      if (!existingRecord) {
        throw new Error("Missing demo1 record");
      }

      const scenarios = [
        {
          name: "invalid raw value",
          field: Object.assign(new TextField(), { Name: "test" }),
          setup: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", 123);
            return record;
          },
          expectError: true,
        },
        {
          name: "zero field value (not required)",
          field: Object.assign(new TextField(), {
            Name: "test",
            Pattern: "\\d+",
            Min: 10,
            Max: 100,
          }),
          setup: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", "");
            return record;
          },
          expectError: false,
        },
        {
          name: "zero field value (required)",
          field: Object.assign(new TextField(), { Name: "test", Required: true }),
          setup: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", "");
            return record;
          },
          expectError: true,
        },
        {
          name: "non-zero field value (required)",
          field: Object.assign(new TextField(), { Name: "test", Required: true }),
          setup: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", "abc");
            return record;
          },
          expectError: false,
        },
        {
          name: "special forbidden character / (non-primaryKey)",
          field: Object.assign(new TextField(), { Name: "test", PrimaryKey: false }),
          setup: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", "abc/");
            return record;
          },
          expectError: false,
        },
        {
          name: "special forbidden character \\\\ (non-primaryKey)",
          field: Object.assign(new TextField(), { Name: "test", PrimaryKey: false }),
          setup: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", "abc\\");
            return record;
          },
          expectError: false,
        },
        {
          name: "special forbidden character . (non-primaryKey)",
          field: Object.assign(new TextField(), { Name: "test", PrimaryKey: false }),
          setup: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", "abc.");
            return record;
          },
          expectError: false,
        },
        {
          name: "special forbidden character ' ' (non-primaryKey)",
          field: Object.assign(new TextField(), { Name: "test", PrimaryKey: false }),
          setup: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", "ab c");
            return record;
          },
          expectError: false,
        },
        {
          name: "special forbidden character * (non-primaryKey)",
          field: Object.assign(new TextField(), { Name: "test", PrimaryKey: false }),
          setup: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", "abc*");
            return record;
          },
          expectError: false,
        },
        {
          name: "special forbidden character / (primaryKey)",
          field: Object.assign(new TextField(), { Name: "test", PrimaryKey: true }),
          setup: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", "abc/");
            return record;
          },
          expectError: true,
        },
        {
          name: "special forbidden character \\\\ (primaryKey)",
          field: Object.assign(new TextField(), { Name: "test", PrimaryKey: true }),
          setup: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", "abc\\");
            return record;
          },
          expectError: true,
        },
        {
          name: "special forbidden character . (primaryKey)",
          field: Object.assign(new TextField(), { Name: "test", PrimaryKey: true }),
          setup: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", "abc.");
            return record;
          },
          expectError: true,
        },
        {
          name: "special forbidden character ' ' (primaryKey)",
          field: Object.assign(new TextField(), { Name: "test", PrimaryKey: true }),
          setup: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", "ab c");
            return record;
          },
          expectError: true,
        },
        {
          name: "special forbidden character * (primaryKey; used in the realtime events too)",
          field: Object.assign(new TextField(), { Name: "test", PrimaryKey: true }),
          setup: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", "abc*");
            return record;
          },
          expectError: true,
        },
        {
          name: "reserved pk literal (non-primaryKey)",
          field: Object.assign(new TextField(), { Name: "test", PrimaryKey: false }),
          setup: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", "aUx");
            return record;
          },
          expectError: false,
        },
        {
          name: "reserved pk literal (primaryKey)",
          field: Object.assign(new TextField(), { Name: "test", PrimaryKey: true }),
          setup: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", "aUx");
            return record;
          },
          expectError: true,
        },
        {
          name: "reserved pk literal (non-exact match, primaryKey)",
          field: Object.assign(new TextField(), { Name: "test", PrimaryKey: true }),
          setup: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", "aUx-");
            return record;
          },
          expectError: false,
        },
        {
          name: "zero field value (primaryKey)",
          field: Object.assign(new TextField(), { Name: "test", PrimaryKey: true }),
          setup: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", "");
            return record;
          },
          expectError: true,
        },
        {
          name: "non-zero field value (primaryKey)",
          field: Object.assign(new TextField(), { Name: "test", PrimaryKey: true }),
          setup: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", "abcd");
            return record;
          },
          expectError: false,
        },
        {
          name: "case-insensitive duplicated primary key check",
          field: Object.assign(new TextField(), { Name: "test", PrimaryKey: true }),
          setup: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", existingRecord.Id.toUpperCase());
            return record;
          },
          expectError: true,
        },
        {
          name: "< min",
          field: Object.assign(new TextField(), { Name: "test", Min: 4 }),
          setup: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", "абв");
            return record;
          },
          expectError: true,
        },
        {
          name: ">= min",
          field: Object.assign(new TextField(), { Name: "test", Min: 3 }),
          setup: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", "абв");
            return record;
          },
          expectError: false,
        },
        {
          name: "> default max",
          field: Object.assign(new TextField(), { Name: "test" }),
          setup: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", "a".repeat(5001));
            return record;
          },
          expectError: true,
        },
        {
          name: "<= default max",
          field: Object.assign(new TextField(), { Name: "test" }),
          setup: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", "a".repeat(500));
            return record;
          },
          expectError: false,
        },
        {
          name: "> max",
          field: Object.assign(new TextField(), { Name: "test", Max: 2 }),
          setup: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", "абв");
            return record;
          },
          expectError: true,
        },
        {
          name: "<= max",
          field: Object.assign(new TextField(), { Name: "test", Min: 3 }),
          setup: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", "абв");
            return record;
          },
          expectError: false,
        },
        {
          name: "mismatched pattern",
          field: Object.assign(new TextField(), { Name: "test", Pattern: "\\d+" }),
          setup: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", "abc");
            return record;
          },
          expectError: true,
        },
        {
          name: "matched pattern",
          field: Object.assign(new TextField(), { Name: "test", Pattern: "\\d+" }),
          setup: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", "123");
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
    await testDefaultFieldIdValidation(FieldTypeText);
    await testDefaultFieldNameValidation(FieldTypeText);

    const { app, cleanup } = await newTestApp();
    try {
      const scenarios = [
        {
          name: "zero minimal",
          build: () => Object.assign(new TextField(), { Id: "test", Name: "test" }),
          expectErrors: [],
        },
        {
          name: "primaryKey without required",
          build: () =>
            Object.assign(new TextField(), {
              Id: "test",
              Name: "id",
              PrimaryKey: true,
              Pattern: "\\d+",
            }),
          expectErrors: ["required"],
        },
        {
          name: "primaryKey without pattern",
          build: () =>
            Object.assign(new TextField(), {
              Id: "test",
              Name: "id",
              PrimaryKey: true,
              Required: true,
            }),
          expectErrors: ["pattern"],
        },
        {
          name: "primaryKey with hidden",
          build: () =>
            Object.assign(new TextField(), {
              Id: "test",
              Name: "id",
              Required: true,
              PrimaryKey: true,
              Hidden: true,
              Pattern: "\\d+",
            }),
          expectErrors: ["hidden"],
        },
        {
          name: "primaryKey with name != id",
          build: () =>
            Object.assign(new TextField(), {
              Id: "test",
              Name: "test",
              PrimaryKey: true,
              Required: true,
              Pattern: "\\d+",
            }),
          expectErrors: ["name"],
        },
        {
          name: "multiple primaryKey fields",
          build: () =>
            Object.assign(new TextField(), {
              Id: "test2",
              Name: "id",
              PrimaryKey: true,
              Pattern: "\\d+",
              Required: true,
            }),
          expectErrors: ["primaryKey"],
        },
        {
          name: "invalid pattern",
          build: () => Object.assign(new TextField(), { Id: "test2", Name: "id", Pattern: "(invalid" }),
          expectErrors: ["pattern"],
        },
        {
          name: "valid pattern",
          build: () => Object.assign(new TextField(), { Id: "test2", Name: "id", Pattern: "\\d+" }),
          expectErrors: [],
        },
        {
          name: "invalid autogeneratePattern",
          build: () =>
            Object.assign(new TextField(), {
              Id: "test2",
              Name: "id",
              AutogeneratePattern: "(invalid",
            }),
          expectErrors: ["autogeneratePattern"],
        },
        {
          name: "valid autogeneratePattern",
          build: () =>
            Object.assign(new TextField(), {
              Id: "test2",
              Name: "id",
              AutogeneratePattern: "[a-z]+",
            }),
          expectErrors: [],
        },
        {
          name: "conflicting pattern and autogeneratePattern",
          build: () =>
            Object.assign(new TextField(), {
              Id: "test2",
              Name: "id",
              Pattern: "\\d+",
              AutogeneratePattern: "[a-z]+",
            }),
          expectErrors: ["autogeneratePattern"],
        },
        {
          name: "Max > safe json int",
          build: () => Object.assign(new TextField(), { Id: "test", Name: "test", Max: 2 ** 53 }),
          expectErrors: ["max"],
        },
        {
          name: "Max < 0",
          build: () => Object.assign(new TextField(), { Id: "test", Name: "test", Max: -1 }),
          expectErrors: ["max"],
        },
        {
          name: "Min > safe json int",
          build: () => Object.assign(new TextField(), { Id: "test", Name: "test", Min: 2 ** 53 }),
          expectErrors: ["min"],
        },
        {
          name: "Min < 0",
          build: () => Object.assign(new TextField(), { Id: "test", Name: "test", Min: -1 }),
          expectErrors: ["min"],
        },
      ];

      for (const scenario of scenarios) {
        const field = scenario.build();
        const collection = NewBaseCollection("test_collection");
        const idField = collection.Fields.GetByName("id");
        if (idField) {
          idField.SetId("test");
        }
        collection.Fields.Add(field);

        const errs = field.ValidateSettings(null, app, collection);
        testValidationErrors(errs, scenario.expectErrors);
      }
    } finally {
      await cleanup();
    }
  });

  it("autogenerate", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const collection = NewBaseCollection("test_collection");

      const scenarios = [
        {
          name: "non-matching action",
          actionName: "update",
          field: Object.assign(new TextField(), { Name: "test", AutogeneratePattern: "abc" }),
          build: () => NewRecord(collection),
          expected: "",
        },
        {
          name: "matching action (create)",
          actionName: "create",
          field: Object.assign(new TextField(), { Name: "test", AutogeneratePattern: "abc" }),
          build: () => NewRecord(collection),
          expected: "abc",
        },
        {
          name: "matching action (validate)",
          actionName: "validate",
          field: Object.assign(new TextField(), { Name: "test", AutogeneratePattern: "abc" }),
          build: () => NewRecord(collection),
          expected: "abc",
        },
        {
          name: "existing non-zero value",
          actionName: "create",
          field: Object.assign(new TextField(), { Name: "test", AutogeneratePattern: "abc" }),
          build: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", "123");
            return record;
          },
          expected: "123",
        },
        {
          name: "non-new record",
          actionName: "validate",
          field: Object.assign(new TextField(), { Name: "test", AutogeneratePattern: "abc" }),
          build: () => {
            const record = NewRecord(collection);
            record.Id = "test";
            record.PostScan();
            return record;
          },
          expected: "",
        },
      ];

      for (const scenario of scenarios) {
        let actionCalls = 0;
        const record = scenario.build();

        const err = scenario.field.Intercept(null, app, record, scenario.actionName, () => {
          actionCalls += 1;
          return null;
        });
        if (err) {
          throw err;
        }

        expect(actionCalls).toBe(1);
        expect(record.GetString(scenario.field.GetName())).toBe(scenario.expected);
      }
    } finally {
      await cleanup();
    }
  });

  it("find setter", () => {
    const scenarios = [
      {
        name: "no match",
        key: "example",
        value: "abc",
        field: Object.assign(new TextField(), { Name: "test", AutogeneratePattern: "test" }),
        hasSetter: false,
        expected: "",
      },
      {
        name: "exact match",
        key: "test",
        value: "abc",
        field: Object.assign(new TextField(), { Name: "test", AutogeneratePattern: "test" }),
        hasSetter: true,
        expected: "abc",
      },
      {
        name: "autogenerate modifier",
        key: `test${autogenerateModifier}`,
        value: "abc",
        field: Object.assign(new TextField(), { Name: "test", AutogeneratePattern: "test" }),
        hasSetter: true,
        expected: "abctest",
      },
      {
        name: "autogenerate modifier without AutogeneratePattern option",
        key: `test${autogenerateModifier}`,
        value: "abc",
        field: Object.assign(new TextField(), { Name: "test" }),
        hasSetter: true,
        expected: "abc",
      },
    ];

    for (const scenario of scenarios) {
      const collection = NewBaseCollection("test_collection");
      collection.Fields.Add(scenario.field);

      const setter = scenario.field.FindSetter(scenario.key);
      expect(Boolean(setter)).toBe(scenario.hasSetter);

      if (!setter) {
        continue;
      }

      const record = NewRecord(collection);
      setter(record, scenario.value);
      expect(record.GetString(scenario.field.Name)).toBe(scenario.expected);
    }
  });
});
