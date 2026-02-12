// Ported from pocketbase/core/field_date_test.go

import { describe, expect, it } from "bun:test";
import { newUnbootstrappedTestApp } from "../tests/app.ts";
import { testValidationErrors } from "../tests/validation_errors.ts";
import { DateTime, NowDateTime } from "../tools/types/index.ts";
import { NewBaseCollection } from "./collection_model.ts";
import { testDefaultFieldIdValidation, testDefaultFieldNameValidation, testFieldBaseMethods } from "./field.test.ts";
import { DateField, FieldTypeDate } from "./field_date.ts";
import { NewRecord } from "./record_model.ts";

describe("date field", () => {
  it("base methods", () => {
    testFieldBaseMethods(FieldTypeDate);
  });

  it("column type", async () => {
    const { app, cleanup } = await newUnbootstrappedTestApp();
    try {
      const field = new DateField();
      expect(field.ColumnType(app)).toBe("TEXT DEFAULT '' NOT NULL");
    } finally {
      await cleanup();
    }
  });

  it("prepare value", async () => {
    const { cleanup } = await newUnbootstrappedTestApp();
    try {
      const field = new DateField();
      const record = NewRecord(NewBaseCollection("test"));

      const scenarios: Array<{ raw: unknown; expected: string }> = [
        { raw: "", expected: "" },
        { raw: "invalid", expected: "" },
        { raw: "2024-01-01 00:11:22.345Z", expected: "2024-01-01 00:11:22.345Z" },
        {
          raw: new Date(Date.UTC(2024, 0, 2, 3, 4, 5, 0)),
          expected: "2024-01-02 03:04:05.000Z",
        },
      ];

      for (const scenario of scenarios) {
        const value = field.PrepareValue(record, scenario.raw);
        expect(value).toBeInstanceOf(DateTime);
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
          field: Object.assign(new DateField(), { Name: "test" }),
          setup: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", 123);
            return record;
          },
          expectError: true,
        },
        {
          name: "zero field value (not required)",
          field: Object.assign(new DateField(), { Name: "test" }),
          setup: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", new DateTime());
            return record;
          },
          expectError: false,
        },
        {
          name: "zero field value (required)",
          field: Object.assign(new DateField(), { Name: "test", Required: true }),
          setup: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", new DateTime());
            return record;
          },
          expectError: true,
        },
        {
          name: "non-zero field value (required)",
          field: Object.assign(new DateField(), { Name: "test", Required: true }),
          setup: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", NowDateTime());
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
    await testDefaultFieldIdValidation(FieldTypeDate);
    await testDefaultFieldNameValidation(FieldTypeDate);

    const { app, cleanup } = await newUnbootstrappedTestApp();
    try {
      const collection = NewBaseCollection("test_collection");

      const scenarios = [
        {
          name: "zero Min/Max",
          build: () =>
            Object.assign(new DateField(), {
              Id: "test",
              Name: "test",
            }),
          expectErrors: [],
        },
        {
          name: "non-empty Min with empty Max",
          build: () =>
            Object.assign(new DateField(), {
              Id: "test",
              Name: "test",
              Min: NowDateTime(),
            }),
          expectErrors: [],
        },
        {
          name: "empty Min non-empty Max",
          build: () =>
            Object.assign(new DateField(), {
              Id: "test",
              Name: "test",
              Max: NowDateTime(),
            }),
          expectErrors: [],
        },
        {
          name: "Min = Max",
          build: () => {
            const date = NowDateTime();
            return Object.assign(new DateField(), {
              Id: "test",
              Name: "test",
              Min: date,
              Max: date,
            });
          },
          expectErrors: [],
        },
        {
          name: "Min > Max",
          build: () => {
            const min = NowDateTime();
            const max = NowDateTime().Add(-5000);
            return Object.assign(new DateField(), {
              Id: "test",
              Name: "test",
              Min: min,
              Max: max,
            });
          },
          expectErrors: [],
        },
        {
          name: "Min < Max",
          build: () => {
            const max = NowDateTime();
            const min = NowDateTime().Add(-5000);
            return Object.assign(new DateField(), {
              Id: "test",
              Name: "test",
              Min: min,
              Max: max,
            });
          },
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
