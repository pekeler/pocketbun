// Ported from pocketbase/core/field_file_test.go

import { describe, expect, it } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { App } from "./app.ts";
import { newTestApp } from "../tests/app.ts";
import { testValidationErrors } from "../tests/validation_errors.ts";
import { NewFileFromBytes, NewFileFromPath, PathReader, type ReadSeekCloser } from "../tools/filesystem/file.ts";
import { toUniqueStringSlice } from "../tools/list/list.ts";
import { JSONArray } from "../tools/types/json_array.ts";
import { NewBaseCollection } from "./collection_model.ts";
import {
  testDefaultFieldHelpValidation,
  testDefaultFieldIdValidation,
  testDefaultFieldNameValidation,
  testFieldBaseMethods,
} from "./field.test.ts";
import { FieldTypeFile, FileField, DefaultFileFieldMaxSize } from "./field_file.ts";
import { NewRecord } from "./record_model.ts";

describe("file field", () => {
  it("base methods", () => {
    testFieldBaseMethods(FieldTypeFile);
  });

  it("column type", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const scenarios = [
        { field: new FileField(), expected: "TEXT DEFAULT '' NOT NULL" },
        {
          field: Object.assign(new FileField(), { MaxSelect: 1 }),
          expected: "TEXT DEFAULT '' NOT NULL",
        },
        {
          field: Object.assign(new FileField(), { MaxSelect: 2 }),
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
      { field: new FileField(), expected: false },
      { field: Object.assign(new FileField(), { MaxSelect: 1 }), expected: false },
      { field: Object.assign(new FileField(), { MaxSelect: 2 }), expected: true },
    ];

    for (const scenario of scenarios) {
      expect(scenario.field.IsMultiple()).toBe(scenario.expected);
    }
  });

  it("prepare value", async () => {
    const { cleanup } = await newTestApp();
    try {
      const record = NewRecord(NewBaseCollection("test"));
      const f1 = NewFileFromBytes(new TextEncoder().encode("test"), "test1.txt");

      const scenarios = [
        { raw: null, field: Object.assign(new FileField(), { MaxSelect: 1 }), expected: '""' },
        { raw: "", field: Object.assign(new FileField(), { MaxSelect: 1 }), expected: '""' },
        { raw: 123, field: Object.assign(new FileField(), { MaxSelect: 1 }), expected: '"123"' },
        { raw: "a", field: Object.assign(new FileField(), { MaxSelect: 1 }), expected: '"a"' },
        { raw: '["a"]', field: Object.assign(new FileField(), { MaxSelect: 1 }), expected: '"a"' },
        {
          raw: f1,
          field: Object.assign(new FileField(), { MaxSelect: 1 }),
          expected: JSON.stringify(f1),
        },
        { raw: [], field: Object.assign(new FileField(), { MaxSelect: 1 }), expected: '""' },
        {
          raw: ["a", "b"],
          field: Object.assign(new FileField(), { MaxSelect: 1 }),
          expected: '"b"',
        },
        { raw: null, field: Object.assign(new FileField(), { MaxSelect: 2 }), expected: "[]" },
        { raw: "", field: Object.assign(new FileField(), { MaxSelect: 2 }), expected: "[]" },
        { raw: 123, field: Object.assign(new FileField(), { MaxSelect: 2 }), expected: '["123"]' },
        { raw: "a", field: Object.assign(new FileField(), { MaxSelect: 2 }), expected: '["a"]' },
        {
          raw: '["a"]',
          field: Object.assign(new FileField(), { MaxSelect: 2 }),
          expected: '["a"]',
        },
        {
          raw: [f1],
          field: Object.assign(new FileField(), { MaxSelect: 2 }),
          expected: `[${JSON.stringify(f1)}]`,
        },
        { raw: [], field: Object.assign(new FileField(), { MaxSelect: 2 }), expected: "[]" },
        {
          raw: ["a", "b", "c"],
          field: Object.assign(new FileField(), { MaxSelect: 2 }),
          expected: '["a","b","c"]',
        },
      ];

      for (const scenario of scenarios) {
        const value = scenario.field.PrepareValue(record, scenario.raw);
        expect(JSON.stringify(value)).toBe(scenario.expected);
      }
    } finally {
      await cleanup();
    }
  });

  it("driver value", async () => {
    const { cleanup } = await newTestApp();
    try {
      const f1 = NewFileFromBytes(new TextEncoder().encode("test"), "test.txt");

      const scenarios = [
        { raw: null, field: Object.assign(new FileField(), { MaxSelect: 1 }), expected: '""' },
        { raw: "", field: Object.assign(new FileField(), { MaxSelect: 1 }), expected: '""' },
        { raw: 123, field: Object.assign(new FileField(), { MaxSelect: 1 }), expected: '"123"' },
        { raw: "a", field: Object.assign(new FileField(), { MaxSelect: 1 }), expected: '"a"' },
        { raw: '["a"]', field: Object.assign(new FileField(), { MaxSelect: 1 }), expected: '"a"' },
        {
          raw: f1,
          field: Object.assign(new FileField(), { MaxSelect: 1 }),
          expected: `"${f1.Name}"`,
        },
        { raw: [], field: Object.assign(new FileField(), { MaxSelect: 1 }), expected: '""' },
        {
          raw: ["a", "b"],
          field: Object.assign(new FileField(), { MaxSelect: 1 }),
          expected: '"b"',
        },
        { raw: null, field: Object.assign(new FileField(), { MaxSelect: 2 }), expected: "[]" },
        { raw: "", field: Object.assign(new FileField(), { MaxSelect: 2 }), expected: "[]" },
        { raw: 123, field: Object.assign(new FileField(), { MaxSelect: 2 }), expected: '["123"]' },
        { raw: "a", field: Object.assign(new FileField(), { MaxSelect: 2 }), expected: '["a"]' },
        {
          raw: '["a"]',
          field: Object.assign(new FileField(), { MaxSelect: 2 }),
          expected: '["a"]',
        },
        {
          raw: ["a", f1],
          field: Object.assign(new FileField(), { MaxSelect: 2 }),
          expected: `["a","${f1.Name}"]`,
        },
        { raw: [], field: Object.assign(new FileField(), { MaxSelect: 2 }), expected: "[]" },
        {
          raw: ["a", "b", "c"],
          field: Object.assign(new FileField(), { MaxSelect: 2 }),
          expected: '["a","b","c"]',
        },
      ];

      for (const scenario of scenarios) {
        const record = NewRecord(NewBaseCollection("test"));
        record.SetRaw(scenario.field.Name, scenario.raw);
        const [value, err] = scenario.field.DriverValue(record);
        expect(err).toBeNull();
        if (scenario.field.IsMultiple()) {
          expect(value instanceof JSONArray).toBe(true);
        } else {
          expect(typeof value === "string").toBe(true);
        }
        expect(JSON.stringify(value)).toBe(scenario.expected);
      }
    } finally {
      await cleanup();
    }
  });

  it("validate value", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const collection = NewBaseCollection("test_collection");

      const f1 = NewFileFromBytes(new TextEncoder().encode("test"), "test1.txt");
      const f2 = NewFileFromBytes(new TextEncoder().encode("test"), "test2.txt");
      const f3 = NewFileFromBytes(new TextEncoder().encode("test_abc"), "test3.txt");
      const f4 = NewFileFromBytes(new Uint8Array(DefaultFileFieldMaxSize + 1), "test4.txt");
      const f5 = NewFileFromBytes(new Uint8Array(DefaultFileFieldMaxSize), "test5.txt");

      const scenarios = [
        {
          name: "zero field value (not required)",
          field: Object.assign(new FileField(), { Name: "test", MaxSize: 9999, MaxSelect: 1 }),
          record: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", "");
            return record;
          },
          expectError: false,
        },
        {
          name: "zero field value (required)",
          field: Object.assign(new FileField(), {
            Name: "test",
            MaxSize: 9999,
            MaxSelect: 1,
            Required: true,
          }),
          record: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", "");
            return record;
          },
          expectError: true,
        },
        {
          name: "new plain filename",
          field: Object.assign(new FileField(), { Name: "test", MaxSize: 9999, MaxSelect: 1 }),
          record: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", "a");
            return record;
          },
          expectError: true,
        },
        {
          name: "new file",
          field: Object.assign(new FileField(), { Name: "test", MaxSize: 9999, MaxSelect: 1 }),
          record: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", f1);
            return record;
          },
          expectError: false,
        },
        {
          name: "new files > MaxSelect",
          field: Object.assign(new FileField(), { Name: "test", MaxSize: 9999, MaxSelect: 1 }),
          record: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", [f1, f2]);
            return record;
          },
          expectError: true,
        },
        {
          name: "new files <= MaxSelect",
          field: Object.assign(new FileField(), { Name: "test", MaxSize: 9999, MaxSelect: 2 }),
          record: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", [f1, f2]);
            return record;
          },
          expectError: false,
        },
        {
          name: "> default MaxSize",
          field: Object.assign(new FileField(), { Name: "test" }),
          record: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", f4);
            return record;
          },
          expectError: true,
        },
        {
          name: "<= default MaxSize",
          field: Object.assign(new FileField(), { Name: "test" }),
          record: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", f5);
            return record;
          },
          expectError: false,
        },
        {
          name: "> MaxSize",
          field: Object.assign(new FileField(), { Name: "test", MaxSize: 4, MaxSelect: 3 }),
          record: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", [f1, f2, f3]);
            return record;
          },
          expectError: true,
        },
        {
          name: "<= MaxSize",
          field: Object.assign(new FileField(), { Name: "test", MaxSize: 8, MaxSelect: 3 }),
          record: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", [f1, f2, f3]);
            return record;
          },
          expectError: false,
        },
        {
          name: "non-matching MimeType",
          field: Object.assign(new FileField(), {
            Name: "test",
            MaxSize: 999,
            MaxSelect: 3,
            MimeTypes: ["a", "b"],
          }),
          record: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", [f1, f2]);
            return record;
          },
          expectError: true,
        },
        {
          name: "matching MimeType",
          field: Object.assign(new FileField(), {
            Name: "test",
            MaxSize: 999,
            MaxSelect: 3,
            MimeTypes: ["text/plain", "b"],
          }),
          record: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", [f1, f2]);
            return record;
          },
          expectError: false,
        },
        {
          name: "existing files > MaxSelect",
          field: Object.assign(new FileField(), { Name: "file_many", MaxSize: 999, MaxSelect: 2 }),
          record: () => app.findRecordById(app.findCollectionByNameOrId("demo1")!, "84nmscqy84lsi1t")!,
          expectError: true,
        },
        {
          name: "existing files should ignore the MaxSize and Mimetypes checks",
          field: Object.assign(new FileField(), {
            Name: "file_many",
            MaxSize: 1,
            MaxSelect: 5,
            MimeTypes: ["a", "b"],
          }),
          record: () => app.findRecordById(app.findCollectionByNameOrId("demo1")!, "84nmscqy84lsi1t")!,
          expectError: false,
        },
        {
          name: "existing + new file > MaxSelect (5+2)",
          field: Object.assign(new FileField(), { Name: "file_many", MaxSize: 999, MaxSelect: 6 }),
          record: () => {
            const record = app.findRecordById(app.findCollectionByNameOrId("demo1")!, "84nmscqy84lsi1t")!;
            record.Set("file_many+", [f1, f2]);
            return record;
          },
          expectError: true,
        },
        {
          name: "existing + new file <= MaxSelect (5+2)",
          field: Object.assign(new FileField(), { Name: "file_many", MaxSize: 999, MaxSelect: 7 }),
          record: () => {
            const record = app.findRecordById(app.findCollectionByNameOrId("demo1")!, "84nmscqy84lsi1t")!;
            record.Set("file_many+", [f1, f2]);
            return record;
          },
          expectError: false,
        },
        {
          name: "existing + new filename",
          field: Object.assign(new FileField(), { Name: "file_many", MaxSize: 999, MaxSelect: 99 }),
          record: () => {
            const record = app.findRecordById(app.findCollectionByNameOrId("demo1")!, "84nmscqy84lsi1t")!;
            record.Set("file_many+", "test123.png");
            return record;
          },
          expectError: true,
        },
      ];

      for (const scenario of scenarios) {
        const err = scenario.field.ValidateValue(null, app, scenario.record());
        expect(Boolean(err)).toBe(scenario.expectError);
      }
    } finally {
      await cleanup();
    }
  });

  it("validate value async", async () => {
    const { app, cleanup } = await newTestApp();
    const tempDir = await mkdtemp(join(tmpdir(), "pb_file_field_async_validate_"));
    try {
      const filePath = join(tempDir, "test.txt");
      await writeFile(filePath, "hello world");

      class ThrowingPathReader extends PathReader {
        override Open(): ReadSeekCloser {
          throw new Error("sync Open should not be called in async validation");
        }
      }

      const upload = NewFileFromPath(filePath);
      upload.Reader = new ThrowingPathReader(filePath);

      const field = Object.assign(new FileField(), {
        Name: "file",
        MaxSize: 1024,
        MaxSelect: 1,
        MimeTypes: ["text/plain"],
      });

      const collection = NewBaseCollection("test_collection");
      collection.Fields.Add(field);

      const record = NewRecord(collection);
      record.SetRaw("file", upload);

      const syncErr = field.ValidateValue(null, app, record);
      expect(syncErr).not.toBeNull();

      const asyncErr = await field.ValidateValueAsync(null, app, record);
      expect(asyncErr).toBeNull();

      const modelAsyncErr = await app.Validate(record);
      expect(modelAsyncErr).toBeNull();
    } finally {
      await rm(tempDir, { recursive: true, force: true });
      await cleanup();
    }
  });

  it("validate settings", async () => {
    await testDefaultFieldIdValidation(FieldTypeFile);
    await testDefaultFieldNameValidation(FieldTypeFile);
    await testDefaultFieldHelpValidation(FieldTypeFile);

    const { app, cleanup } = await newTestApp();
    try {
      const scenarios = [
        {
          name: "zero minimal",
          field: () => Object.assign(new FileField(), { Id: "test", Name: "test" }),
          expectErrors: [],
        },
        {
          name: "0x0 thumb",
          field: () =>
            Object.assign(new FileField(), {
              Id: "test",
              Name: "test",
              MaxSelect: 1,
              Thumbs: ["100x200", "0x0"],
            }),
          expectErrors: ["thumbs"],
        },
        {
          name: "0x0t thumb",
          field: () =>
            Object.assign(new FileField(), {
              Id: "test",
              Name: "test",
              MaxSelect: 1,
              MaxSize: 1,
              Thumbs: ["100x200", "0x0t"],
            }),
          expectErrors: ["thumbs"],
        },
        {
          name: "0x0b thumb",
          field: () =>
            Object.assign(new FileField(), {
              Id: "test",
              Name: "test",
              MaxSelect: 1,
              MaxSize: 1,
              Thumbs: ["100x200", "0x0b"],
            }),
          expectErrors: ["thumbs"],
        },
        {
          name: "0x0f thumb",
          field: () =>
            Object.assign(new FileField(), {
              Id: "test",
              Name: "test",
              MaxSelect: 1,
              MaxSize: 1,
              Thumbs: ["100x200", "0x0f"],
            }),
          expectErrors: ["thumbs"],
        },
        {
          name: "invalid format",
          field: () =>
            Object.assign(new FileField(), {
              Id: "test",
              Name: "test",
              MaxSelect: 1,
              MaxSize: 1,
              Thumbs: ["100x200", "100x"],
            }),
          expectErrors: ["thumbs"],
        },
        {
          name: "valid thumbs",
          field: () =>
            Object.assign(new FileField(), {
              Id: "test",
              Name: "test",
              MaxSelect: 1,
              MaxSize: 1,
              Thumbs: ["100x200", "100x40", "100x200"],
            }),
          expectErrors: [],
        },
        {
          name: "MaxSize > safe json int",
          field: () =>
            Object.assign(new FileField(), {
              Id: "test",
              Name: "test",
              MaxSize: Number.MAX_SAFE_INTEGER + 1,
            }),
          expectErrors: ["maxSize"],
        },
        {
          name: "MaxSize < 0",
          field: () => Object.assign(new FileField(), { Id: "test", Name: "test", MaxSize: -1 }),
          expectErrors: ["maxSize"],
        },
        {
          name: "MaxSelect > safe json int",
          field: () =>
            Object.assign(new FileField(), {
              Id: "test",
              Name: "test",
              MaxSelect: Number.MAX_SAFE_INTEGER + 1,
            }),
          expectErrors: ["maxSelect"],
        },
        {
          name: "MaxSelect < 0",
          field: () => Object.assign(new FileField(), { Id: "test", Name: "test", MaxSelect: -1 }),
          expectErrors: ["maxSelect"],
        },
      ];

      for (const scenario of scenarios) {
        const field = scenario.field();
        const collection = NewBaseCollection("test_collection");
        collection.Fields.Add(field);

        const err = field.ValidateSettings(null, app, collection);
        testValidationErrors(err, scenario.expectErrors);
      }
    } finally {
      await cleanup();
    }
  });

  it("calculate max body size", () => {
    const scenarios = [
      { field: new FileField(), expected: DefaultFileFieldMaxSize },
      {
        field: Object.assign(new FileField(), { MaxSelect: 2 }),
        expected: 2 * DefaultFileFieldMaxSize,
      },
      { field: Object.assign(new FileField(), { MaxSize: 10 }), expected: 10 },
      { field: Object.assign(new FileField(), { MaxSize: 10, MaxSelect: 1 }), expected: 10 },
      { field: Object.assign(new FileField(), { MaxSize: 10, MaxSelect: 2 }), expected: 20 },
    ];

    for (const scenario of scenarios) {
      expect(scenario.field.CalculateMaxBodySize()).toBe(scenario.expected);
    }
  });

  it("find getter", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const f1 = NewFileFromBytes(new TextEncoder().encode("test"), "f1");
      f1.Name = "f1";
      const f2 = NewFileFromBytes(new TextEncoder().encode("test"), "f2");
      f2.Name = "f2";

      const record = app.findRecordById(app.findCollectionByNameOrId("demo3")!, "lcl9d87w22ml6jy")!;
      record.Set("files+", [f1, f2]);
      record.Set("files-", "test_FLurQTgrY8.txt");

      const field = record.collection().Fields.GetByName("files") as FileField;

      const scenarios = [
        { key: "example", hasGetter: false, expected: "" },
        {
          key: field.GetName(),
          hasGetter: true,
          expected: `["300_UhLKX91HVb.png",${JSON.stringify(f1)},${JSON.stringify(f2)}]`,
        },
        {
          key: `${field.GetName()}:unsaved`,
          hasGetter: true,
          expected: `[${JSON.stringify(f1)},${JSON.stringify(f2)}]`,
        },
      ];

      for (const scenario of scenarios) {
        const getter = field.FindGetter(scenario.key);
        expect(Boolean(getter)).toBe(scenario.hasGetter);
        if (!getter) {
          continue;
        }
        const raw = JSON.stringify(getter(record));
        expect(raw).toBe(scenario.expected);
      }
    } finally {
      await cleanup();
    }
  });

  it("find setter", () => {
    const scenarios = [
      {
        key: "example",
        value: "b",
        field: Object.assign(new FileField(), { Name: "test", MaxSelect: 1 }),
        hasSetter: false,
        expected: "",
      },
      {
        key: "test",
        value: "b",
        field: Object.assign(new FileField(), { Name: "test", MaxSelect: 1 }),
        hasSetter: true,
        expected: '"b"',
      },
      {
        key: "test",
        value: ["a", "b", "b"],
        field: Object.assign(new FileField(), { Name: "test", MaxSelect: 2 }),
        hasSetter: true,
        expected: '["a","b"]',
      },
      {
        key: "test+",
        value: "b",
        field: Object.assign(new FileField(), { Name: "test", MaxSelect: 1 }),
        hasSetter: true,
        expected: '"b"',
      },
      {
        key: "test+",
        value: ["a"],
        field: Object.assign(new FileField(), { Name: "test", MaxSelect: 2 }),
        hasSetter: true,
        expected: '["c","d","a"]',
      },
      {
        key: "+test",
        value: "b",
        field: Object.assign(new FileField(), { Name: "test", MaxSelect: 1 }),
        hasSetter: true,
        expected: '"d"',
      },
      {
        key: "+test",
        value: ["a"],
        field: Object.assign(new FileField(), { Name: "test", MaxSelect: 2 }),
        hasSetter: true,
        expected: '["a","c","d"]',
      },
      {
        key: "test-",
        value: "d",
        field: Object.assign(new FileField(), { Name: "test", MaxSelect: 1 }),
        hasSetter: true,
        expected: '"c"',
      },
      {
        key: "test-",
        value: ["unknown", "c"],
        field: Object.assign(new FileField(), { Name: "test", MaxSelect: 2 }),
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
      expect(JSON.stringify(record.Get(scenario.field.GetName()))).toBe(scenario.expected);
    }
  });

  it("intercept", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const demo1 = app.findCollectionByNameOrId("demo1");
      if (!demo1) {
        throw new Error("Missing demo1 collection");
      }
      (demo1.Fields.GetByName("text") as any).Required = true;

      const f1 = NewFileFromBytes(new TextEncoder().encode("test"), "new1.txt");
      const f2 = NewFileFromBytes(new TextEncoder().encode("test"), "new2.txt");
      const f3 = NewFileFromBytes(new TextEncoder().encode("test"), "new3.txt");
      const f4 = NewFileFromBytes(new TextEncoder().encode("test"), "new4.txt");

      const record = NewRecord(demo1);

      record.Set("file_many", [f1, f2]);
      const err1 = await app.Save(record);
      testValidationErrors(err1, ["text"]);
      const raw1 = record.GetRaw("file_many") as unknown[];
      expect(raw1.length).toBe(2);

      record.Set("text", "abc");
      const err2 = await app.Save(record);
      expect(err2).toBeNull();

      const value2 = toUniqueStringSlice(record.GetRaw("file_many"));
      expect(value2.length).toBe(2);
      expect(value2.includes(f1.Name)).toBe(true);
      expect(value2.includes(f2.Name)).toBe(true);
      await checkRecordFiles(app, record, [f1.Name, f2.Name]);

      record.Set("text", "");
      record.Set("file_many+", f3);
      record.Set("file_many-", f2.Name);
      const err3 = await app.Save(record);
      testValidationErrors(err3, ["text"]);

      const raw3 = JSON.stringify(record.GetRaw("file_many"));
      const expected3 = JSON.stringify([f1.Name, f3]);
      expect(raw3).toBe(expected3);
      await checkRecordFiles(app, record, [f1.Name, f2.Name]);

      record.Set("text", "abc2");
      const err4 = await app.Save(record);
      expect(err4).toBeNull();

      const raw4 = JSON.stringify(record.GetRaw("file_many"));
      const expected4 = JSON.stringify([f1.Name, f3.Name]);
      expect(raw4).toBe(expected4);
      await checkRecordFiles(app, record, [f1.Name, f3.Name]);

      record.Set("file_many-", f1.Name);
      record.Set("file_many+", f4);
      const err5 = await app.Save(record);
      expect(err5).toBeNull();

      const raw5 = JSON.stringify(record.GetRaw("file_many"));
      const expected5 = JSON.stringify([f3.Name, f4.Name]);
      expect(raw5).toBe(expected5);
      await checkRecordFiles(app, record, [f3.Name, f4.Name]);
    } finally {
      await cleanup();
    }
  });

  it("intercept tx", async () => {
    const { app, cleanup } = await newTestApp();
    try {
      const demo1 = app.findCollectionByNameOrId("demo1");
      if (!demo1) {
        throw new Error("Missing demo1 collection");
      }
      (demo1.Fields.GetByName("text") as any).Required = true;

      const f1 = NewFileFromBytes(new TextEncoder().encode("test"), "new1.txt");
      const f2 = NewFileFromBytes(new TextEncoder().encode("test"), "new2.txt");
      const f3 = NewFileFromBytes(new TextEncoder().encode("test"), "new3.txt");
      const f4 = NewFileFromBytes(new TextEncoder().encode("test"), "new4.txt");

      let record: ReturnType<typeof NewRecord> | null = null;

      const tx = (succeed: boolean) => async (txApp: App) => {
        const txErr = succeed ? null : new Error("tx error");
        record = NewRecord(demo1);

        const ok1 = async () => {
          record!.Set("text", "");
          record!.Set("file_many", [f1, f2]);
          const err = await txApp.Save(record!);
          testValidationErrors(err, ["text"]);
          await checkRecordFiles(txApp, record!, []);
          return true;
        };
        if (!(await ok1())) return txErr;

        const ok2 = async () => {
          record!.Set("text", "abc");
          const err = await txApp.Save(record!);
          expect(err).toBeNull();
          await checkRecordFiles(txApp, record!, [f1.Name, f2.Name]);
          return true;
        };
        if (!(await ok2())) return txErr;

        const ok3 = async () => {
          record!.Set("text", "");
          record!.Set("file_many+", f3);
          record!.Set("file_many-", f2.Name);
          const err = await txApp.Save(record!);
          testValidationErrors(err, ["text"]);
          const raw = JSON.stringify(record!.GetRaw("file_many"));
          const expected = JSON.stringify([f1.Name, f3]);
          expect(raw).toBe(expected);
          await checkRecordFiles(txApp, record!, [f1.Name, f2.Name]);
          return true;
        };
        if (!(await ok3())) return txErr;

        const ok4 = async () => {
          record!.Set("text", "abc2");
          const err = await txApp.Save(record!);
          expect(err).toBeNull();
          const raw = JSON.stringify(record!.GetRaw("file_many"));
          const expected = JSON.stringify([f1.Name, f3.Name]);
          expect(raw).toBe(expected);
          await checkRecordFiles(txApp, record!, [f1.Name, f3.Name, f2.Name]);
          return true;
        };
        if (!(await ok4())) return txErr;

        const ok5 = async () => {
          record!.Set("file_many-", f1.Name);
          record!.Set("file_many+", f4);
          const err = await txApp.Save(record!);
          expect(err).toBeNull();
          const raw = JSON.stringify(record!.GetRaw("file_many"));
          const expected = JSON.stringify([f3.Name, f4.Name]);
          expect(raw).toBe(expected);
          await checkRecordFiles(txApp, record!, [f3.Name, f4.Name, f1.Name, f2.Name]);
          return true;
        };
        if (!(await ok5())) return txErr;

        return txErr;
      };

      const err1 = await app.RunInTransaction(tx(false));
      expect(err1).not.toBeNull();
      if (record) {
        await checkRecordFiles(app, record, []);
      }

      const err2 = await app.RunInTransaction(tx(true));
      expect(err2).toBeNull();
      if (record) {
        await checkRecordFiles(app, record, [f3.Name, f4.Name]);
      }
    } finally {
      await cleanup();
    }
  });
});

async function checkRecordFiles(app: App, record: ReturnType<typeof NewRecord>, expected: string[]) {
  const fsys = app.NewFilesystem();
  try {
    const objects = await fsys.List(`${record.BaseFilesPath()}/`);
    const keys = objects.map((obj) => obj.Key).filter((key) => !key.includes("/thumbs_"));

    expect(keys.length).toBe(expected.length);
    for (const key of expected) {
      const full = `${record.BaseFilesPath()}/${key}`;
      expect(keys.includes(full)).toBe(true);
    }
  } finally {
    await fsys.Close();
  }
}
