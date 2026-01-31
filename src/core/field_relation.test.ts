// Ported from pocketbase/core/field_relation_test.go

import { describe, expect, it } from "bun:test";
import { RelationField, FieldTypeRelation } from "./field_relation.ts";
import { NewBaseCollection, CollectionTypeView } from "./collection.ts";
import { NewRecord } from "./record.ts";
import { JSONArray } from "../tools/types/index.ts";
import { newTestApp } from "../../tests/test_app.ts";
import {
  testDefaultFieldIdValidation,
  testDefaultFieldNameValidation,
  testFieldBaseMethods,
} from "./field_test.ts";
import { testValidationErrors } from "../../tests/validation_errors.ts";

describe("relation field", () => {
  it("base methods", () => {
    testFieldBaseMethods(FieldTypeRelation);
  });

  it("column type", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const scenarios = [
        { name: "single (zero)", field: new RelationField(), expected: "TEXT DEFAULT '' NOT NULL" },
        {
          name: "single",
          field: Object.assign(new RelationField(), { MaxSelect: 1 }),
          expected: "TEXT DEFAULT '' NOT NULL",
        },
        {
          name: "multiple",
          field: Object.assign(new RelationField(), { MaxSelect: 2 }),
          expected: "JSON DEFAULT '[]' NOT NULL",
        },
      ];

      for (const scenario of scenarios) {
        expect(scenario.field.ColumnType(app)).toBe(scenario.expected);
      }
    } finally {
      await cleanup();
    }
  });

  it("is multiple", () => {
    const scenarios = [
      { name: "zero", field: new RelationField(), expected: false },
      {
        name: "single",
        field: Object.assign(new RelationField(), { MaxSelect: 1 }),
        expected: false,
      },
      {
        name: "multiple",
        field: Object.assign(new RelationField(), { MaxSelect: 2 }),
        expected: true,
      },
    ];

    for (const scenario of scenarios) {
      expect(scenario.field.IsMultiple()).toBe(scenario.expected);
    }
  });

  it("prepare value", async () => {
    const { cleanup } = await newTestApp();
    try {
      const record = NewRecord(NewBaseCollection("test"));

      const scenarios: Array<{ raw: unknown; field: RelationField; expected: string }> = [
        { raw: null, field: Object.assign(new RelationField(), { MaxSelect: 1 }), expected: '""' },
        { raw: "", field: Object.assign(new RelationField(), { MaxSelect: 1 }), expected: '""' },
        {
          raw: 123,
          field: Object.assign(new RelationField(), { MaxSelect: 1 }),
          expected: '"123"',
        },
        { raw: "a", field: Object.assign(new RelationField(), { MaxSelect: 1 }), expected: '"a"' },
        {
          raw: '["a"]',
          field: Object.assign(new RelationField(), { MaxSelect: 1 }),
          expected: '"a"',
        },
        {
          raw: [] as string[],
          field: Object.assign(new RelationField(), { MaxSelect: 1 }),
          expected: '""',
        },
        {
          raw: ["a", "b"],
          field: Object.assign(new RelationField(), { MaxSelect: 1 }),
          expected: '"b"',
        },
        { raw: null, field: Object.assign(new RelationField(), { MaxSelect: 2 }), expected: "[]" },
        { raw: "", field: Object.assign(new RelationField(), { MaxSelect: 2 }), expected: "[]" },
        {
          raw: 123,
          field: Object.assign(new RelationField(), { MaxSelect: 2 }),
          expected: '["123"]',
        },
        {
          raw: "a",
          field: Object.assign(new RelationField(), { MaxSelect: 2 }),
          expected: '["a"]',
        },
        {
          raw: '["a"]',
          field: Object.assign(new RelationField(), { MaxSelect: 2 }),
          expected: '["a"]',
        },
        {
          raw: [] as string[],
          field: Object.assign(new RelationField(), { MaxSelect: 2 }),
          expected: "[]",
        },
        {
          raw: ["a", "b", "c"],
          field: Object.assign(new RelationField(), { MaxSelect: 2 }),
          expected: '["a","b","c"]',
        },
      ];

      for (const scenario of scenarios) {
        const value = scenario.field.PrepareValue(record, scenario.raw);
        const raw = JSON.stringify(value);
        expect(raw).toBe(scenario.expected);
      }
    } finally {
      await cleanup();
    }
  });

  it("driver value", async () => {
    const { cleanup } = await newTestApp();
    try {
      const scenarios: Array<{ raw: unknown; field: RelationField; expected: string }> = [
        { raw: null, field: Object.assign(new RelationField(), { MaxSelect: 1 }), expected: '""' },
        { raw: "", field: Object.assign(new RelationField(), { MaxSelect: 1 }), expected: '""' },
        {
          raw: 123,
          field: Object.assign(new RelationField(), { MaxSelect: 1 }),
          expected: '"123"',
        },
        { raw: "a", field: Object.assign(new RelationField(), { MaxSelect: 1 }), expected: '"a"' },
        {
          raw: '["a"]',
          field: Object.assign(new RelationField(), { MaxSelect: 1 }),
          expected: '"a"',
        },
        {
          raw: [] as string[],
          field: Object.assign(new RelationField(), { MaxSelect: 1 }),
          expected: '""',
        },
        {
          raw: ["a", "b"],
          field: Object.assign(new RelationField(), { MaxSelect: 1 }),
          expected: '"b"',
        },
        { raw: null, field: Object.assign(new RelationField(), { MaxSelect: 2 }), expected: "[]" },
        { raw: "", field: Object.assign(new RelationField(), { MaxSelect: 2 }), expected: "[]" },
        {
          raw: 123,
          field: Object.assign(new RelationField(), { MaxSelect: 2 }),
          expected: '["123"]',
        },
        {
          raw: "a",
          field: Object.assign(new RelationField(), { MaxSelect: 2 }),
          expected: '["a"]',
        },
        {
          raw: '["a"]',
          field: Object.assign(new RelationField(), { MaxSelect: 2 }),
          expected: '["a"]',
        },
        {
          raw: [] as string[],
          field: Object.assign(new RelationField(), { MaxSelect: 2 }),
          expected: "[]",
        },
        {
          raw: ["a", "b", "c"],
          field: Object.assign(new RelationField(), { MaxSelect: 2 }),
          expected: '["a","b","c"]',
        },
      ];

      for (const scenario of scenarios) {
        const record = NewRecord(NewBaseCollection("test"));
        record.SetRaw(scenario.field.GetName(), scenario.raw);

        const [value] = scenario.field.DriverValue(record);
        if (scenario.field.IsMultiple()) {
          expect(value).toBeInstanceOf(JSONArray);
        } else {
          expect(typeof value).toBe("string");
        }

        const raw = JSON.stringify(value);
        expect(raw).toBe(scenario.expected);
      }
    } finally {
      await cleanup();
    }
  });

  it("validate value", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const demo1 = app.findCollectionByNameOrId("demo1");
      if (!demo1) {
        throw new Error("Missing demo1 collection");
      }

      const scenarios = [
        {
          name: "[single] zero field value (not required)",
          field: Object.assign(new RelationField(), {
            Name: "test",
            MaxSelect: 1,
            CollectionId: demo1.id,
          }),
          setup: () => {
            const record = NewRecord(NewBaseCollection("test_collection"));
            record.SetRaw("test", "");
            return record;
          },
          expectError: false,
        },
        {
          name: "[single] zero field value (required)",
          field: Object.assign(new RelationField(), {
            Name: "test",
            MaxSelect: 1,
            CollectionId: demo1.id,
            Required: true,
          }),
          setup: () => {
            const record = NewRecord(NewBaseCollection("test_collection"));
            record.SetRaw("test", "");
            return record;
          },
          expectError: true,
        },
        {
          name: "[single] id from other collection",
          field: Object.assign(new RelationField(), {
            Name: "test",
            MaxSelect: 1,
            CollectionId: demo1.id,
          }),
          setup: () => {
            const record = NewRecord(NewBaseCollection("test_collection"));
            record.SetRaw("test", "achvryl401bhse3");
            return record;
          },
          expectError: true,
        },
        {
          name: "[single] valid id",
          field: Object.assign(new RelationField(), {
            Name: "test",
            MaxSelect: 1,
            CollectionId: demo1.id,
          }),
          setup: () => {
            const record = NewRecord(NewBaseCollection("test_collection"));
            record.SetRaw("test", "84nmscqy84lsi1t");
            return record;
          },
          expectError: false,
        },
        {
          name: "[single] > MaxSelect",
          field: Object.assign(new RelationField(), {
            Name: "test",
            MaxSelect: 1,
            CollectionId: demo1.id,
          }),
          setup: () => {
            const record = NewRecord(NewBaseCollection("test_collection"));
            record.SetRaw("test", ["84nmscqy84lsi1t", "al1h9ijdeojtsjy"]);
            return record;
          },
          expectError: true,
        },
        {
          name: "[multiple] zero field value (not required)",
          field: Object.assign(new RelationField(), {
            Name: "test",
            MaxSelect: 2,
            CollectionId: demo1.id,
          }),
          setup: () => {
            const record = NewRecord(NewBaseCollection("test_collection"));
            record.SetRaw("test", []);
            return record;
          },
          expectError: false,
        },
        {
          name: "[multiple] zero field value (required)",
          field: Object.assign(new RelationField(), {
            Name: "test",
            MaxSelect: 2,
            CollectionId: demo1.id,
            Required: true,
          }),
          setup: () => {
            const record = NewRecord(NewBaseCollection("test_collection"));
            record.SetRaw("test", []);
            return record;
          },
          expectError: true,
        },
        {
          name: "[multiple] id from other collection",
          field: Object.assign(new RelationField(), {
            Name: "test",
            MaxSelect: 2,
            CollectionId: demo1.id,
          }),
          setup: () => {
            const record = NewRecord(NewBaseCollection("test_collection"));
            record.SetRaw("test", ["84nmscqy84lsi1t", "achvryl401bhse3"]);
            return record;
          },
          expectError: true,
        },
        {
          name: "[multiple] valid id",
          field: Object.assign(new RelationField(), {
            Name: "test",
            MaxSelect: 2,
            CollectionId: demo1.id,
          }),
          setup: () => {
            const record = NewRecord(NewBaseCollection("test_collection"));
            record.SetRaw("test", ["84nmscqy84lsi1t", "al1h9ijdeojtsjy"]);
            return record;
          },
          expectError: false,
        },
        {
          name: "[multiple] > MaxSelect",
          field: Object.assign(new RelationField(), {
            Name: "test",
            MaxSelect: 2,
            CollectionId: demo1.id,
          }),
          setup: () => {
            const record = NewRecord(NewBaseCollection("test_collection"));
            record.SetRaw("test", ["84nmscqy84lsi1t", "al1h9ijdeojtsjy", "imy661ixudk5izi"]);
            return record;
          },
          expectError: true,
        },
        {
          name: "[multiple] < MinSelect",
          field: Object.assign(new RelationField(), {
            Name: "test",
            MinSelect: 2,
            MaxSelect: 99,
            CollectionId: demo1.id,
          }),
          setup: () => {
            const record = NewRecord(NewBaseCollection("test_collection"));
            record.SetRaw("test", ["84nmscqy84lsi1t"]);
            return record;
          },
          expectError: true,
        },
        {
          name: "[multiple] >= MinSelect",
          field: Object.assign(new RelationField(), {
            Name: "test",
            MinSelect: 2,
            MaxSelect: 99,
            CollectionId: demo1.id,
          }),
          setup: () => {
            const record = NewRecord(NewBaseCollection("test_collection"));
            record.SetRaw("test", ["84nmscqy84lsi1t", "al1h9ijdeojtsjy", "imy661ixudk5izi"]);
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
    await testDefaultFieldIdValidation(FieldTypeRelation);
    await testDefaultFieldNameValidation(FieldTypeRelation);

    const { app, cleanup } = await newTestApp();
    try {
      const demo1 = app.findCollectionByNameOrId("demo1");
      if (!demo1) {
        throw new Error("Missing demo1 collection");
      }

      const scenarios = [
        {
          name: "zero minimal",
          build: (_col: ReturnType<typeof NewBaseCollection>) =>
            Object.assign(new RelationField(), { Id: "test", Name: "test" }),
          expectErrors: ["collectionId"],
        },
        {
          name: "invalid collectionId",
          build: (_col: ReturnType<typeof NewBaseCollection>) =>
            Object.assign(new RelationField(), {
              Id: "test",
              Name: "test",
              CollectionId: demo1.name,
            }),
          expectErrors: ["collectionId"],
        },
        {
          name: "valid collectionId",
          build: (_col: ReturnType<typeof NewBaseCollection>) =>
            Object.assign(new RelationField(), {
              Id: "test",
              Name: "test",
              CollectionId: demo1.id,
            }),
          expectErrors: [],
        },
        {
          name: "base->view",
          build: (_col: ReturnType<typeof NewBaseCollection>) =>
            Object.assign(new RelationField(), {
              Id: "test",
              Name: "test",
              CollectionId: "v9gwnfh02gjq1q0",
            }),
          expectErrors: ["collectionId"],
        },
        {
          name: "view->view",
          build: (col: ReturnType<typeof NewBaseCollection>) => {
            col.Type = CollectionTypeView;
            return Object.assign(new RelationField(), {
              Id: "test",
              Name: "test",
              CollectionId: "v9gwnfh02gjq1q0",
            });
          },
          expectErrors: [],
        },
        {
          name: "MinSelect < 0",
          build: (_col: ReturnType<typeof NewBaseCollection>) =>
            Object.assign(new RelationField(), {
              Id: "test",
              Name: "test",
              CollectionId: demo1.id,
              MinSelect: -1,
            }),
          expectErrors: ["minSelect"],
        },
        {
          name: "MinSelect > 0",
          build: (_col: ReturnType<typeof NewBaseCollection>) =>
            Object.assign(new RelationField(), {
              Id: "test",
              Name: "test",
              CollectionId: demo1.id,
              MinSelect: 1,
            }),
          expectErrors: ["maxSelect"],
        },
        {
          name: "MaxSelect < MinSelect",
          build: (_col: ReturnType<typeof NewBaseCollection>) =>
            Object.assign(new RelationField(), {
              Id: "test",
              Name: "test",
              CollectionId: demo1.id,
              MinSelect: 2,
              MaxSelect: 1,
            }),
          expectErrors: ["maxSelect"],
        },
        {
          name: "MaxSelect >= MinSelect",
          build: (_col: ReturnType<typeof NewBaseCollection>) =>
            Object.assign(new RelationField(), {
              Id: "test",
              Name: "test",
              CollectionId: demo1.id,
              MinSelect: 2,
              MaxSelect: 2,
            }),
          expectErrors: [],
        },
      ];

      for (const scenario of scenarios) {
        const collection = NewBaseCollection("test_collection");
        const idField = collection.Fields.GetByName("id");
        if (idField) {
          idField.SetId("test");
        }

        const field = scenario.build(collection);
        collection.Fields.Add(field);

        const errs = field.ValidateSettings(null, app, collection);
        testValidationErrors(errs, scenario.expectErrors);
      }
    } finally {
      await cleanup();
    }
  });

  it("find setter", () => {
    const scenarios = [
      {
        name: "no match",
        key: "example",
        value: "b",
        field: Object.assign(new RelationField(), { Name: "test", MaxSelect: 1 }),
        hasSetter: false,
        expected: "",
      },
      {
        name: "exact match (single)",
        key: "test",
        value: "b",
        field: Object.assign(new RelationField(), { Name: "test", MaxSelect: 1 }),
        hasSetter: true,
        expected: '"b"',
      },
      {
        name: "exact match (multiple)",
        key: "test",
        value: ["a", "b"],
        field: Object.assign(new RelationField(), { Name: "test", MaxSelect: 2 }),
        hasSetter: true,
        expected: '["a","b"]',
      },
      {
        name: "append (single)",
        key: "test+",
        value: "b",
        field: Object.assign(new RelationField(), { Name: "test", MaxSelect: 1 }),
        hasSetter: true,
        expected: '"b"',
      },
      {
        name: "append (multiple)",
        key: "test+",
        value: ["a"],
        field: Object.assign(new RelationField(), { Name: "test", MaxSelect: 2 }),
        hasSetter: true,
        expected: '["c","d","a"]',
      },
      {
        name: "prepend (single)",
        key: "+test",
        value: "b",
        field: Object.assign(new RelationField(), { Name: "test", MaxSelect: 1 }),
        hasSetter: true,
        expected: '"d"',
      },
      {
        name: "prepend (multiple)",
        key: "+test",
        value: ["a"],
        field: Object.assign(new RelationField(), { Name: "test", MaxSelect: 2 }),
        hasSetter: true,
        expected: '["a","c","d"]',
      },
      {
        name: "subtract (single)",
        key: "test-",
        value: "d",
        field: Object.assign(new RelationField(), { Name: "test", MaxSelect: 1 }),
        hasSetter: true,
        expected: '"c"',
      },
      {
        name: "subtract (multiple)",
        key: "test-",
        value: ["unknown", "c"],
        field: Object.assign(new RelationField(), { Name: "test", MaxSelect: 2 }),
        hasSetter: true,
        expected: '["d"]',
      },
    ];

    for (const scenario of scenarios) {
      const collection = NewBaseCollection("test_collection");
      collection.Fields.Add(scenario.field);

      const setter = scenario.field.FindSetter(scenario.key);
      expect(Boolean(setter)).toBe(scenario.hasSetter);

      if (!setter) {
        continue;
      }

      const record = NewRecord(collection);
      record.SetRaw(scenario.field.GetName(), ["c", "d"]);

      setter(record, scenario.value);

      const raw = JSON.stringify(record.Get(scenario.field.GetName()));
      expect(raw).toBe(scenario.expected);
    }
  });
});
