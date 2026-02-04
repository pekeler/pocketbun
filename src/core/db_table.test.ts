// Ported from pocketbase/core/db_table_test.go.

import { describe, expect, it } from "bun:test";
import type { DbxDatabase } from "../tools/dbx/database.ts";
import { newTestApp } from "../tests/app.ts";
import { CollectionNameSuperusers } from "./collection_model.ts";

describe("db table helpers", () => {
  it("HasTable", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const scenarios = [
        { tableName: "", expected: false },
        { tableName: "test", expected: false },
        { tableName: CollectionNameSuperusers, expected: true },
        { tableName: "demo3", expected: true },
        { tableName: "DEMO3", expected: true },
        { tableName: "view1", expected: true },
      ];

      for (const scenario of scenarios) {
        expect(app.HasTable(scenario.tableName)).toBe(scenario.expected);
      }
    } finally {
      await cleanup();
    }
  });

  it("AuxHasTable", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const scenarios = [
        { tableName: "", expected: false },
        { tableName: "test", expected: false },
        { tableName: "_lOGS", expected: true },
      ];

      for (const scenario of scenarios) {
        expect(app.AuxHasTable(scenario.tableName)).toBe(scenario.expected);
      }
    } finally {
      await cleanup();
    }
  });

  it("TableColumns", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const scenarios = [
        { tableName: "", expected: [] as string[] },
        { tableName: "_params", expected: ["id", "value", "created", "updated"] },
      ];

      for (const scenario of scenarios) {
        const columns = app.TableColumns(scenario.tableName);
        expect(columns.length).toBe(scenario.expected.length);
        for (const column of columns) {
          expect(scenario.expected.includes(column)).toBe(true);
        }
      }
    } finally {
      await cleanup();
    }
  });

  it("TableInfo", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const scenarios = [
        { tableName: "", expected: "null" },
        { tableName: "missing", expected: "null" },
        {
          tableName: "_params",
          expected:
            '[{"PK":0,"Index":0,"Name":"created","Type":"TEXT","NotNull":true,"DefaultValue":{"String":"\'\'","Valid":true}},{"PK":1,"Index":1,"Name":"id","Type":"TEXT","NotNull":true,"DefaultValue":{"String":"\'r\'||lower(hex(randomblob(7)))","Valid":true}},{"PK":0,"Index":2,"Name":"updated","Type":"TEXT","NotNull":true,"DefaultValue":{"String":"\'\'","Valid":true}},{"PK":0,"Index":3,"Name":"value","Type":"JSON","NotNull":false,"DefaultValue":{"String":"NULL","Valid":true}}]',
        },
      ];

      for (const scenario of scenarios) {
        let rows: unknown = null;
        try {
          rows = app.TableInfo(scenario.tableName);
        } catch {
          rows = null;
        }

        const raw = JSON.stringify(rows);
        expect(raw).toBe(scenario.expected);
      }
    } finally {
      await cleanup();
    }
  });

  it("TableIndexes", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const scenarios = [
        { tableName: "", expected: [] as string[] },
        { tableName: "missing", expected: [] as string[] },
        {
          tableName: CollectionNameSuperusers,
          expected: ["idx_email__pbc_3323866339", "idx_tokenKey__pbc_3323866339"],
        },
      ];

      for (const scenario of scenarios) {
        const indexes = app.TableIndexes(scenario.tableName);
        expect(Object.keys(indexes).length).toBe(scenario.expected.length);
        for (const name of scenario.expected) {
          expect(Boolean(indexes[name])).toBe(true);
        }
      }
    } finally {
      await cleanup();
    }
  });

  it("DeleteTable", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const scenarios = [
        { tableName: "", expectError: true },
        { tableName: "test", expectError: false },
        { tableName: "_admins", expectError: false },
        { tableName: "demo3", expectError: false },
      ];

      for (const scenario of scenarios) {
        const err = app.DeleteTable(scenario.tableName);
        expect(Boolean(err)).toBe(scenario.expectError);
      }
    } finally {
      await cleanup();
    }
  });

  it("Vacuum", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const db = app.db() as DbxDatabase;
      const queries: string[] = [];
      db.QueryLogFunc = (sql) => {
        queries.push(sql);
      };

      const err = app.Vacuum();
      expect(err).toBeNull();
      expect(queries.length).toBe(1);
      expect(queries[0]).toBe("VACUUM");
    } finally {
      await cleanup();
    }
  });

  it("AuxVacuum", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const db = app.auxDb() as DbxDatabase;
      const queries: string[] = [];
      db.QueryLogFunc = (sql) => {
        queries.push(sql);
      };

      const err = app.AuxVacuum();
      expect(err).toBeNull();
      expect(queries.length).toBe(1);
      expect(queries[0]).toBe("VACUUM");
    } finally {
      await cleanup();
    }
  });
});
