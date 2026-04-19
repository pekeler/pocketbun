// Ported from pocketbase/core/field_bool.go

import type { App } from "./app.ts";
import type { Collection } from "./collection_model.ts";
import { toBoolValue } from "../internal/compat/cast.ts";
import { ValidationErrors, newError, required } from "../internal/compat/validation.ts";
import {
  Fields,
  type Field,
  defaultFieldHelpValidationRule,
  defaultFieldIdValidationRule,
  defaultFieldNameValidationRule,
} from "./field.ts";
import { ErrUnsupportedValueType } from "./validators/validators.ts";

export const FieldTypeBool = "bool";

// BoolField defines "bool" type field to store a single true/false value.
//
// The respective zero record field value is false.
export class BoolField implements Field {
  Name = "";
  Id = "";
  System = false;
  Hidden = false;
  Presentable = false;
  Help = "";
  Required = false;

  // Type implements [Field.Type] interface method.
  Type(): string {
    return FieldTypeBool;
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
    return "BOOLEAN DEFAULT FALSE NOT NULL";
  }

  // PrepareValue implements [Field.PrepareValue] interface method.
  PrepareValue(_record: unknown, raw: unknown): boolean {
    return toBoolValue(raw);
  }

  // ValidateValue implements [Field.ValidateValue] interface method.
  ValidateValue(_ctx: unknown, _app: App, record: RecordLike): Error | null {
    const value = record.GetRaw(this.Name);
    if (typeof value !== "boolean") {
      return ErrUnsupportedValueType;
    }
    if (this.Required) {
      const err = required(value);
      if (err) {
        return newError(err.code, err.message);
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
    const helpErr = defaultFieldHelpValidationRule(this.Help);
    if (helpErr) {
      errors.help = helpErr;
    }
    return Object.keys(errors).length > 0 ? new ValidationErrors(errors) : null;
  }
}

type RecordLike = {
  GetRaw: (field: string) => unknown;
};

Fields[FieldTypeBool] = () => new BoolField();
