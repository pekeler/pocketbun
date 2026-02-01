// Ported from pocketbase/core/field_select.go

import type { App } from "./app.ts";
import type { Collection } from "./collection.ts";
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

export class SelectField implements Field, MultiValuer, DriverValuer, SetterFinder {
  Name = "";
  Id = "";
  System = false;
  Hidden = false;
  Presentable = false;
  Values: string[] = [];
  MaxSelect = 0;
  Required = false;

  Type(): string {
    return FieldTypeSelect;
  }

  GetId(): string {
    return this.Id;
  }

  SetId(id: string): void {
    this.Id = id;
  }

  GetName(): string {
    return this.Name;
  }

  SetName(name: string): void {
    this.Name = name;
  }

  GetSystem(): boolean {
    return this.System;
  }

  SetSystem(system: boolean): void {
    this.System = system;
  }

  GetHidden(): boolean {
    return this.Hidden;
  }

  SetHidden(hidden: boolean): void {
    this.Hidden = hidden;
  }

  IsMultiple(): boolean {
    return this.MaxSelect > 1;
  }

  ColumnType(_app: App): string {
    if (this.IsMultiple()) {
      return "JSON DEFAULT '[]' NOT NULL";
    }
    return "TEXT DEFAULT '' NOT NULL";
  }

  PrepareValue(_record: unknown, raw: unknown): unknown {
    return this.normalizeValue(raw);
  }

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
