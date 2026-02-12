// Ported from pocketbase/core/field_json_test.go

import { describe, expect, it } from "bun:test";
import { newUnbootstrappedTestApp } from "../tests/app.ts";
import { testValidationErrors } from "../tests/validation_errors.ts";
import { JSONRaw } from "../tools/types/index.ts";
import { NewBaseCollection } from "./collection_model.ts";
import { testDefaultFieldIdValidation, testDefaultFieldNameValidation, testFieldBaseMethods } from "./field.test.ts";
import { JSONField, FieldTypeJSON, DefaultJSONFieldMaxSize } from "./field_json.ts";
import { NewRecord } from "./record_model.ts";

describe("json field", () => {
  it("base methods", () => {
    testFieldBaseMethods(FieldTypeJSON);
  });

  it("column type", async () => {
    const { app, cleanup } = await newUnbootstrappedTestApp();
    try {
      const field = new JSONField();
      expect(field.ColumnType(app)).toBe("JSON DEFAULT NULL");
    } finally {
      await cleanup();
    }
  });

  it("prepare value", async () => {
    const { cleanup } = await newUnbootstrappedTestApp();
    try {
      const field = new JSONField();
      const record = NewRecord(NewBaseCollection("test"));

      const scenarios: Array<{ raw: unknown; expected: string }> = [
        { raw: "null", expected: "null" },
        { raw: "", expected: '""' },
        { raw: "true", expected: "true" },
        { raw: "false", expected: "false" },
        { raw: "test", expected: '"test"' },
        { raw: "123", expected: "123" },
        { raw: "-456", expected: "-456" },
        { raw: "[1,2,3]", expected: "[1,2,3]" },
        { raw: "[1,2,3", expected: '"[1,2,3"' },
        { raw: '{"a":1,"b":2}', expected: '{"a":1,"b":2}' },
        { raw: '{"a":1,"b":2', expected: '"{\\"a\\":1,\\"b\\":2"' },
        { raw: [1, 2, 3], expected: "[1,2,3]" },
        { raw: { a: 1, b: 2 }, expected: '{"a":1,"b":2}' },
        { raw: null, expected: "null" },
        { raw: false, expected: "false" },
        { raw: true, expected: "true" },
        { raw: -78, expected: "-78" },
        { raw: 123.456, expected: "123.456" },
      ];

      for (const scenario of scenarios) {
        const value = field.PrepareValue(record, scenario.raw);
        expect(value).toBeInstanceOf(JSONRaw);
        expect(value.String()).toBe(scenario.expected);
      }
    } finally {
      await cleanup();
    }
  });

  it("validate value", async () => {
    const { app, cleanup } = await newUnbootstrappedTestApp();
    try {
      const collection = NewBaseCollection("test_collection");

      const scenarios = [
        {
          name: "invalid raw value",
          field: Object.assign(new JSONField(), { Name: "test" }),
          setup: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", 123);
            return record;
          },
          expectError: true,
        },
        {
          name: "zero field value (not required)",
          field: Object.assign(new JSONField(), { Name: "test" }),
          setup: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", new JSONRaw());
            return record;
          },
          expectError: false,
        },
        {
          name: "zero field value (required)",
          field: Object.assign(new JSONField(), { Name: "test", Required: true }),
          setup: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", new JSONRaw());
            return record;
          },
          expectError: true,
        },
        {
          name: "non-zero field value (required)",
          field: Object.assign(new JSONField(), { Name: "test", Required: true }),
          setup: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", new JSONRaw("[1,2,3]"));
            return record;
          },
          expectError: false,
        },
        {
          name: "non-zero field value (required) string",
          field: Object.assign(new JSONField(), { Name: "test", Required: true }),
          setup: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", new JSONRaw('"aaa"'));
            return record;
          },
          expectError: false,
        },
        {
          name: "> default MaxSize",
          field: Object.assign(new JSONField(), { Name: "test" }),
          setup: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", new JSONRaw(`"${"a".repeat(1 << 20)}"`));
            return record;
          },
          expectError: true,
        },
        {
          name: "> MaxSize",
          field: Object.assign(new JSONField(), { Name: "test", MaxSize: 5 }),
          setup: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", new JSONRaw('"aaaa"'));
            return record;
          },
          expectError: true,
        },
        {
          name: "<= MaxSize",
          field: Object.assign(new JSONField(), { Name: "test", MaxSize: 5 }),
          setup: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", new JSONRaw('"aaa"'));
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
    await testDefaultFieldIdValidation(FieldTypeJSON);
    await testDefaultFieldNameValidation(FieldTypeJSON);

    const { app, cleanup } = await newUnbootstrappedTestApp();
    try {
      const collection = NewBaseCollection("test_collection");

      const scenarios = [
        {
          name: "MaxSize < 0",
          build: () => Object.assign(new JSONField(), { Id: "test", Name: "test", MaxSize: -1 }),
          expectErrors: ["maxSize"],
        },
        {
          name: "MaxSize = 0",
          build: () => Object.assign(new JSONField(), { Id: "test", Name: "test" }),
          expectErrors: [],
        },
        {
          name: "MaxSize > 0",
          build: () => Object.assign(new JSONField(), { Id: "test", Name: "test", MaxSize: 1 }),
          expectErrors: [],
        },
        {
          name: "MaxSize > safe json int",
          build: () => Object.assign(new JSONField(), { Id: "test", Name: "test", MaxSize: 2 ** 53 }),
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

  it("calculate max body size", async () => {
    const { cleanup } = await newUnbootstrappedTestApp();
    try {
      const scenarios = [
        { field: new JSONField(), expected: DefaultJSONFieldMaxSize },
        { field: Object.assign(new JSONField(), { MaxSize: 10 }), expected: 10 },
      ];

      for (const scenario of scenarios) {
        expect(scenario.field.CalculateMaxBodySize()).toBe(scenario.expected);
      }
    } finally {
      await cleanup();
    }
  });
});
