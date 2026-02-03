// Ported from pocketbase/core/collection_model_view_options_test.go

import { describe, it } from "bun:test";
import { newTestApp } from "../tests/app.ts";
import { testValidationErrors } from "../tests/validation_errors.ts";
import { NewViewCollection } from "./collection.ts";

describe("collection view options validate", () => {
  it("scenarios", async () => {
    const scenarios = [
      {
        name: "view with empty query",
        collection: () => {
          return NewViewCollection("new_auth");
        },
        expectedErrors: ["fields", "viewQuery"],
      },
      {
        name: "view with invalid query",
        collection: () => {
          const c = NewViewCollection("new_auth");
          c.ViewQuery = "invalid";
          return c;
        },
        expectedErrors: ["fields", "viewQuery"],
      },
      {
        name: "view with valid query but missing id",
        collection: () => {
          const c = NewViewCollection("new_auth");
          c.ViewQuery = "select 1";
          return c;
        },
        expectedErrors: ["fields", "viewQuery"],
      },
      {
        name: "view with valid query",
        collection: () => {
          const c = NewViewCollection("new_auth");
          c.ViewQuery = "select demo1.id, text as example from demo1";
          return c;
        },
        expectedErrors: [],
      },
      {
        name: "update view query",
        collection: (app: Awaited<ReturnType<typeof newTestApp>>["app"]) => {
          const c = app.findCollectionByNameOrId("view2");
          if (!c) {
            throw new Error("Missing view2 collection");
          }
          c.ViewQuery = "select demo1.id, text as example from demo1";
          return c;
        },
        expectedErrors: [],
      },
    ];

    for (const scenario of scenarios) {
      const { app, cleanup } = await newTestApp();
      try {
        const collection = scenario.collection(app);
        const result = await app.Validate(collection);
        testValidationErrors(result, scenario.expectedErrors);
      } finally {
        await cleanup();
      }
    }
  });
});
