// Ported from pocketbase/core/field_select_test.go

import { describe, expect, it } from "bun:test";
import { newTestApp } from "../../tests/test_app.ts";
import { testValidationErrors } from "../../tests/validation_errors.ts";
import { JSONArray } from "../tools/types/index.ts";
import { NewBaseCollection } from "./collection.ts";
import { SelectField, FieldTypeSelect } from "./field_select.ts";
import { testDefaultFieldIdValidation, testDefaultFieldNameValidation, testFieldBaseMethods } from "./field_test.ts";
import { NewRecord } from "./record.ts";

describe("select field", () => {
  it("base methods", () => {
    testFieldBaseMethods(FieldTypeSelect);
  });

  it("column type", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const scenarios = [
        { name: "single (zero)", field: new SelectField(), expected: "TEXT DEFAULT '' NOT NULL" },
        {
          name: "single",
          field: Object.assign(new SelectField(), { MaxSelect: 1 }),
          expected: "TEXT DEFAULT '' NOT NULL",
        },
        {
          name: "multiple",
          field: Object.assign(new SelectField(), { MaxSelect: 2 }),
          expected: "JSON DEFAULT '[]' NOT NULL",
        },
      ];

      for (const scenario of scenarios) {
        expect(scenario.field.ColumnType(app), scenario.name).toBe(scenario.expected);
      }
    } finally {
      await cleanup();
    }
  });

  it("is multiple", () => {
    const scenarios = [
      { name: "single (zero)", field: new SelectField(), expected: false },
      {
        name: "single",
        field: Object.assign(new SelectField(), { MaxSelect: 1 }),
        expected: false,
      },
      {
        name: "multiple (>1)",
        field: Object.assign(new SelectField(), { MaxSelect: 2 }),
        expected: true,
      },
    ];

    for (const scenario of scenarios) {
      expect(scenario.field.IsMultiple(), scenario.name).toBe(scenario.expected);
    }
  });

  it("prepare value", async () => {
    const { cleanup } = await newTestApp();
    try {
      const record = NewRecord(NewBaseCollection("test"));
      const scenarios = [
        { raw: null, field: new SelectField(), expected: `""` },
        { raw: "", field: new SelectField(), expected: `""` },
        { raw: 123, field: new SelectField(), expected: `"123"` },
        { raw: "a", field: new SelectField(), expected: `"a"` },
        { raw: `["a"]`, field: new SelectField(), expected: `"a"` },
        { raw: [], field: new SelectField(), expected: `""` },
        { raw: ["a", "b"], field: new SelectField(), expected: `"b"` },
        { raw: null, field: Object.assign(new SelectField(), { MaxSelect: 2 }), expected: `[]` },
        { raw: "", field: Object.assign(new SelectField(), { MaxSelect: 2 }), expected: `[]` },
        {
          raw: 123,
          field: Object.assign(new SelectField(), { MaxSelect: 2 }),
          expected: `["123"]`,
        },
        { raw: "a", field: Object.assign(new SelectField(), { MaxSelect: 2 }), expected: `["a"]` },
        {
          raw: `["a"]`,
          field: Object.assign(new SelectField(), { MaxSelect: 2 }),
          expected: `["a"]`,
        },
        { raw: [], field: Object.assign(new SelectField(), { MaxSelect: 2 }), expected: `[]` },
        {
          raw: ["a", "b", "c"],
          field: Object.assign(new SelectField(), { MaxSelect: 2 }),
          expected: `["a","b","c"]`,
        },
      ];

      for (const [index, scenario] of scenarios.entries()) {
        const value = scenario.field.PrepareValue(record, scenario.raw);
        expect(JSON.stringify(value), `scenario ${index}`).toBe(scenario.expected);
      }
    } finally {
      await cleanup();
    }
  });

  it("driver value", async () => {
    const { cleanup } = await newTestApp();
    try {
      const scenarios = [
        { raw: null, field: new SelectField(), expected: `""` },
        { raw: "", field: new SelectField(), expected: `""` },
        { raw: 123, field: new SelectField(), expected: `"123"` },
        { raw: "a", field: new SelectField(), expected: `"a"` },
        { raw: `["a"]`, field: new SelectField(), expected: `"a"` },
        { raw: [], field: new SelectField(), expected: `""` },
        { raw: ["a", "b"], field: new SelectField(), expected: `"b"` },
        { raw: null, field: Object.assign(new SelectField(), { MaxSelect: 2 }), expected: `[]` },
        { raw: "", field: Object.assign(new SelectField(), { MaxSelect: 2 }), expected: `[]` },
        {
          raw: 123,
          field: Object.assign(new SelectField(), { MaxSelect: 2 }),
          expected: `["123"]`,
        },
        { raw: "a", field: Object.assign(new SelectField(), { MaxSelect: 2 }), expected: `["a"]` },
        {
          raw: `["a"]`,
          field: Object.assign(new SelectField(), { MaxSelect: 2 }),
          expected: `["a"]`,
        },
        { raw: [], field: Object.assign(new SelectField(), { MaxSelect: 2 }), expected: `[]` },
        {
          raw: ["a", "b", "c"],
          field: Object.assign(new SelectField(), { MaxSelect: 2 }),
          expected: `["a","b","c"]`,
        },
      ];

      for (const [index, scenario] of scenarios.entries()) {
        const record = NewRecord(NewBaseCollection("test"));
        record.SetRaw(scenario.field.GetName(), scenario.raw);
        const [value, err] = scenario.field.DriverValue(record);
        expect(err, `scenario ${index}`).toBeNull();

        if (scenario.field.IsMultiple()) {
          expect(value instanceof JSONArray, `scenario ${index}`).toBe(true);
        } else {
          expect(typeof value === "string", `scenario ${index}`).toBe(true);
        }

        expect(JSON.stringify(value), `scenario ${index}`).toBe(scenario.expected);
      }
    } finally {
      await cleanup();
    }
  });

  it("validate value", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const collection = NewBaseCollection("test_collection");
      const values = ["a", "b", "c"];

      const scenarios = [
        {
          name: "[single] zero field value (not required)",
          field: Object.assign(new SelectField(), { Name: "test", Values: values, MaxSelect: 1 }),
          record: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", "");
            return record;
          },
          expectError: false,
        },
        {
          name: "[single] zero field value (required)",
          field: Object.assign(new SelectField(), {
            Name: "test",
            Values: values,
            MaxSelect: 1,
            Required: true,
          }),
          record: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", "");
            return record;
          },
          expectError: true,
        },
        {
          name: "[single] unknown value",
          field: Object.assign(new SelectField(), { Name: "test", Values: values, MaxSelect: 1 }),
          record: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", "unknown");
            return record;
          },
          expectError: true,
        },
        {
          name: "[single] known value",
          field: Object.assign(new SelectField(), { Name: "test", Values: values, MaxSelect: 1 }),
          record: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", "a");
            return record;
          },
          expectError: false,
        },
        {
          name: "[single] > MaxSelect",
          field: Object.assign(new SelectField(), { Name: "test", Values: values, MaxSelect: 1 }),
          record: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", ["a", "b"]);
            return record;
          },
          expectError: true,
        },
        {
          name: "[multiple] zero field value (not required)",
          field: Object.assign(new SelectField(), { Name: "test", Values: values, MaxSelect: 2 }),
          record: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", []);
            return record;
          },
          expectError: false,
        },
        {
          name: "[multiple] zero field value (required)",
          field: Object.assign(new SelectField(), {
            Name: "test",
            Values: values,
            MaxSelect: 2,
            Required: true,
          }),
          record: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", []);
            return record;
          },
          expectError: true,
        },
        {
          name: "[multiple] unknown value",
          field: Object.assign(new SelectField(), { Name: "test", Values: values, MaxSelect: 2 }),
          record: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", ["a", "unknown"]);
            return record;
          },
          expectError: true,
        },
        {
          name: "[multiple] known value",
          field: Object.assign(new SelectField(), { Name: "test", Values: values, MaxSelect: 2 }),
          record: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", ["a", "b"]);
            return record;
          },
          expectError: false,
        },
        {
          name: "[multiple] > MaxSelect",
          field: Object.assign(new SelectField(), { Name: "test", Values: values, MaxSelect: 2 }),
          record: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", ["a", "b", "c"]);
            return record;
          },
          expectError: true,
        },
        {
          name: "[multiple] > MaxSelect (duplicated values)",
          field: Object.assign(new SelectField(), { Name: "test", Values: values, MaxSelect: 2 }),
          record: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", ["a", "b", "b", "a"]);
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
    await testDefaultFieldIdValidation(FieldTypeSelect);
    await testDefaultFieldNameValidation(FieldTypeSelect);

    const { app, cleanup } = await newTestApp();
    try {
      const scenarios = [
        {
          name: "zero minimal",
          build: () => Object.assign(new SelectField(), { Id: "test", Name: "test" }),
          expectErrors: ["values"],
        },
        {
          name: "MaxSelect > Values length",
          build: () =>
            Object.assign(new SelectField(), {
              Id: "test",
              Name: "test",
              Values: ["a", "b"],
              MaxSelect: 3,
            }),
          expectErrors: ["maxSelect"],
        },
        {
          name: "MaxSelect <= Values length",
          build: () =>
            Object.assign(new SelectField(), {
              Id: "test",
              Name: "test",
              Values: ["a", "b"],
              MaxSelect: 2,
            }),
          expectErrors: [],
        },
      ];

      for (const scenario of scenarios) {
        const field = scenario.build();
        const collection = NewBaseCollection("test_collection");
        collection.Fields.Add(field);
        const errs = field.ValidateSettings(null, app, collection);
        testValidationErrors(errs, scenario.expectErrors);
      }
    } finally {
      await cleanup();
    }
  });

  it("find setter", () => {
    const values = ["a", "b", "c", "d"];
    const scenarios = [
      {
        name: "no match",
        key: "example",
        value: "b",
        field: Object.assign(new SelectField(), { Name: "test", MaxSelect: 1, Values: values }),
        hasSetter: false,
        expected: "",
      },
      {
        name: "exact match (single)",
        key: "test",
        value: "b",
        field: Object.assign(new SelectField(), { Name: "test", MaxSelect: 1, Values: values }),
        hasSetter: true,
        expected: `"b"`,
      },
      {
        name: "exact match (multiple)",
        key: "test",
        value: ["a", "b"],
        field: Object.assign(new SelectField(), { Name: "test", MaxSelect: 2, Values: values }),
        hasSetter: true,
        expected: `["a","b"]`,
      },
      {
        name: "append (single)",
        key: "test+",
        value: "b",
        field: Object.assign(new SelectField(), { Name: "test", MaxSelect: 1, Values: values }),
        hasSetter: true,
        expected: `"b"`,
      },
      {
        name: "append (multiple)",
        key: "test+",
        value: ["a"],
        field: Object.assign(new SelectField(), { Name: "test", MaxSelect: 2, Values: values }),
        hasSetter: true,
        expected: `["c","d","a"]`,
      },
      {
        name: "prepend (single)",
        key: "+test",
        value: "b",
        field: Object.assign(new SelectField(), { Name: "test", MaxSelect: 1, Values: values }),
        hasSetter: true,
        expected: `"d"`,
      },
      {
        name: "prepend (multiple)",
        key: "+test",
        value: ["a"],
        field: Object.assign(new SelectField(), { Name: "test", MaxSelect: 2, Values: values }),
        hasSetter: true,
        expected: `["a","c","d"]`,
      },
      {
        name: "subtract (single)",
        key: "test-",
        value: "d",
        field: Object.assign(new SelectField(), { Name: "test", MaxSelect: 1, Values: values }),
        hasSetter: true,
        expected: `"c"`,
      },
      {
        name: "subtract (multiple)",
        key: "test-",
        value: ["unknown", "c"],
        field: Object.assign(new SelectField(), { Name: "test", MaxSelect: 2, Values: values }),
        hasSetter: true,
        expected: `["d"]`,
      },
    ];

    for (const scenario of scenarios) {
      const collection = NewBaseCollection("test_collection");
      collection.Fields.Add(scenario.field);
      const setter = scenario.field.FindSetter(scenario.key);
      const hasSetter = setter !== null;
      expect(hasSetter, scenario.name).toBe(scenario.hasSetter);
      if (!setter) {
        continue;
      }
      const record = NewRecord(collection);
      record.SetRaw(scenario.field.GetName(), ["c", "d"]);
      setter(record, scenario.value);
      expect(JSON.stringify(record.Get(scenario.field.GetName())), scenario.name).toBe(scenario.expected);
    }
  });
});
