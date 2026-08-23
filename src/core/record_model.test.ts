// Ported from pocketbase/core/record_model_test.go

import { describe, expect, it } from "bun:test";
import type { GetterFunc, SetterFunc } from "./field.ts";
import { NewAuthCollection, NewBaseCollection } from "./collection_model.ts";
import { NumberField } from "./field_number.ts";
import { PasswordFieldValue } from "./field_password.ts";
import { TextField } from "./field_text.ts";
import { NewRecord } from "./record_model.ts";

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

describe("Record constructor", () => {
  it("applies field setters for initial data on new records", () => {
    const users = NewAuthCollection("users");

    const record = NewRecord(users, {
      email: "test@example.com",
      password: "secret123",
    });

    const password = record.GetRaw("password");
    expect(password).toBeInstanceOf(PasswordFieldValue);
    expect((password as PasswordFieldValue).Hash.startsWith("$2")).toBeTrue();
  });
});

describe("Record.GetInt64", () => {
  it("returns the integer representation of a field", () => {
    const collection = NewBaseCollection("test");
    const record = NewRecord(collection);
    record.SetRaw("value", "123");

    expect(record.GetInt64("value")).toBe(123);
    expect(record.getInt64("value")).toBe(123);
  });
});
