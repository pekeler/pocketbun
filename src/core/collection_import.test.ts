// Ported from pocketbase/core/collection_import_test.go.

import { describe, expect, it } from "bun:test";
import { newTestApp } from "../tests/app.ts";
import { CollectionNameAuthOrigins } from "./auth_origin_model.ts";

describe("collection import", () => {
  it("ImportCollections", async () => {
    const { app: baseApp, cleanup: baseCleanup } = await newTestApp();
    let totalRegularCollections = 0;
    let totalSystemCollections = 0;
    let totalCollections = 0;

    try {
      const regularCollections = baseApp.CollectionQuery().AndWhere({ system: false }).All();
      const systemCollections = baseApp.CollectionQuery().AndWhere({ system: true }).All();

      totalRegularCollections = regularCollections.length;
      totalSystemCollections = systemCollections.length;
      totalCollections = totalRegularCollections + totalSystemCollections;
    } finally {
      await baseCleanup();
    }

    const scenarios: Array<{
      name: string;
      data: Array<Record<string, unknown>>;
      deleteMissing: boolean;
      expectError: boolean;
      expectCollectionsCount: number;
      afterTestFunc?: (app: Awaited<ReturnType<typeof newTestApp>>["app"]) => void;
    }> = [
      {
        name: "empty collections",
        data: [],
        deleteMissing: false,
        expectError: true,
        expectCollectionsCount: totalCollections,
      },
      {
        name: "minimal collection import (with missing system fields)",
        data: [
          { name: "import_test1", type: "auth" },
          {
            name: "import_test2",
            fields: [{ name: "test", type: "text" }],
          },
        ],
        deleteMissing: false,
        expectError: false,
        expectCollectionsCount: totalCollections + 2,
      },
      {
        name: "minimal collection import (trigger collection model validations)",
        data: [
          { name: "" },
          {
            name: "import_test2",
            fields: [{ name: "test", type: "text" }],
          },
        ],
        deleteMissing: false,
        expectError: true,
        expectCollectionsCount: totalCollections,
      },
      {
        name: "minimal collection import (trigger field settings validation)",
        data: [{ name: "import_test", fields: [{ name: "test", type: "text", min: -1 }] }],
        deleteMissing: false,
        expectError: true,
        expectCollectionsCount: totalCollections,
      },
      {
        name: "new + update + delete (system collections delete should be ignored)",
        data: [
          {
            id: "wsmn24bux7wo113",
            name: "demo",
            fields: [
              {
                id: "_2hlxbmp",
                name: "title",
                type: "text",
                system: false,
                required: true,
                min: 3,
                max: null,
                pattern: "",
              },
            ],
            indexes: [],
          },
          {
            name: "import1",
            fields: [
              {
                name: "active",
                type: "bool",
              },
            ],
          },
        ],
        deleteMissing: true,
        expectError: false,
        expectCollectionsCount: totalSystemCollections + 2,
      },
      {
        name: "test with deleteMissing: false",
        data: [
          {
            name: "demo1",
            fields: [
              {
                id: "_2hlxbmp",
                name: "title",
                type: "text",
                system: false,
                required: true,
                min: 3,
                max: null,
                pattern: "",
              },
              {
                id: "_2hlxbmp",
                name: "field_with_duplicate_id",
                type: "text",
                system: false,
                required: true,
                unique: false,
                min: 4,
                max: null,
                pattern: "",
              },
              {
                id: "abcd_import",
                name: "new_field",
                type: "text",
              },
            ],
          },
          {
            name: "new_import",
            fields: [
              {
                id: "abcd_import",
                name: "active",
                type: "bool",
              },
            ],
          },
        ],
        deleteMissing: false,
        expectError: false,
        expectCollectionsCount: totalCollections + 1,
        afterTestFunc: (testApp) => {
          const expectedCollectionFields: Record<string, number> = {
            [CollectionNameAuthOrigins]: 6,
            nologin: 10,
            demo1: 19,
            demo2: 5,
            demo3: 5,
            demo4: 16,
            demo5: 9,
            new_import: 2,
          };

          for (const [name, expectedCount] of Object.entries(expectedCollectionFields)) {
            const collection = testApp.FindCollectionByNameOrId(name);
            expect(collection.Fields.length).toBe(expectedCount);
          }
        },
      },
    ];

    for (const scenario of scenarios) {
      const { app, cleanup } = await newTestApp();
      try {
        const err = await app.ImportCollections(scenario.data, scenario.deleteMissing);
        const hasErr = err !== null;
        expect(hasErr).toBe(scenario.expectError);

        const collections = app.CollectionQuery().All();
        expect(collections.length).toBe(scenario.expectCollectionsCount);

        if (scenario.afterTestFunc) {
          scenario.afterTestFunc(app);
        }
      } finally {
        await cleanup();
      }
    }
  });
});
