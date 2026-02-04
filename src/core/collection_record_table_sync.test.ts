// Ported from pocketbase/core/collection_record_table_sync_test.go.

import { describe, expect, it } from "bun:test";
import type { Collection } from "./collection_model.ts";
import { newTestApp } from "../tests/app.ts";
import { existInSlice } from "../tools/list/list.ts";
import { JSONArray } from "../tools/types/json_array.ts";
import { NewAuthCollection, NewBaseCollection } from "./collection_model.ts";
import { EmailField } from "./field_email.ts";
import { FileField } from "./field_file.ts";
import { RelationField } from "./field_relation.ts";
import { SelectField } from "./field_select.ts";
import { TextField } from "./field_text.ts";

function getTotalViews(app: Awaited<ReturnType<typeof newTestApp>>["app"]): number {
  const row = app.db().query("select count(*) as total from sqlite_master where sql is not null and type = 'view'").get() as
    | { total?: number }
    | undefined;
  return row?.total ?? 0;
}

describe("collection record table sync", () => {
  it("SyncRecordTableSchema", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const oldCollection = app.FindCollectionByNameOrId("demo2");
      const updatedCollection = app.FindCollectionByNameOrId("demo2");
      updatedCollection.Name = "demo_renamed";
      updatedCollection.Fields.RemoveByName("active");
      {
        const newField = new EmailField();
        newField.Name = "new_field";
        updatedCollection.Fields.Add(newField);
      }
      {
        const titleField = updatedCollection.Fields.GetByName("title");
        const renamed = new EmailField();
        renamed.Name = "title_renamed";
        if (titleField) {
          renamed.Id = titleField.GetId();
        }
        updatedCollection.Fields.Add(renamed);
      }
      updatedCollection.indexes = new JSONArray("create index idx_title_renamed on anything (title_renamed)");

      const baseCol = NewBaseCollection("new_base");
      baseCol.Fields.Add(Object.assign(new TextField(), { Name: "test" }));

      const authCol = NewAuthCollection("new_auth");
      authCol.Fields.Add(Object.assign(new TextField(), { Name: "test" }));
      authCol.AddIndex("idx_auth_test", false, "email, id", "");

      const scenarios: Array<{
        name: string;
        newCollection: Collection;
        oldCollection: Collection | null;
        expectedColumns: string[];
        expectedIndexesCount: number;
      }> = [
        {
          name: "new base collection",
          newCollection: baseCol,
          oldCollection: null,
          expectedColumns: ["id", "test"],
          expectedIndexesCount: 0,
        },
        {
          name: "new auth collection",
          newCollection: authCol,
          oldCollection: null,
          expectedColumns: ["id", "test", "email", "verified", "emailVisibility", "tokenKey", "password"],
          expectedIndexesCount: 3,
        },
        {
          name: "no changes",
          newCollection: oldCollection,
          oldCollection: oldCollection,
          expectedColumns: ["id", "created", "updated", "title", "active"],
          expectedIndexesCount: 3,
        },
        {
          name: "renamed table, deleted column, renamed column and new column",
          newCollection: updatedCollection,
          oldCollection: oldCollection,
          expectedColumns: ["id", "created", "updated", "title_renamed", "new_field"],
          expectedIndexesCount: 1,
        },
      ];

      for (const scenario of scenarios) {
        const err = await app.SyncRecordTableSchema(scenario.newCollection, scenario.oldCollection);
        if (err) {
          throw err;
        }

        expect(app.HasTable(scenario.newCollection.Name)).toBe(true);

        const cols = app.TableColumns(scenario.newCollection.Name);
        expect(cols.length).toBe(scenario.expectedColumns.length);

        for (const col of cols) {
          expect(existInSlice(col, scenario.expectedColumns)).toBe(true);
        }

        const indexes = app.TableIndexes(scenario.newCollection.Name);
        expect(Object.keys(indexes).length).toBe(scenario.expectedIndexesCount);
      }
    } finally {
      await cleanup();
    }
  });

  it("SingleVsMultipleValuesNormalization", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const collection = app.FindCollectionByNameOrId("demo1");

      const beforeTotalViews = getTotalViews(app);

      (collection.Fields.GetByName("select_one") as SelectField).MaxSelect = 2;
      (collection.Fields.GetByName("select_many") as SelectField).MaxSelect = 1;
      (collection.Fields.GetByName("file_one") as FileField).MaxSelect = 2;
      (collection.Fields.GetByName("file_many") as FileField).MaxSelect = 1;
      (collection.Fields.GetByName("rel_one") as RelationField).MaxSelect = 2;
      (collection.Fields.GetByName("rel_many") as RelationField).MaxSelect = 1;

      const newMultiple = new SelectField();
      newMultiple.Name = "new_multiple";
      newMultiple.Values = ["a", "b", "c"];
      newMultiple.MaxSelect = 3;
      collection.Fields.Add(newMultiple);

      const saveErr = await app.Save(collection);
      if (saveErr) {
        throw saveErr;
      }

      const afterTotalViews = getTotalViews(app);
      expect(afterTotalViews).toBe(beforeTotalViews);

      const tableInfo = app.TableInfo(collection.Name);
      const tableInfoExpectations: Record<string, string> = {
        select_one: "'[]'",
        select_many: "''",
        file_one: "'[]'",
        file_many: "''",
        rel_one: "'[]'",
        rel_many: "''",
        new_multiple: "'[]'",
      };

      for (const [col, dflt] of Object.entries(tableInfoExpectations)) {
        const row = tableInfo.find((entry) => entry.Name === col);
        expect(row).not.toBeUndefined();
        expect(row?.DefaultValue.String).toBe(dflt);
      }

      type FieldsExpectation = {
        select_one: string;
        select_many: string;
        file_one: string;
        file_many: string;
        rel_one: string;
        rel_many: string;
        new_multiple: string;
      };

      const fieldsScenarios: Array<{ recordId: string; expected: FieldsExpectation }> = [
        {
          recordId: "imy661ixudk5izi",
          expected: {
            select_one: "[]",
            select_many: "",
            file_one: "[]",
            file_many: "",
            rel_one: "[]",
            rel_many: "",
            new_multiple: "[]",
          },
        },
        {
          recordId: "al1h9ijdeojtsjy",
          expected: {
            select_one: '["optionB"]',
            select_many: "optionB",
            file_one: '["300_Jsjq7RdBgA.png"]',
            file_many: "",
            rel_one: '["84nmscqy84lsi1t"]',
            rel_many: "oap640cot4yru2s",
            new_multiple: "[]",
          },
        },
        {
          recordId: "84nmscqy84lsi1t",
          expected: {
            select_one: '["optionB"]',
            select_many: "optionC",
            file_one: '["test_d61b33QdDU.txt"]',
            file_many: "test_tC1Yc87DfC.txt",
            rel_one: "[]",
            rel_many: "oap640cot4yru2s",
            new_multiple: "[]",
          },
        },
      ];

      const normalize = (data: Record<string, unknown>) =>
        Object.fromEntries(
          Object.keys(data)
            .sort()
            .map((key) => [key, data[key]]),
        );

      for (const scenario of fieldsScenarios) {
        const row = app
          .db()
          .query(
            `select select_one, select_many, file_one, file_many, rel_one, rel_many, new_multiple from {{${collection.name}}} where [[id]] = ?`,
          )
          .get(scenario.recordId) as Record<string, unknown> | undefined;
        expect(row).toBeTruthy();
        const encodedResult = JSON.stringify(normalize(row ?? {})).toLowerCase();
        const encodedExpectation = JSON.stringify(normalize(scenario.expected as Record<string, unknown>)).toLowerCase();
        expect(encodedResult).toBe(encodedExpectation);
      }
    } finally {
      await cleanup();
    }
  });
});
