// Ported from pocketbase/core/field_number.go

import type { App } from "./app.ts";
import type { Collection } from "./collection.ts";
import { ValidationErrors, newError, required } from "../internal/compat/validation.ts";
import { toNumberValue } from "../internal/compat/cast.ts";
import {
  Fields,
  type Field,
  type SetterFinder,
  type SetterFunc,
  defaultFieldIdValidationRule,
  defaultFieldNameValidationRule,
} from "./field.ts";
import { ErrUnsupportedValueType } from "./validators/validators.ts";

export const FieldTypeNumber = "number";

export class NumberField implements Field, SetterFinder {
  Name = "";
  Id = "";
  System = false;
  Hidden = false;
  Presentable = false;
  Min: number | null = null;
  Max: number | null = null;
  OnlyInt = false;
  Required = false;

  Type(): string {
    return FieldTypeNumber;
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

  ColumnType(_app: App): string {
    return "NUMERIC DEFAULT 0 NOT NULL";
  }

  PrepareValue(_record: unknown, raw: unknown): number {
    return toNumberValue(raw);
  }

  ValidateValue(_ctx: unknown, _app: App, record: RecordLike): Error | null {
    const value = record.GetRaw(this.Name);
    if (typeof value !== "number") {
      return ErrUnsupportedValueType;
    }

    if (!Number.isFinite(value)) {
      return newError("validation_not_a_number", "The submitted number is not properly formatted");
    }

    if (value === 0) {
      if (this.Required) {
        const err = required(value);
        if (err) {
          return err;
        }
      }
      return null;
    }

    if (this.OnlyInt && value !== Math.trunc(value)) {
      return newError("validation_only_int_constraint", "Decimal numbers are not allowed");
    }

    if (this.Min != null && value < this.Min) {
      return newError("validation_min_number_constraint", `Must be larger than ${this.Min}`);
    }

    if (this.Max != null && value > this.Max) {
      return newError("validation_max_number_constraint", `Must be less than ${this.Max}`);
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

    const minErr = this.checkOnlyInt(this.Min);
    if (minErr) {
      errors.min = minErr;
    }

    const maxErr = this.checkOnlyInt(this.Max);
    if (maxErr) {
      errors.max = maxErr;
    }

    if (this.Min != null && this.Max != null && this.Max < this.Min) {
      errors.max = newError("validation_min_number_constraint", `Must be larger than ${this.Min}`);
    }

    return Object.keys(errors).length > 0 ? new ValidationErrors(errors) : null;
  }

  FindSetter(key: string): SetterFunc | null {
    switch (key) {
      case this.Name:
        return (record, raw) => {
          record.SetRaw(this.Name, toNumberValue(raw));
        };
      case this.Name + "+":
        return (record, raw) => {
          const current = toNumberValue(record.GetRaw(this.Name));
          record.SetRaw(this.Name, current + toNumberValue(raw));
        };
      case this.Name + "-":
        return (record, raw) => {
          const current = toNumberValue(record.GetRaw(this.Name));
          record.SetRaw(this.Name, current - toNumberValue(raw));
        };
      default:
        return null;
    }
  }

  private checkOnlyInt(value: number | null): Error | null {
    if (value == null || !this.OnlyInt) {
      return null;
    }
    if (value !== Math.trunc(value)) {
      return newError("validation_only_int_constraint", "Decimal numbers are not allowed.");
    }
    return null;
  }
}

type RecordLike = {
  GetRaw: (field: string) => unknown;
  SetRaw: (field: string, value: unknown) => void;
};

Fields[FieldTypeNumber] = () => new NumberField();
