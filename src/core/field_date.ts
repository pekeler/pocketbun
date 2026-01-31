// Ported from pocketbase/core/field_date.go

import type { App } from "./app.ts";
import type { Collection } from "./collection.ts";
import { ValidationErrors, newError, required } from "../internal/compat/validation.ts";
import {
  Fields,
  type Field,
  defaultFieldIdValidationRule,
  defaultFieldNameValidationRule,
} from "./field.ts";
import { ErrUnsupportedValueType } from "./validators/validators.ts";
import { DateTime, parseDateTime } from "../tools/types/datetime.ts";

export const FieldTypeDate = "date";

export class DateField implements Field {
  Name = "";
  Id = "";
  System = false;
  Hidden = false;
  Presentable = false;
  Min = new DateTime();
  Max = new DateTime();
  Required = false;

  Type(): string {
    return FieldTypeDate;
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
    return "TEXT DEFAULT '' NOT NULL";
  }

  PrepareValue(_record: unknown, raw: unknown): DateTime {
    return parseDateTime(raw);
  }

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
