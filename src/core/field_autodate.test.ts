// Ported from pocketbase/core/field_autodate_test.go

import { describe, expect, it } from "bun:test";
import { newTestApp, newUnbootstrappedTestApp } from "../tests/app.ts";
import { testValidationErrors } from "../tests/validation_errors.ts";
import { NowDateTime, ParseDateTime } from "../tools/types/index.ts";
import { NewBaseCollection } from "./collection_model.ts";
import { testDefaultFieldIdValidation, testDefaultFieldNameValidation, testFieldBaseMethods } from "./field.test.ts";
import { InterceptorActionCreate, InterceptorActionUpdate } from "./field.ts";
import { AutodateField, FieldTypeAutodate } from "./field_autodate.ts";
import { NewRecord } from "./record_model.ts";

describe("autodate field", () => {
  it("base methods", () => {
    testFieldBaseMethods(FieldTypeAutodate);
  });

  it("column type", async () => {
    const { app, cleanup } = await newUnbootstrappedTestApp();
    try {
      const field = new AutodateField();
      expect(field.ColumnType(app)).toBe("TEXT DEFAULT '' NOT NULL");
    } finally {
      await cleanup();
    }
  });

  it("prepare value", async () => {
    const { cleanup } = await newUnbootstrappedTestApp();
    try {
      const field = new AutodateField();
      const record = NewRecord(NewBaseCollection("test"));
      const scenarios = [
        { raw: "", expected: "" },
        { raw: "invalid", expected: "" },
        { raw: "2024-01-01 00:11:22.345Z", expected: "2024-01-01 00:11:22.345Z" },
        {
          raw: new Date(Date.UTC(2024, 0, 2, 3, 4, 5, 0)),
          expected: "2024-01-02 03:04:05.000Z",
        },
      ];

      for (const [index, scenario] of scenarios.entries()) {
        const value = field.PrepareValue(record, scenario.raw);
        expect(value.String(), `scenario ${index}`).toBe(scenario.expected);
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
          field: Object.assign(new AutodateField(), { Name: "test" }),
          record: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", 123);
            return record;
          },
          expectError: false,
        },
        {
          name: "missing field value",
          field: Object.assign(new AutodateField(), { Name: "test" }),
          record: () => {
            const record = NewRecord(collection);
            record.SetRaw("abc", true);
            return record;
          },
          expectError: false,
        },
        {
          name: "existing field value",
          field: Object.assign(new AutodateField(), { Name: "test" }),
          record: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", NowDateTime());
            return record;
          },
          expectError: false,
        },
      ];

      for (const scenario of scenarios) {
        const err = scenario.field.ValidateValue(null, app, scenario.record());
        expect(Boolean(err), scenario.name).toBe(scenario.expectError);
      }
    } finally {
      await cleanup();
    }
  });

  it("validate settings", async () => {
    await testDefaultFieldIdValidation(FieldTypeAutodate);
    await testDefaultFieldNameValidation(FieldTypeAutodate);

    // Keep full bootstrap here because this reads the seeded _superusers collection.
    const { app, cleanup } = await newTestApp();
    try {
      const superusers = app.findCollectionByNameOrId("_superusers");
      if (!superusers) {
        throw new Error("missing superusers collection");
      }

      const scenarios = [
        {
          name: "empty onCreate and onUpdate",
          build: () => Object.assign(new AutodateField(), { Id: "test", Name: "test" }),
          expectErrors: ["onCreate", "onUpdate"],
        },
        {
          name: "with onCreate",
          build: () => Object.assign(new AutodateField(), { Id: "test", Name: "test", OnCreate: true }),
          expectErrors: [],
        },
        {
          name: "with onUpdate",
          build: () => Object.assign(new AutodateField(), { Id: "test", Name: "test", OnUpdate: true }),
          expectErrors: [],
        },
        {
          name: "change of a system autodate field",
          build: () => {
            const created = superusers.Fields.GetByName("created") as AutodateField | null;
            if (!created) {
              throw new Error("missing created field");
            }
            created.OnCreate = !created.OnCreate;
            created.OnUpdate = !created.OnUpdate;
            return created;
          },
          expectErrors: ["onCreate", "onUpdate"],
        },
      ];

      for (const scenario of scenarios) {
        const errs = scenario.build().ValidateSettings(null, app, superusers);
        testValidationErrors(errs, scenario.expectErrors);
      }
    } finally {
      await cleanup();
    }
  });

  it("find setter", async () => {
    const { cleanup } = await newUnbootstrappedTestApp();
    try {
      const field = Object.assign(new AutodateField(), { Name: "test" });
      const collection = NewBaseCollection("test_collection");
      collection.Fields.Add(field);

      const initialDate = ParseDateTime("2024-01-02 03:04:05.789Z");
      const record = NewRecord(collection);
      record.SetRaw("test", initialDate);

      const noMatch = field.FindSetter("abc");
      expect(noMatch).toBeNull();

      const setter = field.FindSetter("test");
      expect(setter).toBeTruthy();
      if (setter) {
        setter(record, NowDateTime());
      }
      expect(record.GetString("test")).toBe("2024-01-02 03:04:05.789Z");
    } finally {
      await cleanup();
    }
  });

  it("intercept", async () => {
    const { app, cleanup } = await newUnbootstrappedTestApp();
    try {
      const initialDate = ParseDateTime("2024-01-02 03:04:05.789Z");
      const collection = NewBaseCollection("test_collection");

      const scenarios = [
        {
          name: "non-matching action",
          actionName: "test",
          field: Object.assign(new AutodateField(), {
            Name: "test",
            OnCreate: true,
            OnUpdate: true,
          }),
          record: () => NewRecord(collection),
          expected: "",
        },
        {
          name: "create with zero value (disabled onCreate)",
          actionName: InterceptorActionCreate,
          field: Object.assign(new AutodateField(), {
            Name: "test",
            OnCreate: false,
            OnUpdate: true,
          }),
          record: () => NewRecord(collection),
          expected: "",
        },
        {
          name: "create with zero value",
          actionName: InterceptorActionCreate,
          field: Object.assign(new AutodateField(), {
            Name: "test",
            OnCreate: true,
            OnUpdate: true,
          }),
          record: () => NewRecord(collection),
          expected: "{NOW}",
        },
        {
          name: "create with non-zero value",
          actionName: InterceptorActionCreate,
          field: Object.assign(new AutodateField(), {
            Name: "test",
            OnCreate: true,
            OnUpdate: true,
          }),
          record: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", initialDate);
            return record;
          },
          expected: initialDate.String(),
        },
        {
          name: "update with zero value (disabled onUpdate)",
          actionName: InterceptorActionUpdate,
          field: Object.assign(new AutodateField(), {
            Name: "test",
            OnCreate: true,
            OnUpdate: false,
          }),
          record: () => NewRecord(collection),
          expected: "",
        },
        {
          name: "update with zero value",
          actionName: InterceptorActionUpdate,
          field: Object.assign(new AutodateField(), {
            Name: "test",
            OnCreate: true,
            OnUpdate: true,
          }),
          record: () => NewRecord(collection),
          expected: "{NOW}",
        },
        {
          name: "update with non-zero value",
          actionName: InterceptorActionUpdate,
          field: Object.assign(new AutodateField(), {
            Name: "test",
            OnCreate: true,
            OnUpdate: true,
          }),
          record: () => {
            const record = NewRecord(collection);
            record.SetRaw("test", initialDate);
            return record;
          },
          expected: initialDate.String(),
        },
      ];

      for (const scenario of scenarios) {
        let actionCalls = 0;
        const record = scenario.record();
        const now = NowDateTime().String();

        const err = scenario.field.Intercept(null, app, record, scenario.actionName, () => {
          actionCalls += 1;
          return null;
        });
        expect(err).toBeNull();
        expect(actionCalls, scenario.name).toBe(1);

        const expected = cutMilliseconds(scenario.expected.replace("{NOW}", now));
        const value = cutMilliseconds(record.GetString(scenario.field.GetName()));
        expect(value, scenario.name).toBe(expected);
      }
    } finally {
      await cleanup();
    }
  });

  it("record resave", async () => {
    // Keep full bootstrap here because this scenario updates a seeded demo2 fixture record.
    const { app, cleanup } = await newTestApp();
    try {
      const collection = app.findCollectionByNameOrId("demo2");
      if (!collection) {
        throw new Error("missing demo2 collection");
      }

      const record = app.findRecordById(collection, "llvuca81nly1qls");
      if (!record) {
        throw new Error("missing demo2 record");
      }

      let lastUpdated = record.GetDateTime("updated");

      // save with autogenerated date
      await Bun.sleep(2);
      let err = await app.Save(record);
      expect(err).toBeNull();

      let newUpdated = record.GetDateTime("updated");
      expect(newUpdated.Equal(lastUpdated), "[0]").toBe(false);
      lastUpdated = newUpdated;

      // save with custom date
      const manualUpdated = lastUpdated.Add(-60_000);
      record.SetRaw("updated", manualUpdated);
      err = await app.Save(record);
      expect(err).toBeNull();

      newUpdated = record.GetDateTime("updated");
      expect(newUpdated.Equal(manualUpdated), "[1]").toBe(true);
      lastUpdated = newUpdated;

      // save again with autogenerated date
      await Bun.sleep(2);
      err = await app.Save(record);
      expect(err).toBeNull();

      newUpdated = record.GetDateTime("updated");
      expect(newUpdated.Equal(lastUpdated), "[2]").toBe(false);
      lastUpdated = newUpdated;

      // simulate save failure
      app.OnRecordUpdateExecute([collection.id]).Bind({
        Id: "test_failure",
        Priority: 9_999_999_999,
        Func: () => new Error("test"),
      });

      // save again with autogenerated date (should fail)
      await Bun.sleep(2);
      err = await app.Save(record);
      expect(err).toBeInstanceOf(Error);

      // updated should still be set even after save failure
      newUpdated = record.GetDateTime("updated");
      expect(newUpdated.Equal(lastUpdated), "[3]").toBe(false);
      lastUpdated = newUpdated;

      // cleanup the error and resave again
      app.OnRecordUpdateExecute([collection.id]).Unbind("test_failure");

      await Bun.sleep(2);
      err = await app.Save(record);
      expect(err).toBeNull();

      newUpdated = record.GetDateTime("updated");
      expect(newUpdated.Equal(lastUpdated), "[4]").toBe(false);
    } finally {
      await cleanup();
    }
  });
});

function cutMilliseconds(datetime: string): string {
  if (datetime.length > 19) {
    return datetime.slice(0, 19);
  }
  return datetime;
}
