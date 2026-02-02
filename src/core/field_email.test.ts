// Ported from pocketbase/core/field_email_test.go

import { describe, expect, it } from "bun:test";
import { newTestApp } from "../tests/app.ts";
import { testValidationErrors } from "../tests/validation_errors.ts";
import { NewBaseCollection } from "./collection.ts";
import { EmailField, FieldTypeEmail } from "./field_email.ts";
import { testDefaultFieldIdValidation, testDefaultFieldNameValidation, testFieldBaseMethods } from "./field_test.ts";
import { NewRecord } from "./record.ts";

describe("email field", () => {
  it("base methods", () => {
    testFieldBaseMethods(FieldTypeEmail);
  });

  it("column type", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const field = new EmailField();
      expect(field.ColumnType(app)).toBe("TEXT DEFAULT '' NOT NULL");
    } finally {
      await cleanup();
    }
  });

  it("prepare value", async () => {
    const { cleanup } = await newTestApp();
    try {
      const field = new EmailField();
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
          field: Object.assign(new EmailField(), { Name: "test" }),
          setup: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", 123);
            return record;
          },
          expectError: true,
        },
        {
          name: "zero field value (not required)",
          field: Object.assign(new EmailField(), { Name: "test" }),
          setup: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", "");
            return record;
          },
          expectError: false,
        },
        {
          name: "zero field value (required)",
          field: Object.assign(new EmailField(), { Name: "test", Required: true }),
          setup: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", "");
            return record;
          },
          expectError: true,
        },
        {
          name: "non-zero field value (required)",
          field: Object.assign(new EmailField(), { Name: "test", Required: true }),
          setup: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", "test@example.com");
            return record;
          },
          expectError: false,
        },
        {
          name: "invalid email",
          field: Object.assign(new EmailField(), { Name: "test" }),
          setup: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", "invalid");
            return record;
          },
          expectError: true,
        },
        {
          name: "failed onlyDomains",
          field: Object.assign(new EmailField(), {
            Name: "test",
            OnlyDomains: ["example.org", "example.net"],
          }),
          setup: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", "test@example.com");
            return record;
          },
          expectError: true,
        },
        {
          name: "success onlyDomains",
          field: Object.assign(new EmailField(), {
            Name: "test",
            OnlyDomains: ["example.org", "example.com"],
          }),
          setup: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", "test@example.com");
            return record;
          },
          expectError: false,
        },
        {
          name: "failed exceptDomains",
          field: Object.assign(new EmailField(), {
            Name: "test",
            ExceptDomains: ["example.org", "example.com"],
          }),
          setup: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", "test@example.com");
            return record;
          },
          expectError: true,
        },
        {
          name: "success exceptDomains",
          field: Object.assign(new EmailField(), {
            Name: "test",
            ExceptDomains: ["example.org", "example.net"],
          }),
          setup: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", "test@example.com");
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
    await testDefaultFieldIdValidation(FieldTypeEmail);
    await testDefaultFieldNameValidation(FieldTypeEmail);

    const { app, cleanup } = await newTestApp();
    try {
      const collection = NewBaseCollection("test_collection");

      const scenarios = [
        {
          name: "zero minimal",
          build: () => Object.assign(new EmailField(), { Id: "test", Name: "test" }),
          expectErrors: [],
        },
        {
          name: "both onlyDomains and exceptDomains",
          build: () =>
            Object.assign(new EmailField(), {
              Id: "test",
              Name: "test",
              OnlyDomains: ["example.com"],
              ExceptDomains: ["example.org"],
            }),
          expectErrors: ["onlyDomains", "exceptDomains"],
        },
        {
          name: "invalid onlyDomains",
          build: () =>
            Object.assign(new EmailField(), {
              Id: "test",
              Name: "test",
              OnlyDomains: ["example.com", "invalid"],
            }),
          expectErrors: ["onlyDomains"],
        },
        {
          name: "valid onlyDomains",
          build: () =>
            Object.assign(new EmailField(), {
              Id: "test",
              Name: "test",
              OnlyDomains: ["example.com", "example.org"],
            }),
          expectErrors: [],
        },
        {
          name: "invalid exceptDomains",
          build: () =>
            Object.assign(new EmailField(), {
              Id: "test",
              Name: "test",
              ExceptDomains: ["example.com", "invalid"],
            }),
          expectErrors: ["exceptDomains"],
        },
        {
          name: "valid exceptDomains",
          build: () =>
            Object.assign(new EmailField(), {
              Id: "test",
              Name: "test",
              ExceptDomains: ["example.com", "example.org"],
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
});
