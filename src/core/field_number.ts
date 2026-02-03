// Ported from pocketbase/core/field_number.go

import type { App } from "./app.ts";
import type { Collection } from "./collection_model.ts";
import { toNumberValue } from "../internal/compat/cast.ts";
import { ValidationErrors, newError, required } from "../internal/compat/validation.ts";
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

// NumberField defines "number" type field for storing numeric (float64) value.
//
// The respective zero record field value is 0.
//
// The following additional setter keys are available:
//
//   - "fieldName+" - appends to the existing record value. For example:
//     record.Set("total+", 5)
//   - "fieldName-" - subtracts from the existing record value. For example:
//     record.Set("total-", 5)
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

  // Type implements [Field.Type] interface method.
  Type(): string {
    return FieldTypeNumber;
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

  // ColumnType implements [Field.ColumnType] interface method.
  ColumnType(_app: App): string {
    return "NUMERIC DEFAULT 0 NOT NULL";
  }

  // PrepareValue implements [Field.PrepareValue] interface method.
  PrepareValue(_record: unknown, raw: unknown): number {
    return toNumberValue(raw);
  }

  // ValidateValue implements [Field.ValidateValue] interface method.
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

  // FindSetter implements the [SetterFinder] interface.
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
