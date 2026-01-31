// Ported from pocketbase/core/field_password_test.go

import { describe, expect, it } from "bun:test";
import { PasswordField, FieldTypePassword, PasswordFieldValue } from "./field_password.ts";
import { NewBaseCollection } from "./collection.ts";
import { NewRecord } from "./record.ts";
import { newTestApp } from "../../tests/test_app.ts";
import {
  testDefaultFieldIdValidation,
  testDefaultFieldNameValidation,
  testFieldBaseMethods,
} from "./field_test.ts";
import { testValidationErrors } from "../../tests/validation_errors.ts";

describe("password field", () => {
  it("base methods", () => {
    testFieldBaseMethods(FieldTypePassword);
  });

  it("column type", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const field = new PasswordField();
      expect(field.ColumnType(app)).toBe("TEXT DEFAULT '' NOT NULL");
    } finally {
      await cleanup();
    }
  });

  it("prepare value", async () => {
    const { cleanup } = await newTestApp();
    try {
      const field = new PasswordField();
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
        expect(value).toBeInstanceOf(PasswordFieldValue);
        expect(value.Hash).toBe(scenario.expected);
      }
    } finally {
      await cleanup();
    }
  });

  it("driver value", async () => {
    const { cleanup } = await newTestApp();
    try {
      const field = Object.assign(new PasswordField(), { Name: "test" });
      const err = new Error("example_err");

      const scenarios = [
        { raw: 123, expected: new PasswordFieldValue("") },
        { raw: "abc", expected: new PasswordFieldValue("") },
        { raw: "$2abc", expected: new PasswordFieldValue("", "$2abc") },
        {
          raw: Object.assign(new PasswordFieldValue("", "test"), { LastError: err }),
          expected: Object.assign(new PasswordFieldValue("", "test"), { LastError: err }),
        },
      ];

      for (const scenario of scenarios) {
        const record = NewRecord(NewBaseCollection("test"));
        record.SetRaw(field.GetName(), scenario.raw);

        const [value, valueErr] = field.DriverValue(record);
        expect(typeof value).toBe("string");

        const expectedErr = scenario.expected.LastError?.message ?? "";
        const actualErr = valueErr?.message ?? "";

        expect(value).toBe(scenario.expected.Hash);
        expect(actualErr).toBe(expectedErr);
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
          field: Object.assign(new PasswordField(), { Name: "test" }),
          setup: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", "123");
            return record;
          },
          expectError: true,
        },
        {
          name: "zero field value (not required)",
          field: Object.assign(new PasswordField(), { Name: "test" }),
          setup: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", new PasswordFieldValue(""));
            return record;
          },
          expectError: false,
        },
        {
          name: "zero field value (required)",
          field: Object.assign(new PasswordField(), { Name: "test", Required: true }),
          setup: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", new PasswordFieldValue(""));
            return record;
          },
          expectError: true,
        },
        {
          name: "empty hash but non-empty plain password (required)",
          field: Object.assign(new PasswordField(), { Name: "test", Required: true }),
          setup: () => {
            const record = NewRecord(collection);
            const value = new PasswordFieldValue("test");
            record.SetRaw("test", value);
            return record;
          },
          expectError: true,
        },
        {
          name: "non-empty hash (required)",
          field: Object.assign(new PasswordField(), { Name: "test", Required: true }),
          setup: () => {
            const record = NewRecord(collection);
            const value = new PasswordFieldValue("", "test");
            record.SetRaw("test", value);
            return record;
          },
          expectError: false,
        },
        {
          name: "with LastError",
          field: Object.assign(new PasswordField(), { Name: "test" }),
          setup: () => {
            const record = NewRecord(collection);
            const value = new PasswordFieldValue("", "test");
            value.LastError = new Error("test");
            record.SetRaw("test", value);
            return record;
          },
          expectError: true,
        },
        {
          name: "< Min",
          field: Object.assign(new PasswordField(), { Name: "test", Min: 3 }),
          setup: () => {
            const record = NewRecord(collection);
            const value = new PasswordFieldValue("аб");
            record.SetRaw("test", value);
            return record;
          },
          expectError: true,
        },
        {
          name: ">= Min",
          field: Object.assign(new PasswordField(), { Name: "test", Min: 3 }),
          setup: () => {
            const record = NewRecord(collection);
            const value = new PasswordFieldValue("абв");
            record.SetRaw("test", value);
            return record;
          },
          expectError: false,
        },
        {
          name: "> default Max",
          field: Object.assign(new PasswordField(), { Name: "test" }),
          setup: () => {
            const record = NewRecord(collection);
            const value = new PasswordFieldValue("a".repeat(72));
            record.SetRaw("test", value);
            return record;
          },
          expectError: true,
        },
        {
          name: "<= default Max",
          field: Object.assign(new PasswordField(), { Name: "test" }),
          setup: () => {
            const record = NewRecord(collection);
            const value = new PasswordFieldValue("a".repeat(71));
            record.SetRaw("test", value);
            return record;
          },
          expectError: false,
        },
        {
          name: "> Max",
          field: Object.assign(new PasswordField(), { Name: "test", Max: 2 }),
          setup: () => {
            const record = NewRecord(collection);
            const value = new PasswordFieldValue("абв");
            record.SetRaw("test", value);
            return record;
          },
          expectError: true,
        },
        {
          name: "<= Max",
          field: Object.assign(new PasswordField(), { Name: "test", Max: 2 }),
          setup: () => {
            const record = NewRecord(collection);
            const value = new PasswordFieldValue("аб");
            record.SetRaw("test", value);
            return record;
          },
          expectError: false,
        },
        {
          name: "non-matching pattern",
          field: Object.assign(new PasswordField(), { Name: "test", Pattern: "\\d+" }),
          setup: () => {
            const record = NewRecord(collection);
            const value = new PasswordFieldValue("abc");
            record.SetRaw("test", value);
            return record;
          },
          expectError: true,
        },
        {
          name: "matching pattern",
          field: Object.assign(new PasswordField(), { Name: "test", Pattern: "\\d+" }),
          setup: () => {
            const record = NewRecord(collection);
            const value = new PasswordFieldValue("123");
            record.SetRaw("test", value);
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
    await testDefaultFieldIdValidation(FieldTypePassword);
    await testDefaultFieldNameValidation(FieldTypePassword);

    const { app, cleanup } = await newTestApp();
    try {
      const scenarios = [
        {
          name: "zero minimal",
          build: () => Object.assign(new PasswordField(), { Id: "test", Name: "test" }),
          expectErrors: [],
        },
        {
          name: "invalid pattern",
          build: () =>
            Object.assign(new PasswordField(), { Id: "test", Name: "test", Pattern: "(invalid" }),
          expectErrors: ["pattern"],
        },
        {
          name: "valid pattern",
          build: () =>
            Object.assign(new PasswordField(), { Id: "test", Name: "test", Pattern: "\\d+" }),
          expectErrors: [],
        },
        {
          name: "Min < 0",
          build: () => Object.assign(new PasswordField(), { Id: "test", Name: "test", Min: -1 }),
          expectErrors: ["min"],
        },
        {
          name: "Min > 71",
          build: () => Object.assign(new PasswordField(), { Id: "test", Name: "test", Min: 72 }),
          expectErrors: ["min"],
        },
        {
          name: "valid Min",
          build: () => Object.assign(new PasswordField(), { Id: "test", Name: "test", Min: 5 }),
          expectErrors: [],
        },
        {
          name: "Max < Min",
          build: () =>
            Object.assign(new PasswordField(), { Id: "test", Name: "test", Min: 2, Max: 1 }),
          expectErrors: ["max"],
        },
        {
          name: "Min > Min",
          build: () =>
            Object.assign(new PasswordField(), { Id: "test", Name: "test", Min: 2, Max: 3 }),
          expectErrors: [],
        },
        {
          name: "Max > 71",
          build: () => Object.assign(new PasswordField(), { Id: "test", Name: "test", Max: 72 }),
          expectErrors: ["max"],
        },
        {
          name: "cost < bcrypt.MinCost",
          build: () => Object.assign(new PasswordField(), { Id: "test", Name: "test", Cost: 3 }),
          expectErrors: ["cost"],
        },
        {
          name: "cost > bcrypt.MaxCost",
          build: () => Object.assign(new PasswordField(), { Id: "test", Name: "test", Cost: 32 }),
          expectErrors: ["cost"],
        },
        {
          name: "valid cost",
          build: () => Object.assign(new PasswordField(), { Id: "test", Name: "test", Cost: 12 }),
          expectErrors: [],
        },
      ];

      for (const scenario of scenarios) {
        const collection = NewBaseCollection("test_collection");
        const idField = collection.Fields.GetByName("id");
        if (idField) {
          idField.SetId("test");
        }

        const field = scenario.build();
        collection.Fields.Add(field);

        const errs = field.ValidateSettings(null, app, collection);
        testValidationErrors(errs, scenario.expectErrors);
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
        field: Object.assign(new PasswordField(), { Name: "test" }),
        hasSetter: false,
        expected: "",
      },
      {
        name: "exact match",
        key: "test",
        value: "abc",
        field: Object.assign(new PasswordField(), { Name: "test" }),
        hasSetter: true,
        expected: '"abc"',
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
      record.SetRaw(scenario.field.GetName(), ["c", "d"]);

      setter(record, scenario.value);

      const raw = JSON.stringify(record.Get(scenario.field.GetName()));
      expect(raw).toBe(scenario.expected);
    }
  });

  it("find getter", () => {
    const scenarios = [
      {
        name: "no match",
        key: "example",
        field: Object.assign(new PasswordField(), { Name: "test" }),
        hasGetter: false,
        expected: "",
      },
      {
        name: "field name match",
        key: "test",
        field: Object.assign(new PasswordField(), { Name: "test" }),
        hasGetter: true,
        expected: "test_plain",
      },
      {
        name: "field name hash modifier",
        key: "test:hash",
        field: Object.assign(new PasswordField(), { Name: "test" }),
        hasGetter: true,
        expected: "test_hash",
      },
    ];

    for (const scenario of scenarios) {
      const collection = NewBaseCollection("test_collection");
      collection.Fields.Add(scenario.field);

      const getter = scenario.field.FindGetter(scenario.key);
      expect(Boolean(getter)).toBe(scenario.hasGetter);

      if (!getter) {
        continue;
      }

      const record = NewRecord(collection);
      record.SetRaw(
        scenario.field.GetName(),
        Object.assign(new PasswordFieldValue("", "test_hash"), { Plain: "test_plain" }),
      );

      const result = getter(record);
      expect(result).toBe(scenario.expected);
    }
  });
});
