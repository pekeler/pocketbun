// Ported from pocketbase/core/collection_query_test.go.

import { describe, expect, it } from "bun:test";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { newTestApp } from "../tests/app.ts";
import { DbxDatabase } from "../tools/dbx/database.ts";
import { CollectionTypeAuth, CollectionTypeView } from "./collection_model.ts";
import { StoreKeyCachedCollections } from "./collection_query.ts";

describe("collection query", () => {
  it("CollectionQuery", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const expected = "select {{_collections}}.* from {{_collections}}";
      const sql = app.CollectionQuery().Build().SQL();
      expect(sql).toBe(expected);
    } finally {
      await cleanup();
    }
  });

  it("ReloadCachedCollections", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const err = app.ReloadCachedCollections();
      if (err) {
        throw err;
      }

      const cached = app.store().get(StoreKeyCachedCollections) as unknown;
      expect(Array.isArray(cached)).toBe(true);

      const cachedCollections = cached as Array<{ id: string }>;
      const collections = app.FindAllCollections();
      expect(cachedCollections.length).toBe(collections.length);

      for (const collection of collections) {
        const exists = cachedCollections.some((entry) => entry.id === collection.id);
        expect(exists).toBe(true);
      }
    } finally {
      await cleanup();
    }
  });

  it("FindAllCollections", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const scenarios = [
        { collectionTypes: undefined as string[] | undefined, expectTotal: 16 },
        { collectionTypes: [] as string[], expectTotal: 16 },
        { collectionTypes: [""], expectTotal: 16 },
        { collectionTypes: ["unknown"], expectTotal: 0 },
        { collectionTypes: ["unknown", CollectionTypeAuth], expectTotal: 4 },
        { collectionTypes: [CollectionTypeAuth, CollectionTypeView], expectTotal: 7 },
      ];

      for (const scenario of scenarios) {
        const collections = app.FindAllCollections(...(scenario.collectionTypes ?? []));
        expect(collections.length).toBe(scenario.expectTotal);

        const expectedTypes = Array.from(new Set((scenario.collectionTypes ?? []).filter((value) => value)));
        if (expectedTypes.length > 0) {
          for (const collection of collections) {
            expect(expectedTypes.includes(collection.type)).toBe(true);
          }
        }
      }
    } finally {
      await cleanup();
    }
  });

  it("FindCollectionByNameOrId", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const scenarios = [
        { nameOrId: "", expectError: true },
        { nameOrId: "missing", expectError: true },
        { nameOrId: "wsmn24bux7wo113", expectError: false },
        { nameOrId: "demo1", expectError: false },
        { nameOrId: "DEMO1", expectError: false },
      ];

      for (const scenario of scenarios) {
        let result: ReturnType<typeof app.FindCollectionByNameOrId> | null = null;
        let err: Error | null = null;

        try {
          result = app.FindCollectionByNameOrId(scenario.nameOrId);
        } catch (error) {
          err = error as Error;
        }

        const hasErr = err !== null;
        expect(hasErr).toBe(scenario.expectError);

        if (!hasErr && result) {
          const matchesId = result.id === scenario.nameOrId;
          const matchesName = result.name.toLowerCase() === scenario.nameOrId.toLowerCase();
          expect(matchesId || matchesName).toBe(true);
        }
      }
    } finally {
      await cleanup();
    }
  });

  it("FindCachedCollectionByNameOrId", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      let totalQueries = 0;
      const db = app.db() as DbxDatabase;
      db.QueryLogFunc = () => {
        totalQueries += 1;
      };

      const scenarios = [
        { nameOrId: "", expectError: true },
        { nameOrId: "missing", expectError: true },
        { nameOrId: "wsmn24bux7wo113", expectError: false },
        { nameOrId: "demo1", expectError: false },
        { nameOrId: "DEMO1", expectError: false },
      ];

      const run = (withCache: boolean) => {
        let expectedTotalQueries = 0;

        if (withCache) {
          const err = app.ReloadCachedCollections();
          if (err) {
            throw err;
          }
        } else {
          app.store().reset(null);
          expectedTotalQueries = scenarios.length;
        }

        totalQueries = 0;

        for (const scenario of scenarios) {
          let result: ReturnType<typeof app.FindCachedCollectionByNameOrId> | null = null;
          let err: Error | null = null;

          try {
            result = app.FindCachedCollectionByNameOrId(scenario.nameOrId);
          } catch (error) {
            err = error as Error;
          }

          const hasErr = err !== null;
          expect(hasErr).toBe(scenario.expectError);

          if (!hasErr && result) {
            const matchesId = result.id === scenario.nameOrId;
            const matchesName = result.name.toLowerCase() === scenario.nameOrId.toLowerCase();
            expect(matchesId || matchesName).toBe(true);
          }
        }

        expect(totalQueries).toBe(expectedTotalQueries);
      };

      run(true);
      run(false);
    } finally {
      await cleanup();
    }
  });

  it("FindCollectionReferences", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const collection = app.FindCollectionByNameOrId("demo3");

      const result = app.FindCollectionReferences(
        collection,
        collection.id,
        // test whether "nonempty" exclude ids condition will be skipped
        "",
        "",
      );

      expect(result.size).toBe(1);

      const expectedFields = [
        "rel_one_no_cascade",
        "rel_one_no_cascade_required",
        "rel_one_cascade",
        "rel_one_unique",
        "rel_many_no_cascade",
        "rel_many_no_cascade_required",
        "rel_many_cascade",
        "rel_many_unique",
      ];

      for (const [col, fields] of result) {
        expect(col.name).toBe("demo4");
        expect(fields.length).toBe(expectedFields.length);
        for (const field of fields) {
          expect(expectedFields.includes(field.GetName())).toBe(true);
        }
      }
    } finally {
      await cleanup();
    }
  });

  it("FindCachedCollectionReferences", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const collection = app.FindCollectionByNameOrId("demo3");

      let totalQueries = 0;
      const db = app.db() as DbxDatabase;
      db.QueryLogFunc = () => {
        totalQueries += 1;
      };

      const run = (withCache: boolean) => {
        let expectedTotalQueries = 0;

        if (withCache) {
          const err = app.ReloadCachedCollections();
          if (err) {
            throw err;
          }
        } else {
          app.store().reset(null);
          expectedTotalQueries = 1;
        }

        totalQueries = 0;

        const result = app.FindCachedCollectionReferences(
          collection,
          collection.id,
          // test whether "nonempty" exclude ids condition will be skipped
          "",
          "",
        );

        expect(result.size).toBe(1);

        const expectedFields = [
          "rel_one_no_cascade",
          "rel_one_no_cascade_required",
          "rel_one_cascade",
          "rel_one_unique",
          "rel_many_no_cascade",
          "rel_many_no_cascade_required",
          "rel_many_cascade",
          "rel_many_unique",
        ];

        for (const [col, fields] of result) {
          expect(col.name).toBe("demo4");
          expect(fields.length).toBe(expectedFields.length);
          for (const field of fields) {
            expect(expectedFields.includes(field.GetName())).toBe(true);
          }
        }

        expect(totalQueries).toBe(expectedTotalQueries);
      };

      run(true);
      run(false);
    } finally {
      await cleanup();
    }
  });

  it("IsCollectionNameUnique", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const scenarios = [
        { name: "", excludeId: "", expected: false },
        { name: "demo1", excludeId: "", expected: false },
        { name: "Demo1", excludeId: "", expected: false },
        { name: "new", excludeId: "", expected: true },
        { name: "demo1", excludeId: "wsmn24bux7wo113", expected: true },
      ];

      for (const scenario of scenarios) {
        const result = app.IsCollectionNameUnique(scenario.name, scenario.excludeId);
        expect(result).toBe(scenario.expected);
      }
    } finally {
      await cleanup();
    }
  });

  it("TruncateCollection", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const countFiles = async (collectionId: string): Promise<number> => {
        const entries = await readdir(join(app.DataDir(), "storage", collectionId));
        return entries.length;
      };

      const view2 = app.FindCollectionByNameOrId("view2");
      const viewErr = await app.TruncateCollection(view2);
      expect(viewErr).not.toBeNull();

      const demo3 = app.FindCollectionByNameOrId("demo3");
      const originalTotalRecords = app.CountRecords(demo3);
      const originalTotalFiles = await countFiles(demo3.id);

      const failErr = await app.TruncateCollection(demo3);
      expect(failErr).not.toBeNull();

      await new Promise((resolve) => setTimeout(resolve, 100));

      const totalRecords = app.CountRecords(demo3);
      expect(totalRecords).toBe(originalTotalRecords);

      const totalFiles = await countFiles(demo3.id);
      expect(totalFiles).toBe(originalTotalFiles);

      const demo5 = app.FindCollectionByNameOrId("demo5");
      const truncateErr = await app.TruncateCollection(demo5);
      expect(truncateErr).toBeNull();

      await new Promise((resolve) => setTimeout(resolve, 100));

      const total = app.CountRecords(demo5);
      expect(total).toBe(0);

      const totalFilesAfter = await countFiles(demo5.id);
      expect(totalFilesAfter).toBe(0);

      const retryErr = await app.TruncateCollection(demo5);
      expect(retryErr).toBeNull();
    } finally {
      await cleanup();
    }
  });
});
