// Ported from pocketbase/core/record_model_test.go

import { describe, expect, it } from "bun:test";
import type { GetterFunc, SetterFunc } from "./field.ts";
import { NewBaseCollection } from "./collection.ts";
import { NumberField } from "./field_number.ts";
import { TextField } from "./field_text.ts";
import { NewRecord } from "./record.ts";

class MockField extends TextField {
  FindGetter(key: string): GetterFunc | null {
    if (key === `${this.Name}:test`) {
      return () => "modifier_get";
    }
    return null;
  }

  override FindSetter(key: string): SetterFunc | null {
    switch (key) {
      case this.Name:
        return (record, raw) => {
          record.SetRaw(this.Name, String(raw));
        };
      case `${this.Name}:test`:
        return (record) => {
          record.SetRaw(this.Name, "modifier_set");
        };
      default:
        return null;
    }
  }
}

describe("Record.ReplaceModifiers", () => {
  it("applies modifiers without mutating original data", () => {
    const collection = NewBaseCollection("test");
    const mockField = new MockField();
    mockField.Name = "mock";
    const numberField = new NumberField();
    numberField.Name = "number";
    collection.Fields.Add(mockField, numberField);

    const originalData = {
      mock: "a",
      number: 2.1,
    };

    const record = NewRecord(collection);
    for (const [key, value] of Object.entries(originalData)) {
      record.Set(key, value);
    }

    const result = record.ReplaceModifiers({
      "mock:test": "b",
      "number+": 3,
    });

    const expected = {
      mock: "modifier_set",
      number: 5.1,
    };

    expect(Object.keys(result).length).toBe(Object.keys(expected).length);
    for (const [key, value] of Object.entries(expected)) {
      expect(result[key]).toBe(value);
    }

    for (const [key, value] of Object.entries(originalData)) {
      expect(record.Get(key)).toBe(value);
    }
  });
});
