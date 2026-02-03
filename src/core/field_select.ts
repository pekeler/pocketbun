// Ported from pocketbase/core/field_select.go

import type { App } from "./app.ts";
import type { Collection } from "./collection_model.ts";
import { ValidationErrors, ErrRequired, newError } from "../internal/compat/validation.ts";
import { subtractSlice, toUniqueStringSlice } from "../tools/list/list.ts";
import { JSONArray } from "../tools/types/index.ts";
import {
  Fields,
  type DriverValuer,
  type Field,
  type MultiValuer,
  type SetterFinder,
  type SetterFunc,
  defaultFieldIdValidationRule,
  defaultFieldNameValidationRule,
} from "./field.ts";

export const FieldTypeSelect = "select";

// SelectField defines "select" type field for storing single or
// multiple string values from a predefined list.
//
// Requires the Values option to be set.
//
// If MaxSelect is not set or <= 1, then the field value is expected to be a single Values element.
//
// If MaxSelect is > 1, then the field value is expected to be a subset of Values slice.
//
// The respective zero record field value is either empty string (single) or empty string slice (multiple).
//
// ---
//
// The following additional setter keys are available:
//
//   - "fieldName+" - append one or more values to the existing record one. For example:
//
//     record.Set("roles+", []string{"new1", "new2"}) // []string{"old1", "old2", "new1", "new2"}
//
//   - "+fieldName" - prepend one or more values to the existing record one. For example:
//
//     record.Set("+roles", []string{"new1", "new2"}) // []string{"new1", "new2", "old1", "old2"}
//
//   - "fieldName-" - subtract one or more values from the existing record one. For example:
//
//     record.Set("roles-", "old1") // []string{"old2"}
export class SelectField implements Field, MultiValuer, DriverValuer, SetterFinder {
  Name = "";
  Id = "";
  System = false;
  Hidden = false;
  Presentable = false;
  Values: string[] = [];
  MaxSelect = 0;
  Required = false;

  // Type implements [Field.Type] interface method.
  Type(): string {
    return FieldTypeSelect;
  }

  // GetId implements [Field.GetId] interface method.
  GetId(): string {
    return this.Id;
  }

  // SetId implements [Field.SetId] interface method.
  SetId(id: string): void {
    this.Id = id;
  }

  // GetName implements [Field.GetName] interface method.
  GetName(): string {
    return this.Name;
  }

  // SetName implements [Field.SetName] interface method.
  SetName(name: string): void {
    this.Name = name;
  }

  // GetSystem implements [Field.GetSystem] interface method.
  GetSystem(): boolean {
    return this.System;
  }

  // SetSystem implements [Field.SetSystem] interface method.
  SetSystem(system: boolean): void {
    this.System = system;
  }

  // GetHidden implements [Field.GetHidden] interface method.
  GetHidden(): boolean {
    return this.Hidden;
  }

  // SetHidden implements [Field.SetHidden] interface method.
  SetHidden(hidden: boolean): void {
    this.Hidden = hidden;
  }

  // IsMultiple implements [MultiValuer] interface and checks whether the
  // current field options support multiple values.
  IsMultiple(): boolean {
    return this.MaxSelect > 1;
  }

  // ColumnType implements [Field.ColumnType] interface method.
  ColumnType(_app: App): string {
    if (this.IsMultiple()) {
      return "JSON DEFAULT '[]' NOT NULL";
    }
    return "TEXT DEFAULT '' NOT NULL";
  }

  // PrepareValue implements [Field.PrepareValue] interface method.
  PrepareValue(_record: unknown, raw: unknown): unknown {
    return this.normalizeValue(raw);
  }

  // DriverValue implements the [DriverValuer] interface.
  DriverValue(record: RecordLike): [unknown, Error | null] {
    const values = toUniqueStringSlice(record.GetRaw(this.Name));
    if (!this.IsMultiple()) {
      if (values.length > 0) {
        return [values[values.length - 1] ?? "", null];
      }
      return ["", null];
    }
    return [new JSONArray(...values), null];
  }

  // ValidateValue implements [Field.ValidateValue] interface method.
  ValidateValue(_ctx: unknown, _app: App, record: RecordLike): Error | null {
    const values = toUniqueStringSlice(record.GetRaw(this.Name));
    if (values.length === 0) {
      if (this.Required) {
        return ErrRequired;
      }
      return null;
    }

    const maxSelect = Math.max(this.MaxSelect, 1);
    if (values.length > maxSelect) {
      return newError("validation_too_many_values", "Select no more than {{.maxSelect}}").setParams({ maxSelect });
    }

    for (const value of values) {
      if (!this.Values.includes(value)) {
        return newError("validation_invalid_value", "Invalid value {{.value}}").setParams({
          value,
        });
      }
    }

    return null;
  }

  // ValidateSettings implements [Field.ValidateSettings] interface method.
  ValidateSettings(_ctx: unknown, _app: App, _collection: Collection): Error | null {
    const errors: Record<string, Error> = {};
    const idErr = defaultFieldIdValidationRule(this.Id);
    if (idErr) {
      errors.id = idErr;
    }
    const nameErr = defaultFieldNameValidationRule(this.Name);
    if (nameErr) {
      errors.name = nameErr;
    }

    if (this.Values.length === 0) {
      errors.values = ErrRequired;
    }

    const max = this.Values.length > 0 ? this.Values.length : 1;
    if (this.MaxSelect < 0 || this.MaxSelect > max) {
      errors.maxSelect = newError("validation_invalid_max", "Invalid maxSelect value.");
    }

    return Object.keys(errors).length > 0 ? new ValidationErrors(errors) : null;
  }

  // FindSetter implements the [SetterFinder] interface.
  FindSetter(key: string): SetterFunc | null {
    switch (key) {
      case this.Name:
        return (record, raw) => {
          record.SetRaw(this.Name, this.normalizeValue(raw));
        };
      case "+" + this.Name:
        return (record, raw) => {
          const current = toUniqueStringSlice(record.GetRaw(this.Name));
          const merged = toUniqueStringSlice(raw).concat(current);
          record.SetRaw(this.Name, this.normalizeValue(merged));
        };
      case this.Name + "+":
        return (record, raw) => {
          const current = toUniqueStringSlice(record.GetRaw(this.Name));
          const merged = current.concat(toUniqueStringSlice(raw));
          record.SetRaw(this.Name, this.normalizeValue(merged));
        };
      case this.Name + "-":
        return (record, raw) => {
          const current = toUniqueStringSlice(record.GetRaw(this.Name));
          const remaining = subtractSlice(current, toUniqueStringSlice(raw));
          record.SetRaw(this.Name, this.normalizeValue(remaining));
        };
      default:
        return null;
    }
  }

  private normalizeValue(raw: unknown): unknown {
    const values = toUniqueStringSlice(raw);
    if (!this.IsMultiple()) {
      if (values.length > 0) {
        return values[values.length - 1] ?? "";
      }
      return "";
    }
    return values;
  }
}

type RecordLike = {
  GetRaw: (field: string) => unknown;
  SetRaw: (field: string, value: unknown) => void;
};

Fields[FieldTypeSelect] = () => new SelectField();
