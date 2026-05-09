// Ported from pocketbase/core/record_query_expand_test.go.

import { describe, expect, it } from "bun:test";
import type { DbxDatabase } from "../tools/dbx/database.ts";
import type { Collection } from "./collection_model.ts";
import { newTestApp } from "../tests/app.ts";
import { toUniqueStringSlice } from "../tools/list/list.ts";
import { FieldNameExpand, Record as RecordModel } from "./record_model.ts";

type ExpandFetchFunc = (collection: Collection, ids: string[]) => RecordModel[];

function countExpandProps(encoded: string) {
  const expandKey = `"${FieldNameExpand}":`;
  const totalExpandProps = encoded.split(expandKey).length - 1;
  const totalEmptyExpands = encoded.split(`${expandKey}{}`).length - 1;
  return { totalExpandProps, totalEmptyExpands };
}

describe("record expand", () => {
  it("ExpandRecords", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const scenarios: Array<{
        testName: string;
        collectionIdOrName: string;
        recordIds: string[];
        expands: string[];
        fetchFunc: ExpandFetchFunc | null;
        expectNonemptyExpandProps: number;
        expectExpandFailures: number;
      }> = [
        {
          testName: "empty records",
          collectionIdOrName: "",
          recordIds: [],
          expands: ["self_rel_one", "self_rel_many.self_rel_one"],
          fetchFunc: (collection, ids) => app.FindRecordsByIds(collection.Id, ids),
          expectNonemptyExpandProps: 0,
          expectExpandFailures: 0,
        },
        {
          testName: "empty expand",
          collectionIdOrName: "demo4",
          recordIds: ["i9naidtvr6qsgb4", "qzaqccwrmva4o1n"],
          expands: [],
          fetchFunc: (collection, ids) => app.FindRecordsByIds(collection.Id, ids),
          expectNonemptyExpandProps: 0,
          expectExpandFailures: 0,
        },
        {
          testName: "fetchFunc with error",
          collectionIdOrName: "demo4",
          recordIds: ["i9naidtvr6qsgb4", "qzaqccwrmva4o1n"],
          expands: ["self_rel_one", "self_rel_many.self_rel_one"],
          fetchFunc: () => {
            throw new Error("test error");
          },
          expectNonemptyExpandProps: 0,
          expectExpandFailures: 2,
        },
        {
          testName: "missing relation field",
          collectionIdOrName: "demo4",
          recordIds: ["i9naidtvr6qsgb4", "qzaqccwrmva4o1n"],
          expands: ["missing"],
          fetchFunc: (collection, ids) => app.FindRecordsByIds(collection.Id, ids),
          expectNonemptyExpandProps: 0,
          expectExpandFailures: 1,
        },
        {
          testName: "existing, but non-relation type field",
          collectionIdOrName: "demo4",
          recordIds: ["i9naidtvr6qsgb4", "qzaqccwrmva4o1n"],
          expands: ["title"],
          fetchFunc: (collection, ids) => app.FindRecordsByIds(collection.Id, ids),
          expectNonemptyExpandProps: 0,
          expectExpandFailures: 1,
        },
        {
          testName: "invalid/missing second level expand",
          collectionIdOrName: "demo4",
          recordIds: ["i9naidtvr6qsgb4", "qzaqccwrmva4o1n"],
          expands: ["rel_one_no_cascade.title"],
          fetchFunc: (collection, ids) => app.FindRecordsByIds(collection.Id, ids),
          expectNonemptyExpandProps: 0,
          expectExpandFailures: 1,
        },
        {
          testName: "with nil fetchfunc",
          collectionIdOrName: "users",
          recordIds: ["bgs820n361vj1qd", "4q1xlclmfloku33", "oap640cot4yru2s"],
          expands: ["rel"],
          fetchFunc: null,
          expectNonemptyExpandProps: 2,
          expectExpandFailures: 0,
        },
        {
          testName: "expand normalizations",
          collectionIdOrName: "demo4",
          recordIds: ["i9naidtvr6qsgb4", "qzaqccwrmva4o1n"],
          expands: [
            "self_rel_one",
            "self_rel_many.self_rel_many.rel_one_no_cascade",
            "self_rel_many.self_rel_one.self_rel_many.self_rel_one.rel_one_no_cascade",
            "self_rel_many",
            "self_rel_many.",
            "  self_rel_many  ",
            "",
          ],
          fetchFunc: (collection, ids) => app.FindRecordsByIds(collection.Id, ids),
          expectNonemptyExpandProps: 9,
          expectExpandFailures: 0,
        },
        {
          testName: "single expand",
          collectionIdOrName: "users",
          recordIds: ["bgs820n361vj1qd", "4q1xlclmfloku33", "oap640cot4yru2s"],
          expands: ["rel"],
          fetchFunc: (collection, ids) => app.FindRecordsByIds(collection.Id, ids),
          expectNonemptyExpandProps: 2,
          expectExpandFailures: 0,
        },
        {
          testName: "with nil fetchfunc",
          collectionIdOrName: "users",
          recordIds: ["bgs820n361vj1qd", "4q1xlclmfloku33", "oap640cot4yru2s"],
          expands: ["rel"],
          fetchFunc: null,
          expectNonemptyExpandProps: 2,
          expectExpandFailures: 0,
        },
        {
          testName: "maxExpandDepth reached",
          collectionIdOrName: "demo4",
          recordIds: ["qzaqccwrmva4o1n"],
          expands: [
            "self_rel_many.self_rel_many.self_rel_many.self_rel_many.self_rel_many.self_rel_many.self_rel_many.self_rel_many.self_rel_many.self_rel_many.self_rel_many.self_rel_many",
          ],
          fetchFunc: (collection, ids) => app.FindRecordsByIds(collection.Id, ids),
          expectNonemptyExpandProps: 6,
          expectExpandFailures: 0,
        },
        {
          testName: "simple back single relation field expand (deprecated syntax)",
          collectionIdOrName: "demo3",
          recordIds: ["lcl9d87w22ml6jy"],
          expands: ["demo4(rel_one_no_cascade_required)"],
          fetchFunc: (collection, ids) => app.FindRecordsByIds(collection.Id, ids),
          expectNonemptyExpandProps: 1,
          expectExpandFailures: 0,
        },
        {
          testName: "simple back expand via single relation field",
          collectionIdOrName: "demo3",
          recordIds: ["lcl9d87w22ml6jy"],
          expands: ["demo4_via_rel_one_no_cascade_required"],
          fetchFunc: (collection, ids) => app.FindRecordsByIds(collection.Id, ids),
          expectNonemptyExpandProps: 1,
          expectExpandFailures: 0,
        },
        {
          testName: "nested back expand via single relation field",
          collectionIdOrName: "demo3",
          recordIds: ["lcl9d87w22ml6jy"],
          expands: ["demo4_via_rel_one_no_cascade_required.self_rel_many.self_rel_many.self_rel_one"],
          fetchFunc: (collection, ids) => app.FindRecordsByIds(collection.Id, ids),
          expectNonemptyExpandProps: 5,
          expectExpandFailures: 0,
        },
        {
          testName: "nested back expand via multiple relation field",
          collectionIdOrName: "demo3",
          recordIds: ["lcl9d87w22ml6jy"],
          expands: [
            "demo4_via_rel_many_no_cascade_required.self_rel_many.rel_many_no_cascade_required.demo4_via_rel_many_no_cascade_required",
          ],
          fetchFunc: (collection, ids) => app.FindRecordsByIds(collection.Id, ids),
          expectNonemptyExpandProps: 7,
          expectExpandFailures: 0,
        },
        {
          testName: "expand multiple relations sharing a common path",
          collectionIdOrName: "demo4",
          recordIds: ["qzaqccwrmva4o1n"],
          expands: [
            "rel_one_no_cascade",
            "rel_many_no_cascade",
            "self_rel_many.self_rel_one.rel_many_cascade",
            "self_rel_many.self_rel_one.rel_many_no_cascade_required",
          ],
          fetchFunc: (collection, ids) => app.FindRecordsByIds(collection.Id, ids),
          expectNonemptyExpandProps: 5,
          expectExpandFailures: 0,
        },
      ];

      for (const scenario of scenarios) {
        const ids = toUniqueStringSlice(scenario.recordIds);
        let records: RecordModel[] = [];
        try {
          records = app.FindRecordsByIds(scenario.collectionIdOrName, ids);
        } catch {
          records = [];
        }
        const failed = app.ExpandRecords(records, scenario.expands, scenario.fetchFunc ?? null);

        expect(Object.keys(failed).length).toBe(scenario.expectExpandFailures);

        const encoded = JSON.stringify(records);
        const { totalExpandProps, totalEmptyExpands } = countExpandProps(encoded);
        const totalNonempty = totalExpandProps - totalEmptyExpands;
        expect(totalNonempty).toBe(scenario.expectNonemptyExpandProps);
      }
    } finally {
      await cleanup();
    }
  });

  it("ExpandRecord", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const scenarios: Array<{
        testName: string;
        collectionIdOrName: string;
        recordId: string;
        expands: string[];
        fetchFunc: ExpandFetchFunc | null;
        expectNonemptyExpandProps: number;
        expectExpandFailures: number;
      }> = [
        {
          testName: "empty expand",
          collectionIdOrName: "demo4",
          recordId: "i9naidtvr6qsgb4",
          expands: [],
          fetchFunc: (collection, ids) => app.FindRecordsByIds(collection.Id, ids),
          expectNonemptyExpandProps: 0,
          expectExpandFailures: 0,
        },
        {
          testName: "fetchFunc with error",
          collectionIdOrName: "demo4",
          recordId: "i9naidtvr6qsgb4",
          expands: ["self_rel_one", "self_rel_many.self_rel_one"],
          fetchFunc: () => {
            throw new Error("test error");
          },
          expectNonemptyExpandProps: 0,
          expectExpandFailures: 2,
        },
        {
          testName: "missing relation field",
          collectionIdOrName: "demo4",
          recordId: "i9naidtvr6qsgb4",
          expands: ["missing"],
          fetchFunc: (collection, ids) => app.FindRecordsByIds(collection.Id, ids),
          expectNonemptyExpandProps: 0,
          expectExpandFailures: 1,
        },
        {
          testName: "existing, but non-relation type field",
          collectionIdOrName: "demo4",
          recordId: "i9naidtvr6qsgb4",
          expands: ["title"],
          fetchFunc: (collection, ids) => app.FindRecordsByIds(collection.Id, ids),
          expectNonemptyExpandProps: 0,
          expectExpandFailures: 1,
        },
        {
          testName: "invalid/missing second level expand",
          collectionIdOrName: "demo4",
          recordId: "qzaqccwrmva4o1n",
          expands: ["rel_one_no_cascade.title"],
          fetchFunc: (collection, ids) => app.FindRecordsByIds(collection.Id, ids),
          expectNonemptyExpandProps: 0,
          expectExpandFailures: 1,
        },
        {
          testName: "expand normalizations",
          collectionIdOrName: "demo4",
          recordId: "qzaqccwrmva4o1n",
          expands: [
            "self_rel_one",
            "self_rel_many.self_rel_many.rel_one_no_cascade",
            "self_rel_many.self_rel_one.self_rel_many.self_rel_one.rel_one_no_cascade",
            "self_rel_many",
            "self_rel_many.",
            "  self_rel_many  ",
            "",
          ],
          fetchFunc: (collection, ids) => app.FindRecordsByIds(collection.Id, ids),
          expectNonemptyExpandProps: 8,
          expectExpandFailures: 0,
        },
        {
          testName: "no rels to expand",
          collectionIdOrName: "users",
          recordId: "oap640cot4yru2s",
          expands: ["rel"],
          fetchFunc: (collection, ids) => app.FindRecordsByIds(collection.Id, ids),
          expectNonemptyExpandProps: 0,
          expectExpandFailures: 0,
        },
        {
          testName: "maxExpandDepth reached",
          collectionIdOrName: "demo4",
          recordId: "qzaqccwrmva4o1n",
          expands: [
            "self_rel_many.self_rel_many.self_rel_many.self_rel_many.self_rel_many.self_rel_many.self_rel_many.self_rel_many.self_rel_many.self_rel_many.self_rel_many.self_rel_many",
          ],
          fetchFunc: (collection, ids) => app.FindRecordsByIds(collection.Id, ids),
          expectNonemptyExpandProps: 6,
          expectExpandFailures: 0,
        },
        {
          testName: "simple indirect expand via single relation field (deprecated syntax)",
          collectionIdOrName: "demo3",
          recordId: "lcl9d87w22ml6jy",
          expands: ["demo4(rel_one_no_cascade_required)"],
          fetchFunc: (collection, ids) => app.FindRecordsByIds(collection.Id, ids),
          expectNonemptyExpandProps: 1,
          expectExpandFailures: 0,
        },
        {
          testName: "simple indirect expand via single relation field",
          collectionIdOrName: "demo3",
          recordId: "lcl9d87w22ml6jy",
          expands: ["demo4_via_rel_one_no_cascade_required"],
          fetchFunc: (collection, ids) => app.FindRecordsByIds(collection.Id, ids),
          expectNonemptyExpandProps: 1,
          expectExpandFailures: 0,
        },
        {
          testName: "nested indirect expand via single relation field",
          collectionIdOrName: "demo3",
          recordId: "lcl9d87w22ml6jy",
          expands: ["demo4(rel_one_no_cascade_required).self_rel_many.self_rel_many.self_rel_one"],
          fetchFunc: (collection, ids) => app.FindRecordsByIds(collection.Id, ids),
          expectNonemptyExpandProps: 5,
          expectExpandFailures: 0,
        },
        {
          testName: "nested indirect expand via single relation field",
          collectionIdOrName: "demo3",
          recordId: "lcl9d87w22ml6jy",
          expands: [
            "demo4_via_rel_many_no_cascade_required.self_rel_many.rel_many_no_cascade_required.demo4_via_rel_many_no_cascade_required",
          ],
          fetchFunc: (collection, ids) => app.FindRecordsByIds(collection.Id, ids),
          expectNonemptyExpandProps: 7,
          expectExpandFailures: 0,
        },
      ];

      for (const scenario of scenarios) {
        const record = app.FindRecordById(scenario.collectionIdOrName, scenario.recordId);
        const failed = app.ExpandRecord(record, scenario.expands, scenario.fetchFunc ?? null);

        expect(Object.keys(failed).length).toBe(scenario.expectExpandFailures);

        const encoded = JSON.stringify(record);
        const { totalExpandProps, totalEmptyExpands } = countExpandProps(encoded);
        const totalNonempty = totalExpandProps - totalEmptyExpands;
        expect(totalNonempty).toBe(scenario.expectNonemptyExpandProps);
      }
    } finally {
      await cleanup();
    }
  });

  it("BackRelationExpandSingleVsArrayResult", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const record = app.FindRecordById("demo3", "7nwo8tuiatetxdm");

      {
        const errs = app.ExpandRecord(record, ["demo4_via_rel_one_cascade"], (collection: Collection, ids: string[]) =>
          app.FindRecordsByIds(collection.Id, ids),
        );
        expect(Object.keys(errs).length).toBe(0);

        const result = record.Expand()["demo4_via_rel_one_cascade"] as RecordModel[] | undefined;
        expect(Array.isArray(result)).toBe(true);
      }

      {
        const demo4 = app.FindCollectionByNameOrId("demo4");
        demo4.indexes = [...(demo4.indexes ?? []), "create unique index idx_unique_expand on demo4 (rel_one_cascade)"];
        const saveErr = await app.Save(demo4);
        expect(saveErr).toBeNull();

        const errs = app.ExpandRecord(record, ["demo4_via_rel_one_cascade"], (collection: Collection, ids: string[]) =>
          app.FindRecordsByIds(collection.Id, ids),
        );
        expect(Object.keys(errs).length).toBe(0);

        const result = record.Expand()["demo4_via_rel_one_cascade"];
        expect(result).toBeInstanceOf(RecordModel);
      }
    } finally {
      await cleanup();
    }
  });

  it("ExpandRecordsQuerySkipDuplicatedIds", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      // fetch records that are known to have at least 1 common relation between them
      const records = app.FindRecordsByIds("demo1", ["84nmscqy84lsi1t", "al1h9ijdeojtsjy"]);

      const concurrentQueries: string[] = [];
      const db = app.db() as DbxDatabase;
      db.QueryLogFunc = (sql) => {
        concurrentQueries.push(sql);
      };

      const failed = app.ExpandRecords(records, ["rel_many"], null);
      if (Object.keys(failed).length > 0) {
        throw new Error(`Expected no expand errors, got ${JSON.stringify(failed)}`);
      }

      expect(concurrentQueries.length).toBe(1);
      expect(concurrentQueries[0]).toBe("select `users`.* from `users` WHERE `users`.`id` IN (?, ?, ?)");
    } finally {
      await cleanup();
    }
  });
});
