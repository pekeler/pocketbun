// Ported from pocketbase/core/field_date.go

import type { App } from "./app.ts";
import type { Collection } from "./collection.ts";
import { ValidationErrors, newError, required } from "../internal/compat/validation.ts";
import { DateTime, parseDateTime } from "../tools/types/datetime.ts";
import { Fields, type Field, defaultFieldIdValidationRule, defaultFieldNameValidationRule } from "./field.ts";
import { ErrUnsupportedValueType } from "./validators/validators.ts";

export const FieldTypeDate = "date";

// DateField defines "date" type field to store a single [types.DateTime] value.
//
// The respective zero record field value is the zero [types.DateTime].
export class DateField implements Field {
  Name = "";
  Id = "";
  System = false;
  Hidden = false;
  Presentable = false;
  Min = new DateTime();
  Max = new DateTime();
  Required = false;

  // Type implements [Field.Type] interface method.
  Type(): string {
    return FieldTypeDate;
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
    return "TEXT DEFAULT '' NOT NULL";
  }

  // PrepareValue implements [Field.PrepareValue] interface method.
  PrepareValue(_record: unknown, raw: unknown): DateTime {
    return parseDateTime(raw);
  }

  // ValidateValue implements [Field.ValidateValue] interface method.
  ValidateValue(_ctx: unknown, _app: App, record: RecordLike): Error | null {
    const value = record.GetRaw(this.Name);
    if (!(value instanceof DateTime)) {
      return ErrUnsupportedValueType;
    }
    if (value.isZero()) {
      if (this.Required) {
        return required(value);
      }
      return null;
    }

    if (!this.Min.isZero() && value.time().getTime() < this.Min.time().getTime()) {
      return newError("validation_min_date", "Date is below the minimum allowed.");
    }

    if (!this.Max.isZero() && value.time().getTime() > this.Max.time().getTime()) {
      return newError("validation_max_date", "Date exceeds the maximum allowed.");
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
    return Object.keys(errors).length > 0 ? new ValidationErrors(errors) : null;
  }
}

type RecordLike = {
  GetRaw: (field: string) => unknown;
};

Fields[FieldTypeDate] = () => new DateField();
