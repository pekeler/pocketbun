// Ported from pocketbase/core/validators/db_test.go

import { describe, expect, it } from "bun:test";
import { ValidationErrors } from "../../internal/compat/validation.ts";
import { newTestApp } from "../../tests/app.ts";
import { testValidationErrors } from "../../tests/validation_errors.ts";
import { NormalizeUniqueIndexError, UniqueId } from "./db.ts";

describe("validators db", () => {
  it("unique id", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const scenarios = [
        { id: "", tableName: "", expectError: false },
        { id: "test", tableName: "", expectError: true },
        { id: "wsmn24bux7wo113", tableName: "_collections", expectError: true },
        { id: "test_unique_id", tableName: "unknown_table", expectError: true },
        { id: "test_unique_id", tableName: "_collections", expectError: false },
      ];

      for (const [index, scenario] of scenarios.entries()) {
        const err = UniqueId(app.db(), scenario.tableName)(scenario.id);
        const hasErr = err !== null;
        expect(hasErr, `scenario ${index}`).toBe(scenario.expectError);
      }
    } finally {
      await cleanup();
    }
  });

  it("normalizes unique index errors", () => {
    const validationErr = new ValidationErrors({ c: new Error("abc") });
    const errA = new Error("abc");
    const errB = new Error("UNIQUE constraint failed for fields test.a,test.b");
    const errC = new Error("UNIQUE constraint failed for fields test_suffix.a,test_suffix.b");
    const errD = new Error("UNIQUE constraint failed for fields test.a_2,test.c");

    const scenarios: Array<{
      name: string;
      err: Error | null;
      table: string;
      names: string[];
      expectedKeys: string[] | null;
    }> = [
      {
        name: "nil error (no changes)",
        err: null,
        table: "test",
        names: ["a", "b"],
        expectedKeys: null,
      },
      {
        name: "non-unique index error (no changes)",
        err: errA,
        table: "test",
        names: ["a", "b"],
        expectedKeys: null,
      },
      {
        name: "validation error (no changes)",
        err: validationErr,
        table: "test",
        names: ["a", "b"],
        expectedKeys: ["c"],
      },
      {
        name: "unique index error but mismatched table name",
        err: errB,
        table: "example",
        names: ["a", "b"],
        expectedKeys: null,
      },
      {
        name: "unique index error with table name suffix matching the specified one",
        err: errC,
        table: "suffix",
        names: ["a", "b", "c"],
        expectedKeys: null,
      },
      {
        name: "unique index error but mismatched fields",
        err: errB,
        table: "test",
        names: ["c", "d"],
        expectedKeys: null,
      },
      {
        name: "unique index error with matching table name and fields",
        err: errB,
        table: "test",
        names: ["a", "b", "c"],
        expectedKeys: ["a", "b"],
      },
      {
        name: "unique index error with matching table name and field starting with the name of another non-unique field",
        err: errD,
        table: "test",
        names: ["a", "a_2", "c"],
        expectedKeys: ["a_2", "c"],
      },
    ];

    for (const scenario of scenarios) {
      const result = NormalizeUniqueIndexError(scenario.err, scenario.table, scenario.names);

      if (!scenario.expectedKeys || scenario.expectedKeys.length === 0) {
        expect(result).toBe(scenario.err);
        continue;
      }

      testValidationErrors(result, scenario.expectedKeys);
    }
  });
});
